// Transfer certificate controller — renders a TC PDF for a student.
const db = require("../db");
const { generateTransferCertificateBuffer } = require("../utils/transferCertificatePdf");
const logAudit = require("../utils/auditLogger");

// Overall outstanding balance for a student = previous dues + current-year
// fee components - concession - payments made. Used by the TC page (does NOT
// change the other fee pages' math).
exports.getOverallBalance = (req, res) => {
    const studentId = Number(req.params.id || req.query.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: "Student is required." });
    db.get(`SELECT id, previousDues, concessionAmount FROM students WHERE id = ?`, [studentId], (err, s) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (!s) return res.status(404).json({ success: false, message: "Student not found." });
        db.get(`SELECT id FROM academic_years WHERE status='active' ORDER BY id DESC LIMIT 1`, [], (yErr, year) => {
            if (yErr) return res.status(500).json({ success: false, message: "Database error." });
            db.get(`
                SELECT sfa.id AS accId
                FROM student_fee_accounts sfa
                INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                WHERE se.studentId = ? ${year ? "AND se.academicYearId = ?" : ""} LIMIT 1
            `, year ? [studentId, year.id] : [studentId], (aErr, acc) => {
                if (aErr) return res.status(500).json({ success: false, message: "Database error." });
                const accId = acc ? acc.accId : null;
                if (!accId) {
                    return res.json({ success: true, previousDues: Number(s.previousDues||0), items: 0, concession: Number(s.concessionAmount||0), paid: 0, totalDemand: Number(s.previousDues||0), balance: Math.max(0, Number(s.previousDues||0) - Number(s.concessionAmount||0)) });
                }
                db.get(`SELECT COALESCE(SUM(amount),0) AS items FROM student_fee_items WHERE feeAccountId = ?`, [accId], (iErr, it) => {
                    if (iErr) return res.status(500).json({ success: false, message: "Database error." });
                    db.get(`SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE feeAccountId = ? AND (status IS NULL OR status != 'reversed')`, [accId], (pErr, pay) => {
                        if (pErr) return res.status(500).json({ success: false, message: "Database error." });
                        const prev = Number(s.previousDues||0);
                        const items = Number(it.items||0);
                        const concession = Number(s.concessionAmount||0);
                        const paid = Number(pay.paid||0);
                        const totalDemand = prev + items;
                        const balance = Math.max(0, totalDemand - concession - paid);
                        res.json({ success: true, academicYear: year ? year.name : "", previousDues: prev, items, concession, paid, totalDemand, balance });
                    });
                });
            });
        });
    });
};

// Issue a TC: snapshot the record + archive the student. No auto-download.
// Any amount collected at the counter is posted as a REAL payment so the same
// receipt printer works and the money shows up in dashboard/report totals.
exports.issueTC = (req, res) => {
    const studentId = Number(req.params.id);
    const { reason, leavingDate, conduct } = req.body || {};
    if (!studentId) return res.status(400).json({ success: false, message: "Student is required." });

    db.get(`SELECT s.*, ay.name AS academicYear FROM students s
            LEFT JOIN student_enrollments se ON se.studentId = s.id AND se.status = 'active'
            LEFT JOIN academic_years ay ON ay.id = se.academicYearId
            WHERE s.id = ? LIMIT 1`, [studentId], (err, s) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (!s) return res.status(404).json({ success: false, message: "Student not found." });
        if (s.status === "archived") return res.status(409).json({ success: false, message: "Student already archived / TC already issued." });

        exports.getOverallBalance({ params: { id: studentId } }, {
            status() { return this; },
            json(b) {
                if (!b.success) return res.status(500).json({ success: false, message: "Unable to compute balance." });
                const now = new Date().toISOString();
                const paymentDate = now.slice(0, 10);
                const collected = Math.max(0, Number(req.body?.amountCollected || 0));
                const paymentMode = String(req.body?.paymentMode || "Cash");
                const remaining = Math.max(0, Number(b.balance) - collected);

                // Active-year fee account: the TC collection is booked here so it
                // behaves like any other fee payment (receipt + totals).
                db.get(`
                    SELECT sfa.id AS feeAccountId
                    FROM student_fee_accounts sfa
                    INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
                    WHERE se.studentId = ? AND se.academicYearId = (
                        SELECT id FROM academic_years WHERE status='active' ORDER BY id DESC LIMIT 1
                    ) LIMIT 1
                `, [studentId], (accErr, acc) => {
                    if (accErr) return res.status(500).json({ success: false, message: "Database error." });

                    const finish = (paymentId) => {
                        db.run(`INSERT INTO transfer_certificates
                            (studentId, studentName, className, rollNumber, admissionNumber, fatherName, academicYear,
                             reason, leavingDate, conduct, totalDemand, concession, totalPaid, balance, amountCollected, remainingAmount, paymentId, issuedBy, issuedAt)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                            [studentId, s.studentName, s.className, s.rollNumber, s.admissionNumber, s.fatherName,
                             s.academicYear || "", reason || "Transfer to another school", leavingDate || paymentDate,
                             conduct || "Good", b.totalDemand, b.concession, b.paid, b.balance, collected, remaining, paymentId, req.user.id, now],
                            function (iErr) {
                                if (iErr) return res.status(500).json({ success: false, message: "Unable to record TC." });
                                const tcId = this.lastID;
                                db.run(`UPDATE students SET status='archived', archivedAt=?, archivedBy=?, archiveReason=? WHERE id=?`,
                                    [now, req.user.id, `Transfer certificate issued (TC #${tcId})`, studentId],
                                    function (uErr) {
                                        if (uErr) return res.status(500).json({ success: false, message: "TC recorded but could not archive student." });
                                        logAudit({ userId: req.user.id, action: "TC_ISSUED", entityType: "student", entityId: studentId,
                                            details: { tcId, reason, balance: b.balance, collected, paymentMode, paymentId } }).catch(() => {});
                                        res.json({ success: true, tcId, paymentId, collected,
                                            message: "Transfer certificate issued and student archived." });
                                    }
                                );
                            }
                        );
                    };

                    if (collected > 0 && acc?.feeAccountId) {
                        db.run(`INSERT INTO payments (studentId, feeAccountId, paymentDate, amount, paymentMode, remarks, status)
                                VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
                            [studentId, acc.feeAccountId, paymentDate, collected, paymentMode, "Fee collected at TC counter"],
                            function (pErr) {
                                if (pErr) return res.status(500).json({ success: false, message: "Unable to record TC payment." });
                                const paymentId = this.lastID;
                                // Itemise so the shared receipt shows the collection.
                                db.run(`INSERT INTO payment_line_items (paymentId, componentName, amount, mode, paidOn, reference, remark)
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [paymentId, "Fee Collection (TC)", collected, paymentMode, paymentDate, "", "Collected at TC counter"],
                                    () => finish(paymentId));
                            }
                        );
                    } else {
                        finish(null);
                    }
                });
            }
        });
    });
};

