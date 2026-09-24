const db = require("../db");
const logAudit = require("../utils/auditLogger");
const XLSX = require("xlsx");
const archiver = require("archiver");
const { generateReceiptBuffer, receiptFileName, safeName } = require("../utils/receiptPdf");

const activePaymentCondition = `
    (
        status IS NULL
        OR status != 'reversed'
    )
`;

// Promisified helpers for the export builder.
const allQ = (sql, params = []) =>
    new Promise((resolve, reject) => db.all(sql, params, (e, r) => (e ? reject(e) : resolve(r || []))));
const getQ = (sql, params = []) =>
    new Promise((resolve, reject) => db.get(sql, params, (e, r) => (e ? reject(e) : resolve(r))));
const runQ = (sql, params = []) =>
    new Promise((resolve, reject) => db.run(sql, params, function (e) { return e ? reject(e) : resolve(this); }));

// =====================================================
// GET PAYMENTS
// =====================================================
exports.getPayments = (req, res) => {
    const { search, studentId, className, paymentMode, dateFrom, dateTo } = req.query;
    let sql = `
        SELECT payments.*, students.studentName, students.rollNumber, students.className, students.fatherName, ay.name AS academicYearName
        FROM payments
        LEFT JOIN students ON payments.studentId = students.id
        LEFT JOIN student_fee_accounts sfa ON payments.feeAccountId = sfa.id
        LEFT JOIN student_enrollments se ON sfa.enrollmentId = se.id
        LEFT JOIN academic_years ay ON se.academicYearId = ay.id
        WHERE 1 = 1
    `;
    const params = [];
    if (search) {
        sql += ` AND (LOWER(students.studentName) LIKE LOWER(?) OR LOWER(students.rollNumber) LIKE LOWER(?) OR LOWER(students.className) LIKE LOWER(?))`;
        const val = `%${search}%`;
        params.push(val, val, val);
    }
    if (studentId) { sql += ` AND payments.studentId = ?`; params.push(studentId); }
    if (className && className !== "All") { sql += ` AND students.className = ?`; params.push(className); }
    if (paymentMode && paymentMode !== "All") { sql += ` AND payments.paymentMode = ?`; params.push(paymentMode); }
    if (dateFrom) { sql += ` AND payments.paymentDate >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND payments.paymentDate <= ?`; params.push(dateTo); }
    sql += ` ORDER BY payments.paymentDate DESC, payments.id DESC`;

    // Optional LIMIT so callers that only need recent rows (e.g. the dashboard)
    // don't pull the entire table. Unlimited by default for existing callers.
    const limit = Number(req.query.limit);
    if (Number.isInteger(limit) && limit > 0) {
        sql += ` LIMIT ?`;
        params.push(limit);
    }

    db.all(sql, params, (err, rows) => {
        if (err) { console.error("Get Payments Error:", err); return res.status(500).json({ success: false, message: "Unable to load payments." }); }
        res.json(rows);
    });
};

