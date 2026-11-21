const db = require("../db");
const logAudit = require("../utils/auditLogger");

// =====================================================
// STUDENT CATEGORY & FEE CONCESSIONS
//
// A student belongs to exactly one category (general by
// default) and may hold at most one negotiated concession
// (concessionAmount + concessionReason). The demand math in
// the payment/ledger flows subtracts concessionAmount from
// the standard fee-account items, so saving a concession
// here instantly lowers the student's fee demand everywhere
// (payments, reports, dashboards).
// =====================================================

const ALLOWED_CATEGORIES = ["general", "rte", "management", "other"];

function getStudentById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM students WHERE id = ?`, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateConcessionFields(id, { concessionAmount, concessionReason, studentCategory }) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE students SET concessionAmount = ?, concessionReason = ?, studentCategory = ? WHERE id = ?`,
            [concessionAmount, concessionReason, studentCategory, id],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

// =====================================================
// LIST CONCESSIONS (active students with concession > 0)
// =====================================================
// READ-ONLY: TC concession records — remaining amounts from issued TCs.
// No add/edit/delete. Any user with the fee_concessions page can view.
exports.getTCConcessions = (req, res) => {
    const year = String(req.query.academicYear || "").trim();
    const sql = `SELECT studentName, className, rollNumber, academicYear,
                        amountCollected, remainingAmount, balance, issuedAt
                 FROM transfer_certificates
                 ${year ? "WHERE academicYear = ?" : ""}
                 ORDER BY issuedAt DESC, id DESC`;
    const db = require("../db");
    db.all(sql, year ? [year] : [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load TC concessions." });
        const years = [...new Set((rows || []).map(r => r.academicYear).filter(Boolean))].sort();
        res.json({ success: true, records: rows || [], academicYears: years });
    });
};

exports.getConcessions = (req, res) => {
    const { className, category } = req.query;

    // A granted concession only reduces fees that actually exist. Compute the
    // effective (pure) amount = min(granted, current-year fee items) so the
    // "Total Conceded" figure never overstates what was really written off.
    let sql = `
        SELECT s.id, s.studentName, s.rollNumber, s.admissionNumber, s.className,
               s.studentCategory, s.concessionAmount, s.concessionReason,
               COALESCE(d.totalItems, 0) AS currentFeeItems,
               MIN(s.concessionAmount, COALESCE(d.totalItems, 0)) AS effectiveConcession
        FROM students s
        LEFT JOIN (
            SELECT se.studentId,
                   COALESCE(SUM(CASE WHEN sfi.itemType = 'carry_forward'
                                      OR LOWER(COALESCE(fc.componentName,'')) LIKE '%previous%'
                                      THEN 0 ELSE sfi.amount END), 0) AS totalItems
            FROM student_enrollments se
            INNER JOIN student_fee_accounts sfa ON sfa.enrollmentId = se.id
            INNER JOIN student_fee_items sfi ON sfi.feeAccountId = sfa.id
            LEFT JOIN fee_components fc ON fc.id = sfi.componentId
            WHERE se.status = 'active' AND se.academicYearId = (
                SELECT id FROM academic_years WHERE status='active' ORDER BY id DESC LIMIT 1
            )
            GROUP BY se.studentId
        ) d ON d.studentId = s.id
        WHERE (s.status IS NULL OR s.status = 'active') AND s.concessionAmount > 0
    `;
    const params = [];

    if (className && className !== "All") {
        sql += ` AND s.className = ?`;
        params.push(className);
    }

    if (category && category !== "All") {
        sql += ` AND studentCategory = ?`;
        params.push(category);
    }

    sql += `
        ORDER BY className ASC, CAST(NULLIF(rollNumber, '') AS INTEGER) ASC, rollNumber ASC
    `;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Unable to fetch concessions." });
        }
        res.json(rows);
    });
};

// =====================================================
// SAVE (upsert) CATEGORY + CONCESSION FOR ONE STUDENT
// Body: { concessionAmount, concessionReason, studentCategory }
// concessionAmount = 0 clears the concession.
// =====================================================
exports.upsertConcession = async (req, res) => {
    const studentId = Number(req.params.studentId);
    const amount = Number(req.body.concessionAmount);
    const reason = String(req.body.concessionReason || "").trim();
    const category = String(req.body.studentCategory || "general").trim().toLowerCase();

    if (!studentId || studentId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }
    if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: "Concession amount must be 0 or more." });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: "Invalid student category." });
    }
    if (amount > 0 && !reason) {
        return res.status(400).json({ success: false, message: "A reason is required when granting a concession." });
    }

    try {
        const student = await getStudentById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found." });
        }
        if (student.status === "archived") {
            return res.status(409).json({ success: false, message: "Archived students cannot be edited. Restore the student first." });
        }

        const changes = await updateConcessionFields(studentId, {
            concessionAmount: amount,
            concessionReason: reason,
            studentCategory: category
        });
        if (changes === 0) {
            return res.status(404).json({ success: false, message: "Student not found." });
        }

        // Concessions change money: always leave an audit trail.
        try {
            await logAudit({
                userId: req.user.id,
                action: amount > 0 ? "CONCESSION_UPDATED" : "CONCESSION_CLEARED",
                entityType: "student",
                entityId: studentId,
                details: {
                    studentName: student.studentName,
                    previous: {
                        amount: Number(student.concessionAmount || 0),
                        reason: student.concessionReason || "",
                        category: student.studentCategory || "general"
                    },
                    new: {
                        amount,
                        reason,
                        category
                    }
                }
            });
        } catch (auditErr) {
            console.error("Audit log (concession) failed:", auditErr);
        }

        res.json({ success: true, message: "Concession saved." });
    } catch (err) {
        console.error("Concession save error:", err);
        res.status(500).json({ success: false, message: "Unable to save concession." });
    }
};

