const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");


// =====================================================
// LIST TEACHERS
// ADMIN ONLY
// =====================================================

exports.getTeachers = async (req, res) => {
    try {
        const teachers = await allQuery(
            `SELECT id, name, email, createdAt FROM users WHERE role = 'teacher' ORDER BY name ASC`
        );

        // Attach each teacher's assigned classes with their role on each.
        for (const t of teachers) {
            const rows = await allQuery(
                `SELECT className, role FROM teacher_assignments WHERE teacherId = ? ORDER BY className ASC`,
                [t.id]
            );
            // { className, role } objects; role is 'subject_teacher' | 'class_teacher'.
            t.classes = rows.map((r) => ({ className: r.className, role: r.role || "subject_teacher" }));

            // Standing subject-teacher assignments (class + subject the teacher
            // may enter marks for). Source of truth for marks authorization.
            const subs = await allQuery(
                `SELECT sta.subjectId, s.subjectName, s.className
                 FROM subject_teacher_assignments sta
                 JOIN subjects s ON s.id = sta.subjectId
                 WHERE sta.teacherId = ?
                 ORDER BY s.className ASC, s.subjectName ASC`,
                [t.id]
            );
            t.subjects = subs;
        }

        res.json({ success: true, teachers });
    } catch (error) {
        console.error("Get Teachers Error:", error);
        res.status(500).json({ success: false, message: "Unable to load teachers." });
    }
};


// =====================================================
// ASSIGN A CLASS TO A TEACHER
// ADMIN ONLY
// =====================================================

exports.assignClass = async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const className = String(req.body?.className || "").trim();
    // 'subject_teacher' (default) or 'class_teacher'.
    const requestedRole = String(req.body?.role || "subject_teacher").trim();
    const role = requestedRole === "class_teacher" ? "class_teacher" : "subject_teacher";

    if (!Number.isInteger(teacherId) || !className) {
        return res.status(400).json({
            success: false,
            message: "Teacher and class name are required."
        });
    }

    try {
        const teacher = await allQuery(
            `SELECT id FROM users WHERE id = ? AND role = 'teacher'`,
            [teacherId]
        );

        if (teacher.length === 0) {
            return res.status(404).json({ success: false, message: "Teacher not found." });
        }

        // Confirm the class exists in the classes table.
        const cls = await allQuery(
            `SELECT id FROM classes WHERE className = ? LIMIT 1`,
            [className]
        );
        if (cls.length === 0) {
            return res.status(404).json({ success: false, message: "Class not found." });
        }

        // A class has at most one class teacher: demote any existing class
        // teacher of this class before promoting a new one.
        if (role === "class_teacher") {
            await runQuery(
                `UPDATE teacher_assignments SET role = 'subject_teacher' WHERE className = ? AND role = 'class_teacher' AND teacherId != ?`,
                [className, teacherId]
            );
        }

        // Upsert the assignment, updating the role if it already exists.
        await runQuery(
            `INSERT INTO teacher_assignments (teacherId, className, assignedBy, role)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(teacherId, className) DO UPDATE SET role = excluded.role`,
            [teacherId, className, req.user.id, role]
        );

        await logAudit({
            userId: req.user.id,
            action: "TEACHER_CLASS_ASSIGNED",
            entityType: "teacher_assignment",
            entityId: teacherId,
            details: { teacherId, className, role }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Class assigned to teacher." });
    } catch (error) {
        console.error("Assign Class Error:", error);
        res.status(500).json({ success: false, message: "Unable to assign class." });
    }
};


// =====================================================
// REMOVE A CLASS ASSIGNMENT
// ADMIN ONLY
// =====================================================

exports.unassignClass = async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const className = String(req.body?.className || "").trim();

    if (!Number.isInteger(teacherId) || !className) {
        return res.status(400).json({
            success: false,
            message: "Teacher and class name are required."
        });
    }

    try {
        await runQuery(
            `DELETE FROM teacher_assignments WHERE teacherId = ? AND className = ?`,
            [teacherId, className]
        );

        await logAudit({
            userId: req.user.id,
            action: "TEACHER_CLASS_UNASSIGNED",
            entityType: "teacher_assignment",
            entityId: teacherId,
            details: { teacherId, className }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Class assignment removed." });
    } catch (error) {
        console.error("Unassign Class Error:", error);
        res.status(500).json({ success: false, message: "Unable to remove assignment." });
    }
};


// =====================================================
// SUBJECTS: LIST (optionally by class)
// ADMIN ONLY
// =====================================================

exports.getSubjects = async (req, res) => {
    const className = req.query.className ? String(req.query.className).trim() : null;

    try {
        const rows = className
            ? await allQuery(
                `SELECT id, className, subjectName, maxMarks FROM subjects WHERE className = ? ORDER BY subjectName ASC`,
                [className]
            )
            : await allQuery(
                `SELECT id, className, subjectName, maxMarks FROM subjects ORDER BY className ASC, subjectName ASC`
            );

        res.json({ success: true, subjects: rows });
    } catch (error) {
        console.error("Get Subjects Error:", error);
        res.status(500).json({ success: false, message: "Unable to load subjects." });
    }
};


// =====================================================
// SUBJECTS: CREATE
// ADMIN ONLY
// =====================================================

exports.createSubject = async (req, res) => {
    const className = String(req.body?.className || "").trim();
    const subjectName = String(req.body?.subjectName || "").trim();
    const maxMarks = Number(req.body?.maxMarks);

    if (!className || !subjectName) {
        return res.status(400).json({
            success: false,
            message: "Class and subject name are required."
        });
    }

    const finalMax = Number.isFinite(maxMarks) && maxMarks > 0 ? maxMarks : 100;

    try {
        const existing = await allQuery(
            `SELECT id FROM subjects WHERE className = ? AND subjectName = ?`,
            [className, subjectName]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: "Subject already exists for this class." });
        }

        const result = await runQuery(
            `INSERT INTO subjects (className, subjectName, maxMarks) VALUES (?, ?, ?)`,
            [className, subjectName, finalMax]
        );

        res.status(201).json({
            success: true,
            message: "Subject created.",
            subject: { id: result.lastID, className, subjectName, maxMarks: finalMax }
        });
    } catch (error) {
        console.error("Create Subject Error:", error);
        res.status(500).json({ success: false, message: "Unable to create subject." });
    }
};


