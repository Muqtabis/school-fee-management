const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");
const { generateMarksheet, generateMarksheetBuffer } = require("../utils/marksheetPdf");
const { sendMarksheet } = require("../utils/messagingService");
const { loadBands, computeStudentResult, MARK_STATUSES } = require("../utils/grading");
const { _helpers } = require("./examController");

const { getExam, getEffectiveSubjects, seedExamSubjects } = _helpers;


// =====================================================
// RESULT + DELIVERY CONTROLLER
//
// Publishing (turning locked marks into a stored academic
// result snapshot) is kept STRICTLY separate from delivery
// (sending report cards over WhatsApp). A failed WhatsApp
// send never changes the published result, and a delivery
// retry never re-sends to a student already delivered.
// (spec items 16, 17, 19, 20.)
// =====================================================


// Compute every student's result for an exam from the current
// marks. Used by the admin review/preview AND by publish, so the
// preview and the stored snapshot are identical.
async function buildResults(exam) {
    const subjects = await getEffectiveSubjects(exam.id, exam.className);
    const bands = await loadBands(exam.gradingScaleId);

    const students = await allQuery(
        `SELECT id, studentName, rollNumber, contact1
         FROM students WHERE className = ? AND status = 'active'
         ORDER BY CAST(rollNumber AS INTEGER), studentName`,
        [exam.className]
    );

    const allMarks = await allQuery(
        `SELECT studentId, subjectId, marksObtained, isAbsent, markStatus
         FROM exam_marks WHERE examId = ?`,
        [exam.id]
    );
    const byStudent = new Map();
    for (const m of allMarks) {
        if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, new Map());
        byStudent.get(m.studentId).set(m.subjectId, m);
    }

    const rows = students.map((student) => {
        const marksBySubject = byStudent.get(student.id) || new Map();
        const result = computeStudentResult({ subjects, marksBySubject, bands });

        // Missing cells (present-expected subjects with no entry at all).
        const missing = subjects.filter((s) => !marksBySubject.has(s.subjectId)).length;

        return { student, result, missing };
    });

    return { subjects, bands, rows };
}


// Analytics over computed rows (spec item 24).
function analyze(rows) {
    const counted = rows.filter((r) => r.result.totalMax > 0);
    const pcts = counted.map((r) => r.result.percentage);
    const pass = rows.filter((r) => r.result.overallStatus === "pass").length;
    const fail = rows.filter((r) => r.result.overallStatus === "fail").length;
    const absent = rows.filter((r) => r.result.overallStatus === "absent").length;
    const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

    // Per-subject averages (present marks only).
    const subjAgg = new Map();
    for (const r of rows) {
        for (const sr of r.result.subjectResults) {
            if (sr.markStatus !== "present") continue;
            if (!subjAgg.has(sr.subjectName)) subjAgg.set(sr.subjectName, { sum: 0, n: 0, max: sr.maxMarks });
            const a = subjAgg.get(sr.subjectName);
            a.sum += Number(sr.marksObtained) || 0;
            a.n += 1;
        }
    }
    const subjectAverages = [...subjAgg.entries()].map(([subjectName, a]) => ({
        subjectName,
        average: a.n ? Math.round((a.sum / a.n) * 100) / 100 : 0,
        maxMarks: a.max
    }));

    return {
        totalStudents: rows.length,
        appeared: counted.length,
        pass, fail, absent,
        averagePercent: Math.round(avg * 100) / 100,
        highestPercent: pcts.length ? Math.max(...pcts) : 0,
        lowestPercent: pcts.length ? Math.min(...pcts) : 0,
        subjectAverages
    };
}


