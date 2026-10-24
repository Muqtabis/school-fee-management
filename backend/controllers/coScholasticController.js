// =====================================================
// CO-SCHOLASTIC / TERM META CONTROLLER
//
// The CLASS TEACHER of a class (or an admin) is the sole
// author of co-scholastic grades, attendance, physical
// stature and the overall performance comment that appear
// on the comprehensive progress card (dynamic progress
// card, Part 2). Subject teachers have NO access here.
//
// Editable while the exam is not yet published; once
// published the card is finalised.
// =====================================================

const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");
const { CO_SCHOLASTIC_AREAS } = require("../utils/progressCard");
const { _helpers } = require("./examController");

const { getExam, isClassTeacher } = _helpers;

// Admin, or the class teacher of the exam's class, may author these fields.
async function canAuthor(user, exam) {
    if (user.role === "admin") return true;
    return isClassTeacher(user, exam.className);
}

function cleanGrade(v) {
    if (v === null || v === undefined || v === "") return null;
    const g = String(v).trim().toUpperCase().slice(0, 5);
    return g || null;
}

function cleanNum(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

// GET the class-teacher entry sheet: students + existing co-scholastic grades
// and term meta for this exam.
exports.getCoScholastic = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });
        if (!(await canAuthor(req.user, exam))) {
            return res.status(403).json({ success: false, message: "Only the class teacher of this class can enter co-scholastic details." });
        }

        const students = await allQuery(
            `SELECT id, studentName, rollNumber FROM students
             WHERE className = ? AND status = 'active'
             ORDER BY CAST(rollNumber AS INTEGER), studentName`,
            [exam.className]
        );
        const grades = await allQuery(
            `SELECT studentId, area, grade FROM co_scholastic_marks WHERE examId = ?`,
            [examId]
        );
        const meta = await allQuery(
            `SELECT studentId, workingDays, daysAttended, heightCm, weightKg, remark, promotionStatus, promotedToClass
             FROM student_term_meta WHERE examId = ?`,
            [examId]
        );

        res.json({
            success: true,
            exam,
            areas: CO_SCHOLASTIC_AREAS,
            students,
            grades,
            meta,
            editable: exam.status !== "published"
        });
    } catch (error) {
        console.error("Get Co-Scholastic Error:", error);
        res.status(500).json({ success: false, message: "Unable to load co-scholastic details." });
    }
};

// PUT co-scholastic grades. Body: { grades: [{ studentId, area, grade }] }.
// Upserts each (examId, studentId, area); a null/empty grade clears the row.
exports.saveCoScholastic = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    const entries = Array.isArray(req.body && req.body.grades) ? req.body.grades : null;
    if (!entries) {
        return res.status(400).json({ success: false, message: "Expected a 'grades' array." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });
        if (!(await canAuthor(req.user, exam))) {
            return res.status(403).json({ success: false, message: "Only the class teacher of this class can enter co-scholastic details." });
        }
        if (exam.status === "published") {
            return res.status(409).json({ success: false, message: "This exam is published; co-scholastic grades are finalised." });
        }

        const areaSet = new Set(CO_SCHOLASTIC_AREAS);
        const now = new Date().toISOString();
        let saved = 0, cleared = 0;
        for (const e of entries) {
            const studentId = Number(e && e.studentId);
            const area = e && e.area;
            if (!Number.isInteger(studentId) || !areaSet.has(area)) continue;
            const grade = cleanGrade(e.grade);
            if (grade === null) {
                await runQuery(
                    `DELETE FROM co_scholastic_marks WHERE examId = ? AND studentId = ? AND area = ?`,
                    [examId, studentId, area]
                );
                cleared++;
            } else {
                await runQuery(
                    `INSERT INTO co_scholastic_marks (examId, studentId, area, grade, updatedBy, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(examId, studentId, area)
                     DO UPDATE SET grade = excluded.grade, updatedBy = excluded.updatedBy, updatedAt = excluded.updatedAt`,
                    [examId, studentId, area, grade, req.user.id, now]
                );
                saved++;
            }
        }

        await logAudit({
            userId: req.user.id,
            action: "SAVE_CO_SCHOLASTIC",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, saved, cleared }
        });
        res.json({ success: true, message: `Saved ${saved} grade(s).`, saved, cleared });
    } catch (error) {
        console.error("Save Co-Scholastic Error:", error);
        res.status(500).json({ success: false, message: "Unable to save co-scholastic grades." });
    }
};

