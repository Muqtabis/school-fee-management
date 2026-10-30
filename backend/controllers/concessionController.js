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
exports.getConcessions = (req, res) => {
    const { className, category } = req.query;

    let sql = `
        SELECT id, studentName, rollNumber, admissionNumber, className,
               studentCategory, concessionAmount, concessionReason
        FROM students
        WHERE (status IS NULL OR status = 'active') AND concessionAmount > 0
    `;
    const params = [];

    if (className && className !== "All") {
        sql += ` AND className = ?`;
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