// =====================================================
// ACTIVE ACADEMIC YEAR
// =====================================================
function getActiveYear() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM academic_years WHERE status = 'active' LIMIT 1`, [], (err, year) => {
            if (err) reject(err); else resolve(year);
        });
    });
}

// =====================================================
// GET SINGLE PAYMENT
// =====================================================
exports.getPayment = (req, res) => {
    db.get(`
        SELECT payments.*, students.studentName, students.rollNumber, students.className, students.fatherName, students.contact1, ay.name AS academicYearName
        FROM payments
        LEFT JOIN students ON payments.studentId = students.id
        LEFT JOIN student_fee_accounts sfa ON payments.feeAccountId = sfa.id
        LEFT JOIN student_enrollments se ON sfa.enrollmentId = se.id
        LEFT JOIN academic_years ay ON se.academicYearId = ay.id
        WHERE payments.id = ?
    `, [req.params.id], (err, payment) => {
        if (err) { console.error("Get Payment Error:", err); return res.status(500).json({ success: false, message: "Unable to load payment." }); }
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });
        res.json(payment);
    });
};

// =====================================================
// ADD PAYMENT (FIXED TO PROPERLY SAVE CHECKBOX LINE ITEMS)
// =====================================================
exports.addPayment = async (req, res) => {
    const { studentId, paymentDate, amount, paymentMode, remarks, lineItems } = req.body;
    if (!studentId || !paymentDate || amount === undefined || !paymentMode) {
        return res.status(400).json({ success: false, message: "Student, date, amount and payment mode are required." });
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ success: false, message: "Payment amount must be greater than zero." });
    }

    try {
        const activeYear = await getActiveYear();
        if (!activeYear) return res.status(409).json({ success: false, message: "No active academic year is configured." });

        const student = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM students WHERE id = ?`, [studentId], (err, row) => err ? reject(err) : resolve(row));
        });
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });
        if (student.status === "archived") return res.status(409).json({ success: false, message: "Archived students cannot receive payments." });

        const feeAccount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT sfa.id, se.className, se.rollNumber, ay.name AS academicYearName
                FROM student_fee_accounts sfa
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                INNER JOIN academic_years ay ON ay.id = se.academicYearId
                WHERE se.studentId = ? AND se.academicYearId = ? LIMIT 1
            `, [studentId, activeYear.id], (err, row) => err ? reject(err) : resolve(row));
        });
        if (!feeAccount) return res.status(409).json({ success: false, message: "Fee account not found for active year." });

        // The payment row and its line items must land together: if the line
        // items failed after the payment was inserted, a retry would create a
        // duplicate payment. Wrap both in one transaction.
        let paymentId;
        await runQ("BEGIN");
        try {
            const result = await runQ(`
                INSERT INTO payments (studentId, feeAccountId, paymentDate, amount, paymentMode, remarks, status)
                VALUES (?, ?, ?, ?, ?, ?, 'completed')
            `, [studentId, feeAccount.id, paymentDate, paymentAmount, paymentMode, remarks || ""]);
            paymentId = result.lastID;

            // Strictly save checkbox line items to database
            if (Array.isArray(lineItems) && lineItems.length > 0) {
                for (const item of lineItems) {
                    await runQ(`INSERT INTO payment_line_items (paymentId, componentName, amount) VALUES (?, ?, ?)`,
                        [paymentId, item.componentName, item.amount]);
                }
            }
            await runQ("COMMIT");
        } catch (txErr) {
            await runQ("ROLLBACK").catch(() => {});
            throw txErr;
        }

        if (student.contact1) {
            const message = `Dear Parent, ₹${paymentAmount.toFixed(2)} fee has been received for ${student.studentName}. Academic Year: ${activeYear.name}. Payment Mode: ${paymentMode}. Thank you, THE AGE SCHOOL.`;
            await new Promise(resolve => {
                db.run(`INSERT INTO notifications (studentId, paymentId, phoneNumber, message, notificationType, status, provider) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [student.id, paymentId, student.contact1, message, "SMS", "pending", "MSG91"], () => resolve());
            });
        }

        // Audit is best-effort: the payment is already committed, so an audit
        // failure must not turn into a 500 that invites a duplicate retry.
        await logAudit({
            userId: req.user.id, action: "PAYMENT_CREATED", entityType: "payment", entityId: paymentId,
            details: { studentId: student.id, studentName: student.studentName, academicYear: activeYear.name, feeAccountId: feeAccount.id, amount: paymentAmount, paymentDate, paymentMode, remarks: remarks || "" }
        }).catch((auditErr) => console.error("Audit log (PAYMENT_CREATED) failed:", auditErr));

        res.status(201).json({ success: true, id: paymentId, message: "Payment added successfully." });
    } catch (error) {
        console.error("Add Payment Error:", error);
        res.status(500).json({ success: false, message: "Unable to add payment." });
    }
};

// =====================================================
// REVERSE PAYMENT
// =====================================================
exports.reversePayment = (req, res) => {
    const paymentId = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "Reversal reason required." });

    db.get(`SELECT * FROM payments WHERE id = ?`, [paymentId], (err, payment) => {
        if (err || !payment) return res.status(404).json({ success: false, message: "Payment not found." });
        if (payment.status === "reversed") return res.status(409).json({ success: false, message: "Already reversed." });

        const reversedAt = new Date().toISOString();
        db.run(`UPDATE payments SET status = 'reversed', voidedAt = ?, voidedBy = ?, voidReason = ? WHERE id = ? AND (status IS NULL OR status != 'reversed')`,
            [reversedAt, req.user.id, reason, paymentId], (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: "Unable to reverse." });
            logAudit({
                userId: req.user.id, action: "PAYMENT_REVERSED", entityType: "payment", entityId: paymentId,
                details: { studentId: payment.studentId, feeAccountId: payment.feeAccountId, amount: payment.amount, reason, reversedAt }
            })
                .catch((auditErr) => console.error("Audit log (PAYMENT_REVERSED) failed:", auditErr))
                .finally(() => res.json({ success: true, message: "Payment reversed successfully." }));
        });
    });
};