// Write one student's computed result into the structured snapshot
// tables (exam_results + exam_result_subjects), bumping the version
// if a snapshot already exists. Returns the resultId.
async function snapshotStudentResult(examId, studentId, result, { bumpVersion = false } = {}) {
    const existing = await allQuery(
        `SELECT id, version FROM exam_results WHERE examId = ? AND studentId = ?`,
        [examId, studentId]
    );

    let resultId;
    if (existing.length) {
        resultId = existing[0].id;
        const version = bumpVersion ? Number(existing[0].version) + 1 : Number(existing[0].version);
        await runQuery(
            `UPDATE exam_results
               SET totalObtained = ?, totalMax = ?, percentage = ?, grade = ?,
                   overallStatus = ?, version = ?, updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [result.totalObtained, result.totalMax, result.percentage, result.grade,
             result.overallStatus, version, resultId]
        );
    } else {
        const ins = await runQuery(
            `INSERT INTO exam_results
               (examId, studentId, totalObtained, totalMax, percentage, grade, overallStatus, version, publishedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [examId, studentId, result.totalObtained, result.totalMax, result.percentage,
             result.grade, result.overallStatus]
        );
        resultId = ins.lastID;
    }

    // Replace the per-subject rows for this result.
    await runQuery(`DELETE FROM exam_result_subjects WHERE resultId = ?`, [resultId]);
    for (const sr of result.subjectResults) {
        await runQuery(
            `INSERT INTO exam_result_subjects
               (resultId, subjectId, subjectName, maxMarks, passMarks, marksObtained, markStatus, grade, subjectPass)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [resultId, sr.subjectId, sr.subjectName, sr.maxMarks, sr.passMarks,
             sr.marksObtained, sr.markStatus, sr.grade, sr.subjectPass === null ? null : (sr.subjectPass ? 1 : 0)]
        );
    }
    return resultId;
}


// =====================================================
// RESULT PREVIEW / REVIEW + ANALYTICS
//
// ADMIN ONLY (route-gated). Before publishing this returns
// a LIVE computed preview from the current marks (with
// missing-mark warnings for the review screen). After
// publishing it returns the stored snapshot. Analytics
// travel alongside but are computed separately (item 24).
// =====================================================

exports.getExamResults = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        await seedExamSubjects(examId, exam.className);

        const { subjects, rows } = await buildResults(exam);
        const analytics = analyze(rows);

        const results = rows.map((r) => ({
            studentId: r.student.id,
            studentName: r.student.studentName,
            rollNumber: r.student.rollNumber,
            missing: r.missing,
            ...r.result
        }));

        res.json({
            success: true,
            exam,
            subjects,
            results,
            analytics,
            published: exam.status === "published"
        });
    } catch (error) {
        console.error("Get Exam Results Error:", error);
        res.status(500).json({ success: false, message: "Unable to load results." });
    }
};


// =====================================================
// PUBLISH EXAM  (academic result only — NO delivery)
//
// ADMIN ONLY (route-gated). Turns the locked marks into a
// stored, structured result snapshot (exam_results +
// exam_result_subjects) and marks the exam 'published'.
// This does NOT send anything: WhatsApp delivery is a
// separate, later step (spec items 16, 17). Requires an
// explicit confirmation from the admin's publish screen.
// =====================================================

exports.publishExam = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    if (req.body?.confirm !== true) {
        return res.status(409).json({
            success: false,
            requiresConfirmation: true,
            message: "Publishing finalises results for all students in this class. Confirm to proceed."
        });
    }

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        if (exam.status !== "locked") {
            return res.status(409).json({
                success: false,
                message: `Marks must be locked/submitted before publishing (current: ${exam.status}).`
            });
        }

        const { rows } = await buildResults(exam);
        for (const r of rows) {
            await snapshotStudentResult(examId, r.student.id, r.result);
        }

        await runQuery(
            `UPDATE exams SET status = 'published', publishedBy = ?, publishedAt = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.user.id, examId]
        );

        await logAudit({
            userId: req.user.id,
            action: "EXAM_PUBLISHED",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, className: exam.className, students: rows.length }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            message: `Published results for ${rows.length} student(s). You can now deliver report cards.`,
            students: rows.length,
            analytics: analyze(rows)
        });
    } catch (error) {
        console.error("Publish Exam Error:", error);
        res.status(500).json({ success: false, message: "Unable to publish exam." });
    }
};