// =====================================================
// SUBJECTS: DELETE
// ADMIN ONLY
// =====================================================

exports.deleteSubject = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: "Invalid subject ID." });
    }

    try {
        // Block deletion if the subject is used in any exam marks.
        const used = await allQuery(
            `SELECT 1 FROM exam_marks WHERE subjectId = ? LIMIT 1`,
            [id]
        );
        if (used.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete a subject that already has marks recorded."
            });
        }

        const result = await runQuery(`DELETE FROM subjects WHERE id = ?`, [id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Subject not found." });
        }

        res.json({ success: true, message: "Subject deleted." });
    } catch (error) {
        console.error("Delete Subject Error:", error);
        res.status(500).json({ success: false, message: "Unable to delete subject." });
    }
};


// =====================================================
// MY ASSIGNED CLASSES
// TEACHER (and admin)
// =====================================================

exports.getMyClasses = async (req, res) => {
    try {
        // Classes the teacher can see come from BOTH assignment sources:
        // class-level assignments (teacher_assignments) AND standing
        // subject-teacher assignments (subject_teacher_assignments -> subjects.className).
        const rows = await allQuery(
            `SELECT className FROM teacher_assignments WHERE teacherId = ?
             UNION
             SELECT s.className AS className
             FROM subject_teacher_assignments sta
             JOIN subjects s ON s.id = sta.subjectId
             WHERE sta.teacherId = ?
             ORDER BY className ASC`,
            [req.user.id, req.user.id]
        );
        res.json({ success: true, classes: rows.map((r) => r.className) });
    } catch (error) {
        console.error("Get My Classes Error:", error);
        res.status(500).json({ success: false, message: "Unable to load your classes." });
    }
};