// =====================================================
// STUDENT FEE HISTORY (FIXED: FETCHES ASSOCIATED LINE ITEMS)
// =====================================================
exports.studentFeeHistory = async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);
        const year = await getActiveYear();
        if (!year) return res.status(404).json({ success: false, message: "No active year." });

        const account = await new Promise((resolve, reject) => {
            db.get(`
                SELECT sfa.id, ay.name AS academicYearName, se.className, se.rollNumber, s.studentName
                FROM student_fee_accounts sfa
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                INNER JOIN academic_years ay ON ay.id = se.academicYearId
                INNER JOIN students s ON s.id = se.studentId
                WHERE se.studentId = ? AND se.academicYearId = ? LIMIT 1
            `, [studentId, year.id], (err, row) => err ? reject(err) : resolve(row));
        });
        if (!account) return res.status(404).json({ success: false, message: "Fee account not found." });

        const items = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sfi.*, fc.componentName, fc.componentKey, fc.sortOrder
                FROM student_fee_items sfi
                INNER JOIN fee_components fc ON fc.id = sfi.componentId
                WHERE sfi.feeAccountId = ? ORDER BY fc.sortOrder
            `, [account.id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const payments = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM payments WHERE feeAccountId = ? ORDER BY paymentDate DESC, id DESC`, [account.id], async (err, rows) => {
                if (err) return reject(err);
                try {
                    for (let i = 0; i < rows.length; i++) {
                        rows[i].lineItems = await new Promise((resItem, rejItem) => {
                            db.all(`SELECT * FROM payment_line_items WHERE paymentId = ?`, [rows[i].id], (err, items) => {
                                if (err) rejItem(err); else resItem(items || []);
                            });
                        });
                    }
                    resolve(rows);
                } catch (e) {
                    reject(e);
                }
            });
        });

        const totalFee = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalPaid = payments.filter(p => p.status !== "reversed").reduce((sum, p) => sum + Number(p.amount || 0), 0);

        res.json({
            student: { id: studentId, studentName: account.studentName, className: account.className, rollNumber: account.rollNumber },
            academicYear: { id: year.id, name: year.name, status: year.status },
            items, payments, totalFee, totalPaid, balance: Math.max(0, totalFee - totalPaid)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load fee history." });
    }
};

// =====================================================
// DASHBOARD SUMMARY (RESTORED)
// =====================================================
exports.dashboardSummary = async (req, res) => {
    try {
        const year = await getActiveYear();
        if (!year) return res.status(404).json({ success: false, message: "No active academic year." });

        // These aggregates are independent — run them concurrently.
        const [totalStudents, feeData, paymentData, totalTeachers] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) AS total FROM student_enrollments WHERE academicYearId = ? AND status = 'active'`, [year.id], (err, row) => {
                    if (err) reject(err); else resolve(Number(row.total || 0));
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT COALESCE(SUM(sfi.amount), 0) AS totalFee
                    FROM student_fee_items sfi
                    INNER JOIN student_fee_accounts sfa ON sfa.id = sfi.feeAccountId
                    INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                    WHERE se.academicYearId = ? AND se.status = 'active'
                `, [year.id], (err, row) => {
                    if (err) reject(err); else resolve(Number(row.totalFee || 0));
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT COUNT(*) AS totalPayments, COALESCE(SUM(amount), 0) AS totalCollection
                    FROM payments
                    WHERE feeAccountId IN (
                        SELECT sfa.id FROM student_fee_accounts sfa
                        INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                        WHERE se.academicYearId = ?
                    ) AND ${activePaymentCondition}
                `, [year.id], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) AS total FROM users WHERE role = 'teacher'`, [], (err, row) => {
                    if (err) reject(err); else resolve(Number(row.total || 0));
                });
            })
        ]);

        res.json({
            academicYear: { id: year.id, name: year.name },
            totalStudents,
            totalTeachers,
            totalPayments: Number(paymentData.totalPayments || 0),
            totalCollection: Number(paymentData.totalCollection || 0),
            totalFee: feeData,
            pendingFees: Math.max(0, feeData - Number(paymentData.totalCollection || 0))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load dashboard summary." });
    }
};