// Rebuild a student's result model from the STORED snapshot (so a
// report card always matches what was published, even after Class
// Management changes). Returns { result, subjectResults } shape used
// by the PDF generator.
async function snapshotResultModel(examId, studentId) {
    const head = await allQuery(
        `SELECT id, totalObtained, totalMax, percentage, grade, overallStatus, publishedAt
         FROM exam_results WHERE examId = ? AND studentId = ?`,
        [examId, studentId]
    );
    if (!head.length) return null;
    const subs = await allQuery(
        `SELECT subjectId, subjectName, maxMarks, passMarks, marksObtained, markStatus, grade, subjectPass
         FROM exam_result_subjects WHERE resultId = ? ORDER BY subjectName`,
        [head[0].id]
    );
    return {
        publishedAt: head[0].publishedAt,
        result: {
            subjectResults: subs.map((s) => ({ ...s, subjectPass: s.subjectPass === null ? null : !!s.subjectPass })),
            totalObtained: head[0].totalObtained,
            totalMax: head[0].totalMax,
            percentage: head[0].percentage,
            grade: head[0].grade,
            overallStatus: head[0].overallStatus
        }
    };
}


// Deliver report cards to a set of students for a published exam.
// Idempotent: the caller decides the target set; this logs every
// attempt into result_notifications with its lifecycle fields.
async function deliverToStudents(exam, students, actorId) {
    const schoolName = process.env.SCHOOL_NAME || "The Age School";
    const publicBase = process.env.PUBLIC_MEDIA_BASE_URL || null;

    let sent = 0, failed = 0;
    const details = [];

    for (const student of students) {
        const model = await snapshotResultModel(exam.id, student.id);
        let mediaPath = null;
        let error = null;

        if (!model) {
            error = "No published result for this student.";
        } else {
            try {
                mediaPath = await generateMarksheet({
                    exam: {
                        id: exam.id, examName: exam.examName, className: exam.className,
                        examType: exam.examType, academicYear: exam.academicYear
                    },
                    student,
                    result: model.result,
                    meta: { schoolName, publishedAt: model.publishedAt || exam.publishedAt }
                });
            } catch (e) {
                console.error(`PDF failed for student ${student.id}:`, e);
                error = "Report card PDF could not be generated.";
            }
        }

        const phone = String(student.contact1 || "").trim();
        let result;
        if (error) {
            result = { success: false, provider: null, providerMessageId: null, error };
        } else if (!phone) {
            result = { success: false, provider: null, providerMessageId: null, error: "No registered mobile number." };
        } else {
            const fileName = mediaPath ? mediaPath.split(/[\\/]/).pop() : "marksheet.pdf";
            const mediaUrl = publicBase && mediaPath ? `${publicBase.replace(/\/+$/, "")}/${fileName}` : null;
            const message =
                `${schoolName}\nResult for ${exam.examName}\n` +
                `Student: ${student.studentName}\nPlease find the attached report card.`;
            result = await sendMarksheet({ phoneNumber: phone, message, mediaPath, mediaUrl, fileName });
        }

        const status = result.success ? "sent" : "failed";
        const nowIso = new Date().toISOString();

        // One notification row per (exam, student), updated in place so a
        // retry bumps attemptCount rather than piling up rows. No schema
        // UNIQUE needed — we look the row up first.
        const existing = await allQuery(
            `SELECT id, attemptCount, sentAt, deliveredAt FROM result_notifications
             WHERE examId = ? AND studentId = ? ORDER BY id DESC LIMIT 1`,
            [exam.id, student.id]
        );
        if (existing.length) {
            const prev = existing[0];
            await runQuery(
                `UPDATE result_notifications SET
                   phoneNumber = ?, status = ?, provider = ?, providerMessageId = ?,
                   mediaPath = ?, error = ?, sentAt = ?, attemptCount = ?,
                   deliveredAt = ?, lastAttemptStatus = ?, updatedAt = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    phone || null, status, result.provider || null, result.providerMessageId || null,
                    mediaPath || null, result.error || null,
                    result.success ? nowIso : (prev.sentAt || null),
                    Number(prev.attemptCount || 0) + 1,
                    result.success ? nowIso : (prev.deliveredAt || null),
                    status, prev.id
                ]
            );
        } else {
            await runQuery(
                `INSERT INTO result_notifications
                   (examId, studentId, phoneNumber, channel, status, provider, providerMessageId,
                    mediaPath, error, sentAt, attemptCount, deliveredAt, lastAttemptStatus, updatedAt)
                 VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    exam.id, student.id, phone || null, status,
                    result.provider || null, result.providerMessageId || null,
                    mediaPath || null, result.error || null,
                    result.success ? nowIso : null,
                    result.success ? nowIso : null,
                    status
                ]
            );
        }

        if (result.success) sent++; else failed++;
        details.push({ studentId: student.id, studentName: student.studentName, status, error: result.error || null });
    }

    return { sent, failed, details };
}


