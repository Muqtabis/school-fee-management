const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");
const { MARK_STATUSES } = require("../utils/grading");


// =====================================================
// HELPERS
// =====================================================

// Is this teacher associated with this class for MARKS purposes? Admin
// always yes. A teacher qualifies only if they are the standing subject
// teacher for at least one subject in the class (Part 4/10/11: a pure
// class teacher is NOT automatically a subject teacher). Per-exam
// overrides are handled at the subject level in teacherEditableSubjectIds.
async function canTeachClass(user, className) {
    if (user.role === "admin") return true;
    const rows = await allQuery(
        `SELECT 1
         FROM subject_teacher_assignments sta
         JOIN subjects s ON s.id = sta.subjectId
         WHERE sta.teacherId = ? AND s.className = ?
         LIMIT 1`,
        [user.id, className]
    );
    return rows.length > 0;
}

async function getExam(examId) {
    const rows = await allQuery(
        `SELECT e.id, e.examName, e.className, e.status, e.examDefinitionId,
                e.createdBy, e.lockedBy, e.lockedAt, e.publishedBy, e.publishedAt,
                d.examType, d.academicYearId, d.startDate, d.endDate, d.gradingScaleId,
                ay.name AS academicYear
         FROM exams e
         LEFT JOIN exam_definitions d ON d.id = e.examDefinitionId
         LEFT JOIN academic_years ay ON ay.id = d.academicYearId
         WHERE e.id = ?`,
        [examId]
    );
    return rows[0] || null;
}

// Subjects for an exam's class, each carrying THIS exam's effective
// config: the per-exam max marks override in exam_subjects when
// present, otherwise the class default; plus admin-set pass marks,
// schedule and the RESOLVED subject teacher. The resolved teacher is
// the per-exam override (exam_subjects.teacherId) when the admin set
// one, otherwise the standing subject-teacher assignment (Part 17:
// Teacher Management is the source of truth; the exam auto-recognises
// it). One source drives the grid, validation, publishing and the
// report card.
async function getEffectiveSubjects(examId, className) {
    return allQuery(
        `SELECT s.id AS subjectId, s.subjectName,
                COALESCE(es.maxMarks, s.maxMarks) AS maxMarks,
                es.passMarks AS passMarks,
                es.examDate, es.startTime, es.endTime, es.room, es.instructions,
                COALESCE(es.teacherId, sta.teacherId) AS teacherId,
                COALESCE(u.name, u2.name) AS teacherName
         FROM subjects s
         LEFT JOIN exam_subjects es ON es.examId = ? AND es.subjectId = s.id
         LEFT JOIN users u ON u.id = es.teacherId
         LEFT JOIN subject_teacher_assignments sta ON sta.subjectId = s.id
         LEFT JOIN users u2 ON u2.id = sta.teacherId
         WHERE s.className = ?
         ORDER BY s.subjectName`,
        [examId, className]
    );
}

// Copy the class's subjects into exam_subjects for a new exam, so
// each exam carries its own editable max marks. Idempotent per
// (examId, subjectId). passMarks/schedule stay NULL until the admin
// sets them (grading falls back to a documented default).
async function seedExamSubjects(examId, className) {
    await runQuery(
        `INSERT OR IGNORE INTO exam_subjects (examId, subjectId, maxMarks)
         SELECT ?, id, maxMarks FROM subjects WHERE className = ?`,
        [examId, className]
    );
}

// Have any marks been entered for this exam yet? Used to decide when
// changing max marks needs a confirmation (spec item 2).
async function marksEntered(examId) {
    const rows = await allQuery(
        `SELECT 1 FROM exam_marks WHERE examId = ? LIMIT 1`,
        [examId]
    );
    return rows.length > 0;
}