// =====================================================
// ASSIGN A SUBJECT TO A TEACHER (SUBJECT TEACHER)
// ADMIN ONLY
//
// Standing Teacher -> Subject relationship (source of truth for
// marks authorization, Part 17). One subject teacher per subject;
// reassigning to a different teacher requires an explicit override.
// =====================================================

exports.assignSubjectTeacher = async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const subjectId = Number(req.body?.subjectId);
    const override = req.body?.override === true;

    if (!Number.isInteger(teacherId) || !Number.isInteger(subjectId)) {
        return res.status(400).json({
            success: false,
            message: "Teacher and subject are required."
        });
    }

    try {
        const teacher = await allQuery(
            `SELECT id FROM users WHERE id = ? AND role = 'teacher'`,
            [teacherId]
        );
        if (teacher.length === 0) {
            return res.status(404).json({ success: false, message: "Teacher not found." });
        }

        const subject = await allQuery(
            `SELECT id, className, subjectName FROM subjects WHERE id = ? LIMIT 1`,
            [subjectId]
        );
        if (subject.length === 0) {
            return res.status(404).json({ success: false, message: "Subject not found." });
        }

        // One subject teacher per subject. If a DIFFERENT teacher already holds
        // this subject, require an explicit admin override before reassigning.
        const held = await allQuery(
            `SELECT sta.teacherId, u.name AS teacherName
             FROM subject_teacher_assignments sta
             JOIN users u ON u.id = sta.teacherId
             WHERE sta.subjectId = ? LIMIT 1`,
            [subjectId]
        );
        if (held.length > 0 && held[0].teacherId !== teacherId && !override) {
            return res.status(409).json({
                success: false,
                requiresConfirmation: true,
                message: `${subject[0].subjectName} (${subject[0].className}) is already assigned to ${held[0].teacherName}. Reassign?`,
                currentTeacher: { id: held[0].teacherId, name: held[0].teacherName }
            });
        }

        // Upsert: the subject can belong to only one teacher (UNIQUE(subjectId)).
        await runQuery(
            `INSERT INTO subject_teacher_assignments (teacherId, subjectId, assignedBy)
             VALUES (?, ?, ?)
             ON CONFLICT(subjectId) DO UPDATE SET
                teacherId = excluded.teacherId,
                assignedBy = excluded.assignedBy`,
            [teacherId, subjectId, req.user.id]
        );

        await logAudit({
            userId: req.user.id,
            action: "TEACHER_SUBJECT_ASSIGNED",
            entityType: "subject_teacher_assignment",
            entityId: teacherId,
            details: {
                teacherId,
                subjectId,
                className: subject[0].className,
                subjectName: subject[0].subjectName,
                override
            }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Subject assigned to teacher." });
    } catch (error) {
        console.error("Assign Subject Teacher Error:", error);
        res.status(500).json({ success: false, message: "Unable to assign subject." });
    }
};


// =====================================================
// REMOVE A SUBJECT-TEACHER ASSIGNMENT
// ADMIN ONLY
// =====================================================

exports.unassignSubjectTeacher = async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const subjectId = Number(req.body?.subjectId);

    if (!Number.isInteger(teacherId) || !Number.isInteger(subjectId)) {
        return res.status(400).json({
            success: false,
            message: "Teacher and subject are required."
        });
    }

    try {
        await runQuery(
            `DELETE FROM subject_teacher_assignments WHERE teacherId = ? AND subjectId = ?`,
            [teacherId, subjectId]
        );

        await logAudit({
            userId: req.user.id,
            action: "TEACHER_SUBJECT_UNASSIGNED",
            entityType: "subject_teacher_assignment",
            entityId: teacherId,
            details: { teacherId, subjectId }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Subject assignment removed." });
    } catch (error) {
        console.error("Unassign Subject Teacher Error:", error);
        res.status(500).json({ success: false, message: "Unable to remove subject assignment." });
    }
};