// =====================================================
// REMOVE CONCESSION (student category stays untouched)
// =====================================================
exports.deleteConcession = async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!studentId || studentId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    try {
        const student = await getStudentById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found." });
        }

        const changes = await updateConcessionFields(studentId, {
            concessionAmount: 0,
            concessionReason: "",
            studentCategory: student.studentCategory || "general"
        });
        if (changes === 0) {
            return res.status(404).json({ success: false, message: "Student not found." });
        }

        try {
            await logAudit({
                userId: req.user.id,
                action: "CONCESSION_REMOVED",
                entityType: "student",
                entityId: studentId,
                details: {
                    studentName: student.studentName,
                    previous: {
                        amount: Number(student.concessionAmount || 0),
                        reason: student.concessionReason || ""
                    }
                }
            });
        } catch (auditErr) {
            console.error("Audit log (concession removed) failed:", auditErr);
        }

        res.json({ success: true, message: "Concession removed." });
    } catch (err) {
        console.error("Concession removal error:", err);
        res.status(500).json({ success: false, message: "Unable to remove concession." });
    }
};


// =====================================================
// PREVIOUS-DUES CONCESSIONS
// Only students carrying previous-year dues appear here. This concession is
// capped at the student's previousDues and is subtracted from the dues in
// every calculation (student ledger, payments, receipts, TC, dashboard, reports).
// It is separate from concessionAmount, which only reduces current-year fees.
// =====================================================
exports.getPreviousDuesConcessions = (req, res) => {
    const { className } = req.query;
    let sql = `
        SELECT id, studentName, rollNumber, className, fatherName, contact1, status,
               previousDues, previousDuesConcession, previousDuesConcessionReason
        FROM students
        WHERE COALESCE(previousDues, 0) > 0
          AND (status IS NULL OR status = 'active')
    `;
    const params = [];
    if (className && className !== "All") { sql += ` AND className = ?`; params.push(className); }
    sql += ` ORDER BY className ASC, CAST(NULLIF(rollNumber, '') AS INTEGER) ASC, rollNumber ASC`;
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load previous dues." });
        res.json((rows || []).map((r) => ({
            ...r,
            remainingDues: Math.max(0, Number(r.previousDues || 0) - Number(r.previousDuesConcession || 0))
        })));
    });
};

exports.upsertPreviousDuesConcession = async (req, res) => {
    const studentId = Number(req.params.studentId);
    const amount = Number(req.body.previousDuesConcession);
    const reason = String(req.body.previousDuesConcessionReason || "").trim();

    if (!studentId || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: "Concession amount must be 0 or more." });
    if (amount > 0 && !reason) return res.status(400).json({ success: false, message: "A reason is required when conceding previous dues." });

    try {
        const student = await getStudentById(studentId);
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });
        if (student.status === "archived") return res.status(409).json({ success: false, message: "Archived students cannot be edited. Restore the student first." });
        if (amount > Number(student.previousDues || 0)) {
            return res.status(400).json({ success: false, message: "Previous dues concession cannot exceed the student's previous dues." });
        }

        const changes = await new Promise((resolve, reject) => {
            db.run(
                `UPDATE students SET previousDuesConcession = ?, previousDuesConcessionReason = ? WHERE id = ?`,
                [amount, amount > 0 ? reason : "", studentId],
                function (err) { if (err) reject(err); else resolve(this.changes); }
            );
        });
        if (changes === 0) return res.status(404).json({ success: false, message: "Student not found." });

        try {
            await logAudit({
                userId: req.user.id,
                action: amount > 0 ? "PREV_DUES_CONCESSION_UPDATED" : "PREV_DUES_CONCESSION_CLEARED",
                entityType: "student",
                entityId: studentId,
                details: {
                    studentName: student.studentName,
                    previous: { amount: Number(student.previousDuesConcession || 0), reason: student.previousDuesConcessionReason || "" },
                    new: { amount, reason, previousDues: Number(student.previousDues || 0) }
                }
            });
        } catch (auditErr) { console.error("Audit log (previous dues concession) failed:", auditErr); }

        res.json({ success: true, message: "Previous dues concession saved." });
    } catch (err) {
        console.error("Previous dues concession save error:", err);
        res.status(500).json({ success: false, message: "Unable to save previous dues concession." });
    }
};