// Which subjectIds may THIS user edit for the exam (spec items 6, 10).
// Admin: all. Teacher: ONLY the subjects for which they are the resolved
// subject teacher (per-exam override, else standing assignment — already
// resolved into `subjects[].teacherId` by getEffectiveSubjects). There is
// deliberately NO class-level fallback: being assigned to (or being the
// class teacher of) a class does NOT grant marks access to subjects the
// teacher does not teach (Part 4/10). Returns a Set of subjectIds.
async function teacherEditableSubjectIds(user, exam, subjects) {
    if (user.role === "admin") return new Set(subjects.map((s) => s.subjectId));
    const mine = subjects.filter((s) => s.teacherId != null && Number(s.teacherId) === Number(user.id));
    return new Set(mine.map((s) => s.subjectId));
}


// =====================================================
// CREATE EXAM
//
// ADMIN ONLY (route-gated). Creates ONE exam_definition
// (the exam that spans the chosen classes) plus one child
// `exams` row per class, each keeping its own subjects,
// marks, status and results. Accepts exam type, academic
// year, dates and grading scale.
// =====================================================

exports.createExam = async (req, res) => {
    const examName = String(req.body?.examName || req.body?.name || "").trim();
    const examType = String(req.body?.examType || "other").trim() || "other";
    const academicYearId = Number(req.body?.academicYearId) || null;
    const startDate = req.body?.startDate ? String(req.body.startDate) : null;
    const endDate = req.body?.endDate ? String(req.body.endDate) : null;
    const gradingScaleId = Number(req.body?.gradingScaleId) || null;

    let classNames = [];
    if (Array.isArray(req.body?.classNames)) {
        classNames = req.body.classNames.map((c) => String(c || "").trim()).filter(Boolean);
    } else if (req.body?.className) {
        classNames = [String(req.body.className).trim()].filter(Boolean);
    }
    classNames = [...new Set(classNames)];

    if (!examName || classNames.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Exam name and at least one class are required."
        });
    }

    try {
        // Parent definition: the exam as a whole, across classes.
        const defResult = await runQuery(
            `INSERT INTO exam_definitions
               (name, examType, academicYearId, startDate, endDate, status, gradingScaleId, createdBy)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
            [examName, examType, academicYearId, startDate, endDate, gradingScaleId, req.user.id]
        );
        const definitionId = defResult.lastID;

        const created = [];
        const skipped = [];

        for (const className of classNames) {
            const cls = await allQuery(
                `SELECT id FROM classes WHERE className = ? LIMIT 1`,
                [className]
            );
            if (cls.length === 0) {
                skipped.push({ className, reason: "Class not found." });
                continue;
            }

            const subjects = await allQuery(
                `SELECT id FROM subjects WHERE className = ?`,
                [className]
            );
            if (subjects.length === 0) {
                skipped.push({ className, reason: "No subjects defined for this class." });
                continue;
            }

            const result = await runQuery(
                `INSERT INTO exams (examName, className, status, createdBy, examDefinitionId)
                 VALUES (?, ?, 'open', ?, ?)`,
                [examName, className, req.user.id, definitionId]
            );
            await seedExamSubjects(result.lastID, className);
            created.push({ id: result.lastID, examName, className, status: "open" });
        }

        // A definition with no usable classes is not worth keeping.
        if (created.length === 0) {
            await runQuery(`DELETE FROM exam_definitions WHERE id = ?`, [definitionId]);
            return res.status(400).json({
                success: false,
                message: "No exams were created (classes missing or have no subjects).",
                skipped
            });
        }

        await logAudit({
            userId: req.user.id,
            action: "EXAM_CREATED",
            entityType: "exam_definition",
            entityId: definitionId,
            details: { examName, examType, classes: created.map((c) => c.className), skipped }
        }).catch((e) => console.error("Audit Error:", e));

        res.status(201).json({
            success: true,
            message: `Created ${created.length} exam(s)${skipped.length ? `, skipped ${skipped.length}` : ""}.`,
            definitionId,
            exams: created,
            skipped,
            exam: created[0]
        });
    } catch (error) {
        console.error("Create Exam Error:", error);
        res.status(500).json({ success: false, message: "Unable to create exam." });
    }
};


// =====================================================
// LIST EXAM DEFINITIONS (grouped)
//
// The new Exam page lists exams as definitions (one row
// per exam-that-spans-classes) with a rollup of its child
// per-class exams. Admin sees all; a teacher sees only
// definitions that include a class they are assigned to.
// =====================================================

exports.getExamDefinitions = async (req, res) => {
    try {
        const defs = await allQuery(
            `SELECT d.id, d.name, d.examType, d.status, d.startDate, d.endDate,
                    d.academicYearId, d.gradingScaleId, d.createdAt,
                    ay.name AS academicYear
             FROM exam_definitions d
             LEFT JOIN academic_years ay ON ay.id = d.academicYearId
             ORDER BY d.id DESC`
        );

        // Attach child exams (per class). Filter for teachers: a teacher
        // sees a definition only if it includes a class where they are the
        // standing subject teacher for at least one subject.
        let allowedClasses = null;
        if (req.user.role !== "admin") {
            const rows = await allQuery(
                `SELECT DISTINCT s.className AS className
                 FROM subject_teacher_assignments sta
                 JOIN subjects s ON s.id = sta.subjectId
                 WHERE sta.teacherId = ?`,
                [req.user.id]
            );
            allowedClasses = new Set(rows.map((r) => r.className));
        }

        const out = [];
        for (const d of defs) {
            let children = await allQuery(
                `SELECT id, className, status FROM exams WHERE examDefinitionId = ? ORDER BY className`,
                [d.id]
            );
            if (allowedClasses) {
                children = children.filter((c) => allowedClasses.has(c.className));
                if (children.length === 0) continue; // not this teacher's exam
            }
            out.push({
                ...d,
                classes: children,
                classCount: children.length,
                statuses: [...new Set(children.map((c) => c.status))]
            });
        }

        res.json({ success: true, definitions: out });
    } catch (error) {
        console.error("Get Exam Definitions Error:", error);
        res.status(500).json({ success: false, message: "Unable to load exams." });
    }
};


// =====================================================
// EXAM DEFINITION DETAIL
//
// Definition meta + its child per-class exams with a
// per-class marks-completion count, for the tabbed detail
// view's Overview. ADMIN ONLY (route-gated).
// =====================================================

exports.getExamDefinition = async (req, res) => {
    const definitionId = Number(req.params.definitionId);
    if (!Number.isInteger(definitionId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const defs = await allQuery(
            `SELECT d.id, d.name, d.examType, d.status, d.startDate, d.endDate,
                    d.academicYearId, d.gradingScaleId, d.createdAt, ay.name AS academicYear
             FROM exam_definitions d
             LEFT JOIN academic_years ay ON ay.id = d.academicYearId
             WHERE d.id = ?`,
            [definitionId]
        );
        if (!defs.length) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }

        const children = await allQuery(
            `SELECT id, className, status, lockedAt, publishedAt FROM exams
             WHERE examDefinitionId = ? ORDER BY className`,
            [definitionId]
        );

        // Marks completion per child class.
        for (const c of children) {
            const students = await allQuery(
                `SELECT COUNT(*) n FROM students WHERE className = ? AND status = 'active'`,
                [c.className]
            );
            const subjects = await allQuery(
                `SELECT COUNT(*) n FROM subjects WHERE className = ?`,
                [c.className]
            );
            const entered = await allQuery(
                `SELECT COUNT(*) n FROM exam_marks WHERE examId = ?`,
                [c.id]
            );
            c.studentCount = students[0].n;
            c.subjectCount = subjects[0].n;
            c.expectedCells = students[0].n * subjects[0].n;
            c.enteredCells = entered[0].n;
        }

        res.json({ success: true, definition: defs[0], classes: children });
    } catch (error) {
        console.error("Get Exam Definition Error:", error);
        res.status(500).json({ success: false, message: "Unable to load exam." });
    }
};


// =====================================================
// GET / SET PER-EXAM SUBJECT CONFIG
//
// Max marks, pass marks, schedule (date/time/room/notes)
// and the assigned subject teacher — all per exam/class/
// subject and independent of Class Management defaults and
// of other exams (spec items 2, 3, 5, 6). ADMIN ONLY.
// Editable only while the child exam is 'open'.
// =====================================================

exports.getExamSubjects = async (req, res) => {
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
        const subjects = await getEffectiveSubjects(examId, exam.className);
        // Teachers offered for the per-exam override dropdown. All teachers
        // are selectable so the admin can override the standing subject
        // teacher for this exam if needed (Part 17); the resolved default
        // already appears via getEffectiveSubjects.
        const teachers = await allQuery(
            `SELECT id, name FROM users WHERE role = 'teacher' ORDER BY name`
        );
        res.json({
            success: true,
            exam,
            subjects,
            teachers,
            marksEntered: await marksEntered(examId),
            editable: exam.status === "open"
        });
    } catch (error) {
        console.error("Get Exam Subjects Error:", error);
        res.status(500).json({ success: false, message: "Unable to load exam subjects." });
    }
};

exports.updateExamSubjects = async (req, res) => {
    const examId = Number(req.params.examId);
    const entries = Array.isArray(req.body?.subjects) ? req.body.subjects : null;
    const confirm = req.body?.confirm === true;

    if (!Number.isInteger(examId) || !entries) {
        return res.status(400).json({ success: false, message: "Exam ID and a subjects array are required." });
    }

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        // Published results are protected: max/pass changes go through the
        // correction workflow, not a silent edit (spec items 2, 23).
        if (exam.status === "published") {
            return res.status(409).json({
                success: false,
                message: "This exam is published. Use the result correction workflow to change marks; unpublish is not allowed."
            });
        }
        if (exam.status !== "open") {
            return res.status(409).json({ success: false, message: "Subject settings can only be changed while the exam is open." });
        }

        const classSubjects = await allQuery(`SELECT id FROM subjects WHERE className = ?`, [exam.className]);
        const validIds = new Set(classSubjects.map((s) => s.id));

        // Changing max marks after marks are entered needs confirmation.
        const current = await getEffectiveSubjects(examId, exam.className);
        const curMax = new Map(current.map((s) => [s.subjectId, Number(s.maxMarks)]));
        const alreadyHasMarks = await marksEntered(examId);
        const maxChanged = entries.some((e) => {
            const id = Number(e.subjectId);
            return validIds.has(id) && Number.isFinite(Number(e.maxMarks)) && Number(e.maxMarks) !== curMax.get(id);
        });
        if (alreadyHasMarks && maxChanged && !confirm) {
            return res.status(409).json({
                success: false,
                requiresConfirmation: true,
                message: "Marks are already entered for this exam. Changing max marks may make some entered marks exceed the new maximum. Confirm to proceed."
            });
        }

        let saved = 0;
        for (const e of entries) {
            const subjectId = Number(e.subjectId);
            if (!validIds.has(subjectId)) continue;

            const maxMarks = Number(e.maxMarks);
            if (!Number.isFinite(maxMarks) || maxMarks <= 0) continue;

            let passMarks = e.passMarks === "" || e.passMarks === null || e.passMarks === undefined
                ? null : Number(e.passMarks);
            if (passMarks !== null && (!Number.isFinite(passMarks) || passMarks < 0 || passMarks > maxMarks)) {
                return res.status(400).json({
                    success: false,
                    message: `Pass marks for a subject must be between 0 and its max (${maxMarks}).`
                });
            }

            const teacherId = Number(e.teacherId) || null;
            const examDate = e.examDate ? String(e.examDate) : null;
            const startTime = e.startTime ? String(e.startTime) : null;
            const endTime = e.endTime ? String(e.endTime) : null;
            const room = e.room ? String(e.room) : null;
            const instructions = e.instructions ? String(e.instructions) : null;

            await runQuery(
                `INSERT INTO exam_subjects
                   (examId, subjectId, maxMarks, passMarks, examDate, startTime, endTime, room, instructions, teacherId)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(examId, subjectId) DO UPDATE SET
                   maxMarks = excluded.maxMarks,
                   passMarks = excluded.passMarks,
                   examDate = excluded.examDate,
                   startTime = excluded.startTime,
                   endTime = excluded.endTime,
                   room = excluded.room,
                   instructions = excluded.instructions,
                   teacherId = excluded.teacherId`,
                [examId, subjectId, maxMarks, passMarks, examDate, startTime, endTime, room, instructions, teacherId]
            );
            saved++;
        }

        await logAudit({
            userId: req.user.id,
            action: "EXAM_SUBJECTS_UPDATED",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, className: exam.className, saved, confirmedMaxChange: maxChanged && confirm }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: `Updated ${saved} subject(s).`, saved });
    } catch (error) {
        console.error("Update Exam Subjects Error:", error);
        res.status(500).json({ success: false, message: "Unable to update subject settings." });
    }
};


// =====================================================
// LIST EXAMS (flat, per class)
//
// Used by the Marks Entry page. Admin sees all; a teacher
// sees only exams for classes they are assigned to.
// =====================================================

exports.getExams = async (req, res) => {
    try {
        let exams;
        if (req.user.role === "admin") {
            exams = await allQuery(
                `SELECT e.id, e.examName, e.className, e.status, e.examDefinitionId,
                        e.createdAt, e.lockedAt, e.publishedAt, d.examType
                 FROM exams e
                 LEFT JOIN exam_definitions d ON d.id = e.examDefinitionId
                 ORDER BY e.id DESC`
            );
        } else {
            // A teacher sees only exams for classes where they are the
            // standing subject teacher for at least one subject.
            exams = await allQuery(
                `SELECT e.id, e.examName, e.className, e.status, e.examDefinitionId,
                        e.createdAt, e.lockedAt, e.publishedAt, d.examType
                 FROM exams e
                 LEFT JOIN exam_definitions d ON d.id = e.examDefinitionId
                 WHERE e.className IN (
                     SELECT DISTINCT s.className
                     FROM subject_teacher_assignments sta
                     JOIN subjects s ON s.id = sta.subjectId
                     WHERE sta.teacherId = ?
                 )
                 ORDER BY e.id DESC`,
                [req.user.id]
            );
        }
        res.json({ success: true, exams });
    } catch (error) {
        console.error("Get Exams Error:", error);
        res.status(500).json({ success: false, message: "Unable to load exams." });
    }
};


// =====================================================
// GET MARKS GRID FOR AN EXAM
//
// Students of the exam's class, the subjects (with THIS
// exam's max + pass marks + assigned teacher), and any
// marks already entered. Each subject carries a `canEdit`
// flag reflecting subject-level teacher authorization
// (spec item 6). TEACHER (assigned) or ADMIN.
// =====================================================

exports.getExamMarks = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }

        const students = await allQuery(
            `SELECT id, studentName, rollNumber
             FROM students
             WHERE className = ? AND status = 'active'
             ORDER BY CAST(rollNumber AS INTEGER), studentName`,
            [exam.className]
        );

        await seedExamSubjects(examId, exam.className);
        const allSubjects = await getEffectiveSubjects(examId, exam.className);
        const editableIds = await teacherEditableSubjectIds(req.user, exam, allSubjects);

        // Authorization: admin sees the whole grid; a teacher may open the
        // exam only if they are the resolved subject teacher for at least
        // one subject in it (Part 6/10). No subject -> no access.
        if (req.user.role !== "admin" && editableIds.size === 0) {
            return res.status(403).json({ success: false, message: "You are not assigned to any subject in this class." });
        }

        // Teachers only SEE subjects they may edit (spec item 6); admin sees all.
        const visible = req.user.role === "admin"
            ? allSubjects
            : allSubjects.filter((s) => editableIds.has(s.subjectId));

        const subjects = visible.map((s) => ({ ...s, canEdit: editableIds.has(s.subjectId) }));

        // Read-side authorization (spec item 6): a teacher may only SEE the
        // subjects they teach, so the marks payload is scoped to those same
        // subjects — otherwise the response would leak colleagues' marks for
        // other subjects in this class. Admin sees every subject's marks.
        const visibleIds = new Set(visible.map((s) => s.subjectId));
        const allMarks = await allQuery(
            `SELECT studentId, subjectId, marksObtained, isAbsent, markStatus
             FROM exam_marks WHERE examId = ?`,
            [examId]
        );
        const marks = req.user.role === "admin"
            ? allMarks
            : allMarks.filter((m) => visibleIds.has(m.subjectId));

        res.json({
            success: true,
            exam,
            students,
            subjects,
            marks,
            editable: exam.status === "open"
        });
    } catch (error) {
        console.error("Get Exam Marks Error:", error);
        res.status(500).json({ success: false, message: "Unable to load exam marks." });
    }
};


// =====================================================
// SAVE MARKS (bulk upsert)
//
// Body: { marks: [ { studentId, subjectId, marksObtained,
//                    markStatus | isAbsent } ] }
//
// Invalid marks are REJECTED with a clear message, never
// silently clamped (spec item 9): negatives and values
// above the subject's max are refused and NOTHING is saved
// until every cell is valid. The backend is the final
// authority — a teacher cannot bypass this via the API, and
// may only write subjects they are authorized for (item 6).
//
// TEACHER (assigned) or ADMIN. Only while status = 'open'.
// =====================================================

exports.saveExamMarks = async (req, res) => {
    const examId = Number(req.params.examId);
    const entries = Array.isArray(req.body?.marks) ? req.body.marks : null;

    if (!Number.isInteger(examId) || !entries) {
        return res.status(400).json({ success: false, message: "Exam ID and a marks array are required." });
    }

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        if (exam.status !== "open") {
            return res.status(409).json({
                success: false,
                message: "Marks are locked for this exam and can no longer be edited."
            });
        }

        const subjects = await getEffectiveSubjects(examId, exam.className);
        const subjectById = new Map(subjects.map((s) => [s.subjectId, s]));
        const editableIds = await teacherEditableSubjectIds(req.user, exam, subjects);

        // A teacher with no editable subject in this exam is not authorized
        // to write any marks (Part 10/30). Admin always passes.
        if (req.user.role !== "admin" && editableIds.size === 0) {
            return res.status(403).json({ success: false, message: "You are not assigned to any subject in this class." });
        }

        // --- Pass 1: validate everything; reject on the first bad cell. ---
        const errors = [];
        const clean = [];
        for (const e of entries) {
            const studentId = Number(e.studentId);
            const subjectId = Number(e.subjectId);
            if (!Number.isInteger(studentId) || !Number.isInteger(subjectId)) continue;

            const subj = subjectById.get(subjectId);
            if (!subj) continue; // subject not in this class — ignore silently

            if (!editableIds.has(subjectId)) {
                errors.push(`You are not authorized to enter marks for "${subj.subjectName}".`);
                continue;
            }

            const status = String(e.markStatus || (e.isAbsent ? "absent" : "present")).toLowerCase();
            if (!MARK_STATUSES.includes(status)) {
                errors.push(`Invalid status for "${subj.subjectName}".`);
                continue;
            }

            let marksObtained = null;
            if (status === "present") {
                const raw = Number(e.marksObtained);
                if (e.marksObtained === "" || e.marksObtained === null || e.marksObtained === undefined || !Number.isFinite(raw)) {
                    // A present cell with no number is simply not entered yet — skip it.
                    continue;
                }
                const max = Number(subj.maxMarks) || 0;
                if (raw < 0) {
                    errors.push(`"${subj.subjectName}": marks cannot be negative.`);
                    continue;
                }
                if (raw > max) {
                    errors.push(`"${subj.subjectName}": ${raw} exceeds the maximum of ${max}.`);
                    continue;
                }
                marksObtained = raw;
            }

            clean.push({ studentId, subjectId, marksObtained, status });
        }

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: errors[0],
                errors: [...new Set(errors)]
            });
        }

        // --- Pass 2: write. ---
        let saved = 0;
        for (const c of clean) {
            const isAbsent = c.status === "absent" ? 1 : 0;
            await runQuery(
                `INSERT INTO exam_marks (examId, studentId, subjectId, marksObtained, isAbsent, markStatus, updatedBy)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(examId, studentId, subjectId)
                 DO UPDATE SET marksObtained = excluded.marksObtained,
                               isAbsent      = excluded.isAbsent,
                               markStatus    = excluded.markStatus,
                               updatedBy     = excluded.updatedBy`,
                [examId, c.studentId, c.subjectId, c.marksObtained, isAbsent, c.status, req.user.id]
            );
            saved++;
        }

        res.json({ success: true, message: `Saved ${saved} mark(s).`, saved });
    } catch (error) {
        console.error("Save Exam Marks Error:", error);
        res.status(500).json({ success: false, message: "Unable to save marks." });
    }
};


// =====================================================
// LOCK / SUBMIT MARKS
//
// The teacher signals they are done (OPEN -> LOCKED, the
// "teacher submitted / under review" state). Marks become
// read-only until an admin publishes or returns the exam.
// Warns when marks are incomplete unless overridden
// (spec item 11). TEACHER (assigned) or ADMIN.
// =====================================================

exports.lockExam = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    const override = req.body?.override === true;

    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        if (exam.status !== "open") {
            return res.status(409).json({ success: false, message: `Exam is already ${exam.status}.` });
        }

        // Completeness check over the subjects this user is responsible for.
        const subjects = await getEffectiveSubjects(examId, exam.className);
        const editableIds = await teacherEditableSubjectIds(req.user, exam, subjects);

        // A teacher must own at least one subject in this exam to lock it.
        // Admin may lock regardless (they own the whole grid).
        if (req.user.role !== "admin" && editableIds.size === 0) {
            return res.status(403).json({ success: false, message: "You are not assigned to any subject in this class." });
        }
        const students = await allQuery(
            `SELECT id FROM students WHERE className = ? AND status = 'active'`,
            [exam.className]
        );
        const entered = await allQuery(
            `SELECT studentId, subjectId FROM exam_marks WHERE examId = ?`,
            [examId]
        );
        const enteredKey = new Set(entered.map((m) => `${m.studentId}:${m.subjectId}`));
        let missing = 0;
        for (const st of students) {
            for (const sid of editableIds) {
                if (!enteredKey.has(`${st.id}:${sid}`)) missing++;
            }
        }
        if (missing > 0 && !override) {
            return res.status(409).json({
                success: false,
                requiresConfirmation: true,
                missing,
                message: `${missing} mark cell(s) are still empty. Lock anyway? Empty cells will be treated as not entered.`
            });
        }

        await runQuery(
            `UPDATE exams SET status = 'locked', lockedBy = ?, lockedAt = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.user.id, examId]
        );
        await logAudit({
            userId: req.user.id,
            action: "EXAM_LOCKED",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName, className: exam.className, missing, override }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Marks submitted and locked. The admin can now review and publish." });
    } catch (error) {
        console.error("Lock Exam Error:", error);
        res.status(500).json({ success: false, message: "Unable to lock exam." });
    }
};