// PUT term meta (attendance / stature / remark / promotion).
// Body: { meta: [{ studentId, workingDays, daysAttended, heightCm, weightKg,
//                  remark, promotionStatus, promotedToClass }] }.
// Upserts one row per (examId, studentId).
exports.saveTermMeta = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    const entries = Array.isArray(req.body && req.body.meta) ? req.body.meta : null;
    if (!entries) {
        return res.status(400).json({ success: false, message: "Expected a 'meta' array." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });
        if (!(await canAuthor(req.user, exam))) {
            return res.status(403).json({ success: false, message: "Only the class teacher of this class can enter term details." });
        }
        if (exam.status === "published") {
            return res.status(409).json({ success: false, message: "This exam is published; term details are finalised." });
        }

        const now = new Date().toISOString();

        // Students that already have a saved meta row: an all-blank entry for one
        // of these is an intentional CLEAR (we remove the row), while an all-blank
        // entry for an untouched student is skipped so no empty NULL rows are born.
        const existingRows = await allQuery(
            `SELECT studentId FROM student_term_meta WHERE examId = ?`,
            [examId]
        );
        const existingIds = new Set(existingRows.map((r) => r.studentId));

        let saved = 0;
        let cleared = 0;
        const skipped = []; // rows held back because daysAttended > workingDays
        for (const e of entries) {
            const studentId = Number(e && e.studentId);
            if (!Number.isInteger(studentId)) continue;
            const workingDays = cleanNum(e.workingDays);
            const daysAttended = cleanNum(e.daysAttended);
            const heightCm = cleanNum(e.heightCm);
            const weightKg = cleanNum(e.weightKg);
            const remark = (e.remark === null || e.remark === undefined) ? null : String(e.remark).trim().slice(0, 500) || null;
            const promotionStatus = (e.promotionStatus === null || e.promotionStatus === undefined) ? null : String(e.promotionStatus).trim().slice(0, 40) || null;
            const promotedToClass = (e.promotedToClass === null || e.promotedToClass === undefined) ? null : String(e.promotedToClass).trim().slice(0, 60) || null;

            // Backend is the final authority: an impossible attendance (attended >
            // working days) is never persisted, even if a caller bypasses the UI.
            if (workingDays !== null && daysAttended !== null && daysAttended > workingDays) {
                skipped.push(studentId);
                continue;
            }

            // No content at all: clear an existing row, otherwise skip (do not
            // create empty NULL rows for students the teacher never touched).
            const allEmpty = workingDays === null && daysAttended === null && heightCm === null &&
                weightKg === null && remark === null && promotionStatus === null && promotedToClass === null;
            if (allEmpty) {
                if (existingIds.has(studentId)) {
                    await runQuery(`DELETE FROM student_term_meta WHERE examId = ? AND studentId = ?`, [examId, studentId]);
                    cleared++;
                }
                continue;
            }

            await runQuery(
                `INSERT INTO student_term_meta
                    (examId, studentId, workingDays, daysAttended, heightCm, weightKg, remark, promotionStatus, promotedToClass, updatedBy, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(examId, studentId) DO UPDATE SET
                    workingDays = excluded.workingDays,
                    daysAttended = excluded.daysAttended,
                    heightCm = excluded.heightCm,
                    weightKg = excluded.weightKg,
                    remark = excluded.remark,
                    promotionStatus = excluded.promotionStatus,
                    promotedToClass = excluded.promotedToClass,
                    updatedBy = excluded.updatedBy,
                    updatedAt = excluded.updatedAt`,
                [examId, studentId, workingDays, daysAttended, heightCm, weightKg, remark, promotionStatus, promotedToClass, req.user.id, now]
            );
            saved++;
        }

        await logAudit({
            userId: req.user.id,
            action: "SAVE_TERM_META",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, saved, cleared, skipped: skipped.length }
        });
        let message = `Saved details for ${saved} student(s).`;
        if (skipped.length) {
            message += ` Skipped ${skipped.length} row(s) where days attended exceeded working days.`;
        }
        res.json({ success: true, message, saved, cleared, skipped });
    } catch (error) {
        console.error("Save Term Meta Error:", error);
        res.status(500).json({ success: false, message: "Unable to save term details." });
    }
};