// =====================================================
// DELIVER REPORT CARDS  (WhatsApp — separate from publish)
//
// ADMIN ONLY (route-gated). Only for a PUBLISHED exam. By
// default sends to students not yet delivered (pending +
// previously failed); mode='failed' retries only failures.
// Never re-sends to a student already delivered (item 20) —
// use the per-student resend endpoint for that.
// =====================================================

exports.deliverResults = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    const mode = String(req.body?.mode || "pending");

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        if (exam.status !== "published") {
            return res.status(409).json({
                success: false,
                message: "Results must be published before they can be delivered."
            });
        }

        // Students who have a published result, with their phone.
        const students = await allQuery(
            `SELECT s.id, s.studentName, s.rollNumber, s.className, s.contact1
             FROM exam_results er
             JOIN students s ON s.id = er.studentId
             WHERE er.examId = ?
             ORDER BY CAST(s.rollNumber AS INTEGER), s.studentName`,
            [examId]
        );

        const notes = await allQuery(
            `SELECT studentId, status FROM result_notifications WHERE examId = ?`,
            [examId]
        );
        const lastStatus = new Map(notes.map((n) => [n.studentId, n.status]));

        let target;
        if (mode === "failed") {
            target = students.filter((s) => lastStatus.get(s.id) === "failed");
        } else {
            // pending: never delivered successfully yet.
            target = students.filter((s) => !["sent", "delivered"].includes(lastStatus.get(s.id)));
        }

        if (target.length === 0) {
            return res.json({ success: true, message: "Nothing to deliver — all targeted students are already delivered.", sent: 0, failed: 0, details: [] });
        }

        const out = await deliverToStudents(exam, target, req.user.id);

        await logAudit({
            userId: req.user.id,
            action: "RESULT_DELIVERED",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, mode, sent: out.sent, failed: out.failed }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: `Delivery done. ${out.sent} sent, ${out.failed} failed.`, ...out });
    } catch (error) {
        console.error("Deliver Results Error:", error);
        res.status(500).json({ success: false, message: "Unable to deliver results." });
    }
};


// Resend to ONE student, even if already delivered (item 20).
exports.resendResult = async (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(examId) || !Number.isInteger(studentId)) {
        return res.status(400).json({ success: false, message: "Invalid exam or student ID." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });
        if (exam.status !== "published") {
            return res.status(409).json({ success: false, message: "Results must be published before delivery." });
        }
        const students = await allQuery(
            `SELECT id, studentName, rollNumber, className, contact1 FROM students WHERE id = ?`,
            [studentId]
        );
        if (!students.length) return res.status(404).json({ success: false, message: "Student not found." });

        const out = await deliverToStudents(exam, students, req.user.id);
        await logAudit({
            userId: req.user.id,
            action: "RESULT_RESENT",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, studentId }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: out.sent ? "Report card re-sent." : `Could not send: ${out.details[0]?.error || "unknown error"}.`, ...out });
    } catch (error) {
        console.error("Resend Result Error:", error);
        res.status(500).json({ success: false, message: "Unable to resend result." });
    }
};


// Per-student delivery log for an exam (item 19).
exports.getExamNotifications = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const rows = await allQuery(
            `SELECT rn.id, rn.studentId, s.studentName, rn.phoneNumber, rn.status,
                    rn.provider, rn.providerMessageId, rn.error, rn.sentAt,
                    rn.attemptCount, rn.deliveredAt, rn.lastAttemptStatus, rn.updatedAt
             FROM result_notifications rn
             LEFT JOIN students s ON s.id = rn.studentId
             WHERE rn.examId = ?
             ORDER BY rn.id DESC`,
            [examId]
        );
        res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error("Get Exam Notifications Error:", error);
        res.status(500).json({ success: false, message: "Unable to load notifications." });
    }
};