// =====================================================
// UNLOCK / RETURN MARKS (admin correction path)
//
// ADMIN ONLY (route-gated). Returns a locked exam to 'open'
// so a teacher can fix a mistake before publishing. Not
// allowed once published (use the correction workflow).
// =====================================================

exports.unlockExam = async (req, res) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId)) {
        return res.status(400).json({ success: false, message: "Invalid exam ID." });
    }
    try {
        const exam = await getExam(examId);
        if (!exam) {
            return res.status(404).json({ success: false, message: "Exam not found." });
        }
        if (exam.status !== "locked") {
            return res.status(409).json({
                success: false,
                message: `Only a locked exam can be returned for editing (current: ${exam.status}).`
            });
        }

        await runQuery(
            `UPDATE exams SET status = 'open', lockedBy = NULL, lockedAt = NULL WHERE id = ?`,
            [examId]
        );
        await logAudit({
            userId: req.user.id,
            action: "EXAM_UNLOCKED",
            entityType: "exam",
            entityId: examId,
            details: { examName: exam.examName }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Exam returned to teachers for editing." });
    } catch (error) {
        console.error("Unlock Exam Error:", error);
        res.status(500).json({ success: false, message: "Unable to unlock exam." });
    }
};


// Shared helpers other controllers (results/delivery) reuse.
exports._helpers = {
    getExam,
    getEffectiveSubjects,
    seedExamSubjects,
    canTeachClass
};