// List TC records, optionally filtered by academic year.
exports.listTCs = (req, res) => {
    const year = String(req.query.academicYear || "").trim();
    const sql = `SELECT * FROM transfer_certificates ${year ? "WHERE academicYear = ?" : ""} ORDER BY issuedAt DESC, id DESC`;
    db.all(sql, year ? [year] : [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load TC records." });
        const years = [...new Set((rows || []).map(r => r.academicYear).filter(Boolean))].sort();
        res.json({ success: true, records: rows || [], academicYears: years });
    });
};

// Download a TC PDF from a stored record (regenerates from snapshot).
exports.downloadTC = (req, res) => {
    const tcId = Number(req.params.id);
    db.get(`SELECT * FROM transfer_certificates WHERE id = ?`, [tcId], (err, rec) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (!rec) return res.status(404).json({ success: false, message: "TC record not found." });
        generateTransferCertificateBuffer({
            student: {
                id: rec.studentId, studentName: rec.studentName, className: rec.className,
                rollNumber: rec.rollNumber, admissionNumber: rec.admissionNumber, fatherName: rec.fatherName
            },
            academicYear: rec.academicYear, reason: rec.reason, leavingDate: rec.leavingDate,
            conduct: rec.conduct, certificateNo: `TC/${new Date(rec.issuedAt).getFullYear()}/${String(rec.id).padStart(4,"0")}`,
            meta: { schoolName: process.env.SCHOOL_NAME || "The Age School", trustName: process.env.SCHOOL_TRUST || "", schoolAddress: process.env.SCHOOL_ADDRESS || "" }
        }).then(buf => {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="TransferCertificate_${(rec.studentName||"student").replace(/\s+/g,"_")}.pdf"`);
            res.send(buf);
        }).catch(e => { console.error("TC download error:", e); res.status(500).json({ success: false, message: "Unable to generate TC." }); });
    });
};

exports.generateTransferCertificate = (req, res) => {
    const studentId = Number(req.params.id || req.query.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: "Student is required." });
    const reason = String(req.query.reason || req.body?.reason || "Transfer to another school");
    const leavingDate = String(req.query.leavingDate || req.body?.leavingDate || new Date().toISOString().slice(0, 10));
    const conduct = String(req.query.conduct || req.body?.conduct || "Good");

    db.get(`
        SELECT s.*, ay.name AS academicYear
        FROM students s
        LEFT JOIN student_enrollments se ON se.studentId = s.id AND se.status = 'active'
        LEFT JOIN academic_years ay ON ay.id = se.academicYearId
        WHERE s.id = ? LIMIT 1
    `, [studentId], async (err, student) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (!student) return res.status(404).json({ success: false, message: "Student not found." });
        try {
            const buf = await generateTransferCertificateBuffer({
                student,
                academicYear: student.academicYear || "",
                reason,
                leavingDate,
                conduct,
                certificateNo: `TC/${new Date().getFullYear()}/${String(student.id).padStart(4, "0")}`,
                meta: {
                    schoolName: process.env.SCHOOL_NAME || "The Age School",
                    trustName: process.env.SCHOOL_TRUST || "",
                    schoolAddress: process.env.SCHOOL_ADDRESS || ""
                }
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="TransferCertificate_${student.studentName || "student"}.pdf"`);
            res.send(buf);
        } catch (e) {
            console.error("TC Error:", e);
            res.status(500).json({ success: false, message: "Unable to generate transfer certificate." });
        }
    });
};