// =====================================================
// RESULT CORRECTION (published results — versioned)
//
// ADMIN ONLY (route-gated). Published results are protected
// from casual edits (item 23); a change goes through here,
// which records the old and new value, who and why in
// mark_corrections, updates the mark, and re-snapshots the
// student's result with an incremented version (item 22).
// The delivered report card becomes stale, so the response
// flags that a resend is needed.
// =====================================================

exports.correctMark = async (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.body?.studentId);
    const subjectId = Number(req.body?.subjectId);
    const reason = String(req.body?.reason || "").trim();
    const newStatus = String(req.body?.newStatus || "present").toLowerCase();

    if (!Number.isInteger(examId) || !Number.isInteger(studentId) || !Number.isInteger(subjectId)) {
        return res.status(400).json({ success: false, message: "Exam, student and subject are required." });
    }
    if (!reason) {
        return res.status(400).json({ success: false, message: "A reason for the correction is required." });
    }
    if (!MARK_STATUSES.includes(newStatus)) {
        return res.status(400).json({ success: false, message: "Invalid mark status." });
    }

    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });
        if (exam.status !== "published") {
            return res.status(409).json({
                success: false,
                message: "Corrections apply to published results. For an unpublished exam, return it to the teacher instead."
            });
        }

        const subjects = await getEffectiveSubjects(examId, exam.className);
        const subj = subjects.find((s) => s.subjectId === subjectId);
        if (!subj) return res.status(400).json({ success: false, message: "Subject is not part of this exam." });

        let newMarks = null;
        if (newStatus === "present") {
            const raw = Number(req.body?.newMarks);
            const max = Number(subj.maxMarks) || 0;
            if (!Number.isFinite(raw) || raw < 0) {
                return res.status(400).json({ success: false, message: "New marks must be a number of 0 or more." });
            }
            if (raw > max) {
                return res.status(400).json({ success: false, message: `New marks exceed the maximum of ${max}.` });
            }
            newMarks = raw;
        }

        // Capture the old value for the audit trail.
        const oldRows = await allQuery(
            `SELECT marksObtained, isAbsent, markStatus FROM exam_marks
             WHERE examId = ? AND studentId = ? AND subjectId = ?`,
            [examId, studentId, subjectId]
        );
        const old = oldRows[0] || { marksObtained: null, markStatus: null };

        const isAbsent = newStatus === "absent" ? 1 : 0;
        await runQuery(
            `INSERT INTO exam_marks (examId, studentId, subjectId, marksObtained, isAbsent, markStatus, updatedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(examId, studentId, subjectId)
             DO UPDATE SET marksObtained = excluded.marksObtained,
                           isAbsent = excluded.isAbsent,
                           markStatus = excluded.markStatus,
                           updatedBy = excluded.updatedBy`,
            [examId, studentId, subjectId, newMarks, isAbsent, newStatus, req.user.id]
        );

        await runQuery(
            `INSERT INTO mark_corrections
               (examId, studentId, subjectId, oldMarks, newMarks, oldStatus, newStatus, reason, changedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [examId, studentId, subjectId, old.marksObtained, newMarks,
             old.markStatus || (old.isAbsent ? "absent" : "present"), newStatus, reason, req.user.id]
        );

        // Re-snapshot this student's result (new version).
        const bands = await loadBands(exam.gradingScaleId);
        const marks = await allQuery(
            `SELECT subjectId, marksObtained, isAbsent, markStatus FROM exam_marks WHERE examId = ? AND studentId = ?`,
            [examId, studentId]
        );
        const marksBySubject = new Map(marks.map((m) => [m.subjectId, m]));
        const result = computeStudentResult({ subjects, marksBySubject, bands });
        await snapshotStudentResult(examId, studentId, result, { bumpVersion: true });

        await logAudit({
            userId: req.user.id,
            action: "RESULT_CORRECTED",
            entityType: "exam",
            entityId: examId,
            details: { studentId, subjectId, subject: subj.subjectName,
                       from: { marks: old.marksObtained, status: old.markStatus },
                       to: { marks: newMarks, status: newStatus }, reason }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            message: "Correction saved and the result was recalculated.",
            result,
            needsRedelivery: true
        });
    } catch (error) {
        console.error("Correct Mark Error:", error);
        res.status(500).json({ success: false, message: "Unable to save correction." });
    }
};


// Correction history for an exam (item 22 audit view).
exports.getCorrections = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const rows = await allQuery(
            `SELECT mc.id, mc.studentId, s.studentName, mc.subjectId, sub.subjectName,
                    mc.oldMarks, mc.newMarks, mc.oldStatus, mc.newStatus, mc.reason,
                    mc.changedBy, u.name AS changedByName, mc.createdAt
             FROM mark_corrections mc
             LEFT JOIN students s ON s.id = mc.studentId
             LEFT JOIN subjects sub ON sub.id = mc.subjectId
             LEFT JOIN users u ON u.id = mc.changedBy
             WHERE mc.examId = ?
             ORDER BY mc.id DESC`,
            [examId]
        );
        res.json({ success: true, corrections: rows });
    } catch (error) {
        console.error("Get Corrections Error:", error);
        res.status(500).json({ success: false, message: "Unable to load corrections." });
    }
};


// =====================================================
// STUDENT RESULT HISTORY (structured, not just PDFs)
//
// Every published result for a student across exams, with
// the per-subject breakdown — the durable academic record
// (item 21). ADMIN ONLY (route-gated).
// =====================================================

exports.getStudentResultHistory = async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
        return res.status(400).json({ success: false, message: "Invalid student ID." });
    }
    try {
        const heads = await allQuery(
            `SELECT er.id, er.examId, e.examName, e.className, d.examType, ay.name AS academicYear,
                    er.totalObtained, er.totalMax, er.percentage, er.grade, er.overallStatus,
                    er.version, er.publishedAt, er.updatedAt
             FROM exam_results er
             JOIN exams e ON e.id = er.examId
             LEFT JOIN exam_definitions d ON d.id = e.examDefinitionId
             LEFT JOIN academic_years ay ON ay.id = d.academicYearId
             WHERE er.studentId = ?
             ORDER BY er.publishedAt DESC, er.id DESC`,
            [studentId]
        );
        for (const h of heads) {
            h.subjects = await allQuery(
                `SELECT subjectName, maxMarks, passMarks, marksObtained, markStatus, grade, subjectPass
                 FROM exam_result_subjects WHERE resultId = ? ORDER BY subjectName`,
                [h.id]
            );
        }
        res.json({ success: true, history: heads });
    } catch (error) {
        console.error("Student Result History Error:", error);
        res.status(500).json({ success: false, message: "Unable to load result history." });
    }
};


// =====================================================
// DOWNLOAD ONE REPORT CARD PDF
//
// Regenerates the PDF from the stored snapshot and streams
// it straight from memory — NOTHING is written to disk — so
// a preview/reprint always reflects the published (and any
// corrected) result. Mounted twice: admin-only under the
// exams module, and admin+receptionist under the students
// module (both reuse this same handler; RBAC is on the route).
// =====================================================

exports.getReportCard = async (req, res) => {
    const examId = Number(req.params.examId);
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(examId) || !Number.isInteger(studentId)) {
        return res.status(400).json({ success: false, message: "Invalid exam or student ID." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found." });

        const model = await snapshotResultModel(examId, studentId);
        if (!model) return res.status(404).json({ success: false, message: "No published result for this student." });

        const students = await allQuery(
            `SELECT id, studentName, rollNumber, className FROM students WHERE id = ?`,
            [studentId]
        );
        if (!students.length) return res.status(404).json({ success: false, message: "Student not found." });

        const schoolName = process.env.SCHOOL_NAME || "The Age School";
        const buffer = await generateMarksheetBuffer({
            exam: { id: exam.id, examName: exam.examName, className: exam.className, examType: exam.examType, academicYear: exam.academicYear },
            student: students[0],
            result: model.result,
            meta: { schoolName, publishedAt: model.publishedAt || exam.publishedAt }
        });

        const safe = (v) => String(v || "").replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60);
        const fileName = `ReportCard_${safe(students[0].rollNumber || students[0].studentName)}_${safe(exam.examName)}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error("Get Report Card Error:", error);
        res.status(500).json({ success: false, message: "Unable to generate report card." });
    }
};