// =====================================================
// MONTHLY COLLECTION (RESTORED)
// =====================================================
exports.monthlyCollection = async (req, res) => {
    try {
        const year = await getActiveYear();
        if (!year) return res.json([]);

        db.all(`
            SELECT strftime('%Y-%m', paymentDate) AS month, COALESCE(SUM(amount), 0) AS collection
            FROM payments
            WHERE feeAccountId IN (
                SELECT sfa.id FROM student_fee_accounts sfa
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                WHERE se.academicYearId = ?
            ) AND ${activePaymentCondition}
            GROUP BY strftime('%Y-%m', paymentDate)
            ORDER BY month ASC
        `, [year.id], (err, rows) => {
            if (err) { console.error("Monthly Collection Error:", err); return res.status(500).json({ success: false, message: "Unable to load monthly collection." }); }
            res.json(rows);
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Unable to load monthly collection." });
    }
};

// =====================================================
// RECEIPT
// =====================================================
exports.getReceipt = (req, res) => {
    db.get(`
        SELECT payments.*, students.studentName, students.rollNumber, students.className, students.fatherName, students.contact1, ay.name AS academicYearName
        FROM payments
        LEFT JOIN students ON payments.studentId = students.id
        LEFT JOIN student_fee_accounts sfa ON payments.feeAccountId = sfa.id
        LEFT JOIN student_enrollments se ON sfa.enrollmentId = se.id
        LEFT JOIN academic_years ay ON se.academicYearId = ay.id
        WHERE payments.id = ?
    `, [req.params.id], (err, receipt) => {
        if (err || !receipt) return res.status(404).json({ success: false, message: "Receipt not found." });
        if (receipt.status === "reversed") return res.status(409).json({ success: false, message: "Cannot generate receipt for reversed payment." });

        db.all(`SELECT * FROM payment_line_items WHERE paymentId = ?`, [receipt.id], (itemErr, items) => {
            receipt.lineItems = itemErr ? [] : (items || []);
            res.json(receipt);
        });
    });
};

// =====================================================
// REPORT SUMMARY (RESTORED)
// =====================================================
exports.reportSummary = async (req, res) => {
    try {
        const year = await getActiveYear();
        if (!year) return res.status(404).json({ success: false, message: "No active academic year." });

        const students = await new Promise((resolve, reject) => {
            db.all(`
                SELECT se.studentId, se.className, se.rollNumber, s.studentName
                FROM student_enrollments se
                INNER JOIN students s ON s.id = se.studentId
                WHERE se.academicYearId = ? AND se.status = 'active'
                ORDER BY se.className, se.rollNumber
            `, [year.id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const payments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT p.id, p.studentId, p.paymentDate, p.amount, p.paymentMode, p.status, s.studentName, se.className
                FROM payments p
                INNER JOIN student_fee_accounts sfa ON sfa.id = p.feeAccountId
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                INNER JOIN students s ON s.id = p.studentId
                WHERE se.academicYearId = ?
                ORDER BY p.paymentDate DESC, p.id DESC
            `, [year.id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const activePayments = payments.filter(payment => payment.status !== "reversed");
        const totalCollection = activePayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
        const totalPayments = activePayments.length;
        const totalStudents = students.length;

        const feeTotal = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COALESCE(SUM(sfi.amount), 0) AS total
                FROM student_fee_items sfi
                INNER JOIN student_fee_accounts sfa ON sfa.id = sfi.feeAccountId
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                WHERE se.academicYearId = ? AND se.status = 'active'
            `, [year.id], (err, row) => err ? reject(err) : resolve(Number(row.total || 0)));
        });

        const averagePayment = totalPayments > 0 ? totalCollection / totalPayments : 0;
        const highestPayment = totalPayments > 0 ? Math.max(...activePayments.map(p => Number(p.amount || 0))) : 0;

        const modeMap = {};
        activePayments.forEach(payment => {
            const mode = payment.paymentMode || "Other";
            modeMap[mode] = (modeMap[mode] || 0) + Number(payment.amount || 0);
        });
        const modeCollection = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));

        const classMap = {};
        activePayments.forEach(payment => {
            const className = payment.className || "Unknown";
            if (!classMap[className]) classMap[className] = { className, payments: 0, collection: 0 };
            classMap[className].payments += 1;
            classMap[className].collection += Number(payment.amount || 0);
        });
        const classCollection = Object.values(classMap);

        res.json({
            period: req.query.period || "all",
            academicYear: { id: year.id, name: year.name },
            totalStudents, totalPayments, totalCollection,
            pendingFees: Math.max(0, feeTotal - totalCollection),
            totalFee: feeTotal,
            averagePayment, highestPayment, modeCollection, classCollection,
            recentPayments: activePayments.slice(0, 10)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to generate report." });
    }
};

// =====================================================
// EXPORT BUNDLE (.zip): Excel workbook + per-payment
// receipt PDFs, linked from the Payment Receipts sheet.
// GET /payments/export-bundle?period=all|month|week|today&className=...
// =====================================================
exports.exportBundle = async (req, res) => {
    try {
        const period = String(req.query.period || "all").toLowerCase();
        const classFilter = req.query.className && req.query.className !== "all"
            ? String(req.query.className)
            : null;

        const schoolName = process.env.SCHOOL_NAME || "The Age School";

        const year = await getActiveYear();
        if (!year) {
            return res.status(404).json({ success: false, message: "No active academic year to export." });
        }

        // --- period boundary (inclusive) ---
        const inPeriod = (dateStr) => {
            if (!dateStr || period === "all") return true;
            const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (period === "today") return d.getTime() === today.getTime();
            if (period === "month") return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            if (period === "week") {
                const day = today.getDay();
                const diff = day === 0 ? 6 : day - 1;
                const start = new Date(today); start.setDate(today.getDate() - diff); start.setHours(0, 0, 0, 0);
                return d >= start && d <= today;
            }
            return true;
        };

        // --- classes (numeric-friendly order) ---
        const classes = await allQ(`
            SELECT className, section, isLocked FROM classes
            ORDER BY CAST(NULLIF(className,'') AS INTEGER) ASC, className ASC, section ASC
        `);

        // --- per-student demand / paid / balance for the active year ---
        const studentRows = await allQ(`
            SELECT
                s.id AS studentId, s.studentName, s.rollNumber, s.className,
                s.fatherName, s.contact1, s.contact2,
                s.previousDues, s.concessionAmount,
                sfa.id AS feeAccountId
            FROM student_enrollments se
            INNER JOIN students s ON s.id = se.studentId
            LEFT JOIN student_fee_accounts sfa ON sfa.enrollmentId = se.id
            WHERE se.academicYearId = ? AND se.status = 'active'
            ORDER BY CAST(NULLIF(s.className,'') AS INTEGER) ASC, s.className ASC,
                     CAST(NULLIF(s.rollNumber,'') AS INTEGER) ASC, s.rollNumber ASC
        `, [year.id]);

        // fee-item totals per account (standard components only feed the demand)
        const feeItemRows = await allQ(`
            SELECT sfi.feeAccountId, sfi.amount, sfi.itemType, fc.componentName
            FROM student_fee_items sfi
            INNER JOIN fee_components fc ON fc.id = sfi.componentId
        `);
        const demandByAccount = {};
        feeItemRows.forEach((r) => {
            const name = String(r.componentName || "").toLowerCase();
            if (r.itemType === "carry_forward" || name.includes("previous")) return;
            demandByAccount[r.feeAccountId] = (demandByAccount[r.feeAccountId] || 0) + Number(r.amount || 0);
        });

        // paid per account (non-reversed)
        const paidRows = await allQ(`
            SELECT feeAccountId, COALESCE(SUM(amount),0) AS paid
            FROM payments
            WHERE ${activePaymentCondition}
            GROUP BY feeAccountId
        `);
        const paidByAccount = {};
        paidRows.forEach((r) => { paidByAccount[r.feeAccountId] = Number(r.paid || 0); });

        // Compose per-student ledger with balance.
        const buildLedger = (s) => {
            const prevDues = Number(s.previousDues || 0);
            const concession = Number(s.concessionAmount || 0);
            const standard = Number(demandByAccount[s.feeAccountId] || 0);
            const netAcademic = Math.max(0, standard - concession);
            const totalDemand = prevDues + netAcademic;
            const totalPaid = Number(paidByAccount[s.feeAccountId] || 0);
            const balance = Math.max(0, totalDemand - totalPaid);
            let status = "UNPAID";
            if (totalDemand > 0 && totalPaid >= totalDemand) status = "PAID";
            else if (totalPaid > 0 && balance > 0) status = "PARTIAL";
            else if (totalDemand === 0 && totalPaid > 0) status = "PAID";
            else if (totalDemand === 0 && totalPaid === 0) status = "FEE NOT SET";
            return { totalDemand, totalPaid, balance, status };
        };
        const ledgerByAccount = {};
        studentRows.forEach((s) => { if (s.feeAccountId) ledgerByAccount[s.feeAccountId] = buildLedger(s); });

        const filteredStudents = classFilter
            ? studentRows.filter((s) => s.className === classFilter)
            : studentRows;

        // --- payments (non-reversed = actual receipts), filtered by period/class ---
        const paymentRows = await allQ(`
            SELECT
                p.id, p.studentId, p.feeAccountId, p.paymentDate, p.amount,
                p.paymentMode, p.remarks, p.status,
                s.studentName, s.rollNumber, s.className, s.fatherName
            FROM payments p
            INNER JOIN student_fee_accounts sfa ON sfa.id = p.feeAccountId
            INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
            INNER JOIN students s ON s.id = p.studentId
            WHERE se.academicYearId = ? AND (p.status IS NULL OR p.status != 'reversed')
            ORDER BY CAST(NULLIF(s.className,'') AS INTEGER) ASC, s.className ASC, p.paymentDate DESC, p.id DESC
        `, [year.id]);

        const receipts = paymentRows.filter(
            (p) => inPeriod(p.paymentDate) && (!classFilter || p.className === classFilter)
        );

        // attach line items for the PDFs
        for (const p of receipts) {
            p.lineItems = await allQ(`SELECT componentName, amount FROM payment_line_items WHERE paymentId = ?`, [p.id]);
        }

        // --- running balance per payment ---
        // Walk EVERY non-reversed payment of each account in chronological order
        // so a receipt shows the balance as it stood right after that payment
        // (earlier payments may fall outside the selected period, so we use the
        // full paymentRows set, not just the filtered receipts).
        const runningByPaymentId = {};
        const byAccount = {};
        paymentRows.forEach((p) => {
            (byAccount[p.feeAccountId] = byAccount[p.feeAccountId] || []).push(p);
        });
        Object.keys(byAccount).forEach((accId) => {
            const list = byAccount[accId].slice().sort((a, b) => {
                const da = a.paymentDate || "";
                const dbb = b.paymentDate || "";
                if (da !== dbb) return da < dbb ? -1 : 1;
                return a.id - b.id;
            });
            const demand = ledgerByAccount[accId]?.totalDemand || 0;
            let cum = 0;
            list.forEach((p) => {
                cum += Number(p.amount || 0);
                runningByPaymentId[p.id] = {
                    totalDemand: demand,
                    paidThrough: cum,
                    balanceAfter: Math.max(0, demand - cum)
                };
            });
        });

        // --- expenses (period-filtered) ---
        const expenseRows = (await allQ(
            `SELECT id, expenseName, category, amount, expenseDate, paymentMode, paidTo, status FROM expenses`
        )).filter((e) => e.status !== "reversed" && inPeriod(e.expenseDate));

        // =====================================================
        // Build the Excel workbook
        // =====================================================
        const exportDate = new Date().toISOString().split("T")[0];
        const money = (v) => Number(v || 0);
        const wb = XLSX.utils.book_new();

        const totalCollected = receipts.reduce((t, p) => t + Number(p.amount || 0), 0);
        const totalAssessed = filteredStudents.reduce((t, s) => t + (ledgerByAccount[s.feeAccountId]?.totalDemand || 0), 0);
        const totalOutstanding = filteredStudents.reduce((t, s) => t + (ledgerByAccount[s.feeAccountId]?.balance || 0), 0);
        const totalExpense = expenseRows.reduce((t, e) => t + Number(e.amount || 0), 0);

        // TAB 1: Overview
        const overview = [
            { "Metric": "Institution", "Value": schoolName },
            { "Metric": "Academic Session", "Value": year.name },
            { "Metric": "Report Scope", "Value": classFilter ? `Class ${classFilter}` : "All Classes" },
            { "Metric": "Period", "Value": period === "all" ? "Till Date" : period },
            { "Metric": "Generated On", "Value": exportDate },
            { "Metric": "----", "Value": "----" },
            { "Metric": "Total Students", "Value": filteredStudents.length },
            { "Metric": "Total Assessed Fee (Rs.)", "Value": money(totalAssessed) },
            { "Metric": "Total Collected (Rs.)", "Value": money(totalCollected) },
            { "Metric": "Total Outstanding (Rs.)", "Value": money(totalOutstanding) },
            { "Metric": "Total Expenses (Rs.)", "Value": money(totalExpense) },
            { "Metric": "Net Balance (Rs.)", "Value": money(totalCollected - totalExpense) },
            { "Metric": "Receipts Issued", "Value": receipts.length }
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), "Overview");

        // TAB 2: Student Fee Register (grouped by class, all students)
        const classFolder = (c) => safeName(c || "Unassigned") || "Unassigned";
        const studentRegister = filteredStudents.map((s, i) => {
            const L = ledgerByAccount[s.feeAccountId] || { totalDemand: 0, totalPaid: 0, balance: 0, status: "FEE NOT SET" };
            return {
                "Sl No": i + 1,
                "Class": s.className || "-",
                "Roll No": s.rollNumber || "-",
                "Student Name": s.studentName || "-",
                "Guardian": s.fatherName || "-",
                "Phone": s.contact1 || "-",
                "Alt Phone": s.contact2 || "-",
                "Total Fee (Rs.)": money(L.totalDemand),
                "Paid (Rs.)": money(L.totalPaid),
                "Balance (Rs.)": money(L.balance),
                "Status": L.status
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            studentRegister.length ? studentRegister : [{ "Sl No": "", "Class": "No students" }]
        ), "Student Fee Register");

        // TAB 3: Payment Receipts (with a hyperlink to each PDF in the zip)
        const receiptRows = receipts.map((p, i) => {
            const R = runningByPaymentId[p.id];
            return {
                "Sl No": i + 1,
                "Receipt No": `REC-${p.id}`,
                "Date": p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : "-",
                "Class": p.className || "-",
                "Roll No": p.rollNumber || "-",
                "Student": p.studentName || "-",
                "Amount Paid (Rs.)": money(p.amount),
                "Mode": (p.paymentMode || "Cash"),
                "Balance After (Rs.)": money(R?.balanceAfter),
                "Receipt PDF": "Open receipt"
            };
        });
        const wsReceipts = XLSX.utils.json_to_sheet(
            receiptRows.length ? receiptRows : [{ "Sl No": "", "Receipt No": "No payments in scope" }]
        );
        // Turn the "Receipt PDF" cells into clickable relative hyperlinks.
        if (receiptRows.length) {
            const headerKeys = Object.keys(receiptRows[0]);
            const linkColIdx = headerKeys.indexOf("Receipt PDF"); // 0-based
            receipts.forEach((p, i) => {
                const rowNum = i + 1; // +1 for header row (0-based data starts at row 1)
                const cellRef = XLSX.utils.encode_cell({ c: linkColIdx, r: rowNum });
                const rel = `Receipts/${classFolder(p.className)}/${receiptFileName(p)}`;
                if (wsReceipts[cellRef]) {
                    wsReceipts[cellRef].l = { Target: rel, Tooltip: "Open the receipt PDF" };
                    wsReceipts[cellRef].s = { font: { color: { rgb: "0563C1" }, underline: true } };
                }
            });
        }
        XLSX.utils.book_append_sheet(wb, wsReceipts, "Payment Receipts");

        // TAB 4: Class Recovery Matrix
        const classMatrixMap = {};
        classes.forEach((c) => {
            const name = c.section ? `${c.className} ${c.section}` : c.className;
            classMatrixMap[c.className] = { className: name, students: 0, assessed: 0, collected: 0, balance: 0, receipts: 0 };
        });
        filteredStudents.forEach((s) => {
            const key = s.className;
            if (!classMatrixMap[key]) classMatrixMap[key] = { className: key || "Unassigned", students: 0, assessed: 0, collected: 0, balance: 0, receipts: 0 };
            const L = ledgerByAccount[s.feeAccountId] || { totalDemand: 0, totalPaid: 0, balance: 0 };
            classMatrixMap[key].students += 1;
            classMatrixMap[key].assessed += L.totalDemand;
            classMatrixMap[key].collected += L.totalPaid;
            classMatrixMap[key].balance += L.balance;
        });
        receipts.forEach((p) => {
            const key = p.className;
            if (classMatrixMap[key]) classMatrixMap[key].receipts += 1;
        });
        const classMatrix = Object.values(classMatrixMap)
            .filter((c) => !classFilter || c.className.startsWith(classFilter))
            .filter((c) => c.students > 0 || c.receipts > 0)
            .map((c, i) => ({
                "Sl No": i + 1,
                "Class": c.className,
                "Students": c.students,
                "Assessed Fee (Rs.)": money(c.assessed),
                "Collected (Rs.)": money(c.collected),
                "Balance (Rs.)": money(c.balance),
                "Recovery %": c.assessed > 0 ? `${((c.collected / c.assessed) * 100).toFixed(1)}%` : "0.0%",
                "Receipts": c.receipts
            }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            classMatrix.length ? classMatrix : [{ "Sl No": "", "Class": "No classes" }]
        ), "Class Matrix");

        // TAB 5: Expense Ledger
        const expenseLedger = expenseRows.map((e, i) => ({
            "Sl No": i + 1,
            "Voucher": `EXP-${e.id}`,
            "Date": e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("en-IN") : "-",
            "Expense": e.expenseName || "-",
            "Category": e.category || "-",
            "Paid To": e.paidTo || "-",
            "Amount (Rs.)": money(e.amount),
            "Mode": (e.paymentMode || "Cash")
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            expenseLedger.length ? expenseLedger : [{ "Sl No": "", "Voucher": "No expenses in scope" }]
        ), "Expense Ledger");

        const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        // =====================================================
        // Stream the ZIP: workbook + receipt PDFs
        // =====================================================
        const zipName = `THE_AGE_SCHOOL_Report_${classFilter ? safeName(classFilter) + "_" : ""}${exportDate}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.on("error", (err) => {
            console.error("Archive error:", err);
            if (!res.headersSent) res.status(500).json({ success: false, message: "Export failed." });
            else res.destroy();
        });
        archive.pipe(res);

        archive.append(xlsxBuffer, { name: "Financial_Report.xlsx" });

        // One receipt PDF per payment, foldered by class. Generated one at a
        // time and streamed straight into the zip (bounded memory). A single
        // bad record is logged and skipped so it can't corrupt the whole
        // download; the failures are listed in the bundle.
        const failed = [];
        for (const p of receipts) {
            try {
                const R = runningByPaymentId[p.id];
                const pdf = await generateReceiptBuffer({
                    schoolName,
                    academicYear: year.name,
                    payment: p,
                    account: R
                        ? { totalDemand: R.totalDemand, totalPaid: R.paidThrough, balance: R.balanceAfter }
                        : (ledgerByAccount[p.feeAccountId] || null)
                });
                archive.append(pdf, { name: `Receipts/${classFolder(p.className)}/${receiptFileName(p)}` });
            } catch (pdfErr) {
                console.error(`Receipt PDF failed for payment ${p.id}:`, pdfErr.message);
                failed.push(`REC-${p.id} (${p.studentName || "?"}, ${p.className || "?"})`);
            }
        }
        if (failed.length) {
            archive.append(
                "These receipts could not be generated and were skipped:\n" + failed.join("\n") + "\n",
                { name: "Receipts/_skipped.txt" }
            );
        }

        // A short readme so users know how the links work.
        archive.append(
            "This report bundle contains:\n" +
            "  - Financial_Report.xlsx  (Overview, Student Fee Register, Payment Receipts, Class Matrix, Expense Ledger)\n" +
            "  - Receipts/<Class>/<receipt>.pdf  (one PDF per payment)\n\n" +
            "In the 'Payment Receipts' sheet, the 'Receipt PDF' column links to each receipt.\n" +
            "Keep this folder extracted together so the links open correctly.\n",
            { name: "READ_ME.txt" }
        );

        await archive.finalize();

        logAudit({
            userId: req.user?.id || null,
            action: "REPORT_EXPORTED",
            entityType: "report",
            entityId: null,
            details: { period, className: classFilter || "all", receipts: receipts.length }
        }).catch(() => {});
    } catch (error) {
        console.error("Export bundle error:", error);
        if (!res.headersSent) res.status(500).json({ success: false, message: "Unable to build export." });
        else res.destroy();
    }
};

// =====================================================
// EDIT / DELETE DISABLED
// =====================================================
exports.updatePayment = (req, res) => { res.status(405).json({ success: false, message: "Use reversal instead." }); };
exports.deletePayment = (req, res) => { res.status(405).json({ success: false, message: "Use reversal instead." }); };