const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");


// Allowed daily statuses (mirrors teacher attendance).
const STATUSES = ["present", "absent", "half_day", "leave"];

function isValidDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

// Admin and principal/manager always may. A teacher may manage a class
// only if they are the CLASS TEACHER of it, or an assigned SUPPORTING
// TEACHER for it (teacher_assignments role 'class_teacher' or
// 'supporting_teacher').
async function canManageClass(user, className) {
    if (user.role === "admin" || user.role === "principal" || user.role === "manager") return true;
    const rows = await allQuery(
        `SELECT 1 FROM teacher_assignments
         WHERE teacherId = ? AND className = ?
           AND role IN ('class_teacher', 'supporting_teacher') LIMIT 1`,
        [user.id, className]
    );
    return rows.length > 0;
}

// Is this class-day frozen? One row in student_attendance_locks
// means the WHOLE class-day is locked: saves are refused for
// everyone (even admin) until admin/principal unlocks it.
async function isClassDayLocked(className, date) {
    const rows = await allQuery(
        `SELECT id FROM student_attendance_locks
         WHERE className = ? AND attendanceDate = ? LIMIT 1`,
        [className, date]
    );
    return rows.length > 0;
}


// =====================================================
// CLASSES I CAN MARK
//
// Admin/principal/manager: every class. Teachers (class
// teacher) and supporting teachers (assigned): only their
// classes. Drives the class picker.
// =====================================================

exports.getMyAttendanceClasses = async (req, res) => {
    try {
        let classNames;
        if (req.user.role === "admin" || req.user.role === "principal" || req.user.role === "manager") {
            const rows = await allQuery(
                `SELECT className FROM classes ORDER BY className ASC`
            );
            classNames = rows.map((r) => r.className);
        } else {
            const rows = await allQuery(
                `SELECT className FROM teacher_assignments
                 WHERE teacherId = ?
                   AND role IN ('class_teacher', 'supporting_teacher')
                 ORDER BY className ASC`,
                [req.user.id]
            );
            classNames = rows.map((r) => r.className);
        }
        res.json({ success: true, classes: classNames });
    } catch (error) {
        console.error("Get Attendance Classes Error:", error);
        res.status(500).json({ success: false, message: "Unable to load your classes." });
    }
};


// =====================================================
// ROSTER FOR A CLASS + DATE
//
// Lists active students of the class LEFT JOINed to their
// attendance row for the date (status null when unmarked).
// =====================================================

exports.getClassAttendance = async (req, res) => {
    const className = String(req.query.className || "").trim();
    const date = req.query.date ? String(req.query.date).trim() : todayIso();

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        if (!(await canManageClass(req.user, className))) {
            return res.status(403).json({ success: false, message: "You are not the class teacher for this class." });
        }

        const rows = await allQuery(
            `SELECT s.id AS studentId, s.studentName, s.rollNumber,
                    sa.status, sa.remark
             FROM students s
             LEFT JOIN student_attendance sa
               ON sa.studentId = s.id AND sa.attendanceDate = ?
             WHERE s.className = ? AND (s.status IS NULL OR s.status = 'active')
             ORDER BY CAST(s.rollNumber AS INTEGER), s.studentName`,
            [date, className]
        );

        const locked = await isClassDayLocked(className, date);

        res.json({ success: true, className, date, locked, records: rows });
    } catch (error) {
        console.error("Get Class Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance." });
    }
};


// =====================================================
// SAVE ATTENDANCE (bulk upsert for one class + date)
//
// Body: { className, date, records: [ { studentId, status, remark } ] }
// =====================================================

exports.saveClassAttendance = async (req, res) => {
    const className = String(req.body?.className || "").trim();
    const date = String(req.body?.date || "").trim();
    const records = Array.isArray(req.body?.records) ? req.body.records : null;

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }
    if (!records) {
        return res.status(400).json({ success: false, message: "A records array is required." });
    }

    try {
        if (!(await canManageClass(req.user, className))) {
            return res.status(403).json({ success: false, message: "You are not the class teacher for this class." });
        }

        // LOCK RULE: a locked class-day cannot be changed by ANYONE (not
        // even the admin) until an admin/principal unlocks it — same
        // pattern as the staff attendance, page-access and class locks.
        if (await isClassDayLocked(className, date)) {
            return res.status(423).json({
                success: false,
                message: `Attendance for ${className} on ${date} is locked. Unlock the day before saving changes.`
            });
        }

        // Only accept students that actually belong to this class and are active.
        const students = await allQuery(
            `SELECT id FROM students WHERE className = ? AND (status IS NULL OR status = 'active')`,
            [className]
        );
        const validIds = new Set(students.map((s) => s.id));

        let saved = 0;
        for (const r of records) {
            const studentId = Number(r.studentId);
            const status = String(r.status || "").trim();

            if (!validIds.has(studentId)) continue;     // not in this class
            if (!STATUSES.includes(status)) continue;    // invalid status -> skip

            const remark = r.remark ? String(r.remark).trim().slice(0, 500) : null;

            await runQuery(
                `INSERT INTO student_attendance (studentId, className, attendanceDate, status, remark, markedBy)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(studentId, attendanceDate)
                 DO UPDATE SET status    = excluded.status,
                               remark    = excluded.remark,
                               className = excluded.className,
                               markedBy  = excluded.markedBy,
                               updatedAt = CURRENT_TIMESTAMP`,
                [studentId, className, date, status, remark, req.user.id]
            );
            saved++;
        }

        await logAudit({
            userId: req.user.id,
            action: "STUDENT_ATTENDANCE_SAVED",
            entityType: "student_attendance",
            entityId: null,
            details: { className, date, saved }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: `Saved attendance for ${saved} student(s).`, saved });
    } catch (error) {
        console.error("Save Class Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to save attendance." });
    }
};


// =====================================================
// LOCK / UNLOCK ONE CLASS-DAY
//
// Mirrors the teacher attendance lock. Any user who manages
// the class (class teacher, assigned supporting teacher,
// admin/principal/manager) may FREEZE a finished day; only
// ADMIN and PRINCIPAL may unlock it. A locked day refuses
// saves for EVERYONE — backend is the final authority.
//
// The lock row lives in student_attendance_locks; absence
// of a row = unlocked, so unlock simply deletes it.
// =====================================================

exports.setClassAttendanceLock = async (req, res) => {
    const className = String(req.body?.className || "").trim();
    const date = String(req.body?.date || "").trim();

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        if (!(await canManageClass(req.user, className))) {
            return res.status(403).json({ success: false, message: "You are not the class teacher for this class." });
        }

        await runQuery(
            `INSERT INTO student_attendance_locks (className, attendanceDate, lockedBy)
             VALUES (?, ?, ?)
             ON CONFLICT(className, attendanceDate)
             DO UPDATE SET lockedBy = excluded.lockedBy,
                           lockedAt = CURRENT_TIMESTAMP`,
            [className, date, req.user.id]
        );

        await logAudit({
            userId: req.user.id,
            action: "STUDENT_ATTENDANCE_LOCKED",
            entityType: "student_attendance",
            entityId: null,
            details: { className, date }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            locked: true,
            message: `Attendance locked for ${className} on ${date} — no one can change it until an admin or the principal unlocks it.`
        });
    } catch (error) {
        console.error("Class Attendance Lock Error:", error);
        res.status(500).json({ success: false, message: "Unable to lock attendance." });
    }
};

exports.setClassAttendanceUnlock = async (req, res) => {
    const className = String(req.body?.className || "").trim();
    const date = String(req.body?.date || "").trim();

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        const result = await runQuery(
            `DELETE FROM student_attendance_locks WHERE className = ? AND attendanceDate = ?`,
            [className, date]
        );

        await logAudit({
            userId: req.user.id,
            action: "STUDENT_ATTENDANCE_UNLOCKED",
            entityType: "student_attendance",
            entityId: null,
            details: { className, date, removed: result.changes || 0 }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            locked: false,
            message: result.changes > 0
                ? `Attendance for ${className} on ${date} unlocked — the class can be edited again.`
                : `Attendance for ${className} on ${date} was not locked.`
        });
    } catch (error) {
        console.error("Class Attendance Unlock Error:", error);
        res.status(500).json({ success: false, message: "Unable to unlock attendance." });
    }
};


// =====================================================
// ATTENDANCE REPORT (history)
//
// Query: ?className=&from=&to=&studentId=  (className required)
// =====================================================

exports.getClassAttendanceReport = async (req, res) => {
    const className = String(req.query.className || "").trim();
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (from && !isValidDate(from)) {
        return res.status(400).json({ success: false, message: "Invalid 'from' date." });
    }
    if (to && !isValidDate(to)) {
        return res.status(400).json({ success: false, message: "Invalid 'to' date." });
    }

    try {
        if (!(await canManageClass(req.user, className))) {
            return res.status(403).json({ success: false, message: "You are not the class teacher for this class." });
        }

        const clauses = ["sa.className = ?"];
        const params = [className];

        if (from) { clauses.push("sa.attendanceDate >= ?"); params.push(from); }
        if (to) { clauses.push("sa.attendanceDate <= ?"); params.push(to); }
        if (Number.isInteger(studentId)) { clauses.push("sa.studentId = ?"); params.push(studentId); }

        const rows = await allQuery(
            `SELECT sa.id, sa.studentId, s.studentName, s.rollNumber,
                    sa.attendanceDate, sa.status, sa.remark, sa.updatedAt
             FROM student_attendance sa
             JOIN students s ON s.id = sa.studentId
             WHERE ${clauses.join(" AND ")}
             ORDER BY sa.attendanceDate DESC, CAST(s.rollNumber AS INTEGER), s.studentName`,
            params
        );

        res.json({ success: true, className, records: rows });
    } catch (error) {
        console.error("Student Attendance Report Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance report." });
    }
};


// =====================================================
// ATTENDANCE SUMMARY (per-student counts for a class)
//
// Query: ?className=&from=&to=  (className required; range optional)
// Returns EVERY active student of the class (LEFT JOIN), so a
// student with no marked days still shows with zeroed counts.
// =====================================================

exports.getClassAttendanceSummary = async (req, res) => {
    const className = String(req.query.className || "").trim();
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    if (!className) {
        return res.status(400).json({ success: false, message: "A class is required." });
    }
    if (from && !isValidDate(from)) {
        return res.status(400).json({ success: false, message: "Invalid 'from' date." });
    }
    if (to && !isValidDate(to)) {
        return res.status(400).json({ success: false, message: "Invalid 'to' date." });
    }

    try {
        if (!(await canManageClass(req.user, className))) {
            return res.status(403).json({ success: false, message: "You are not the class teacher for this class." });
        }

        // Date range lives in the JOIN's ON clause (not WHERE) so students with
        // no marked days in the range still appear with zeroed counts.
        const joinClauses = ["sa.studentId = s.id"];
        const params = [];
        if (from) { joinClauses.push("sa.attendanceDate >= ?"); params.push(from); }
        if (to) { joinClauses.push("sa.attendanceDate <= ?"); params.push(to); }

        const rows = await allQuery(
            `SELECT s.id AS studentId, s.studentName, s.rollNumber,
                    SUM(CASE WHEN sa.status = 'present'  THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN sa.status = 'absent'   THEN 1 ELSE 0 END) AS absent,
                    SUM(CASE WHEN sa.status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
                    SUM(CASE WHEN sa.status = 'leave'    THEN 1 ELSE 0 END) AS leave,
                    COUNT(sa.id) AS markedDays
             FROM students s
             LEFT JOIN student_attendance sa ON ${joinClauses.join(" AND ")}
             WHERE s.className = ? AND (s.status IS NULL OR s.status = 'active')
             GROUP BY s.id, s.studentName, s.rollNumber
             ORDER BY CAST(s.rollNumber AS INTEGER), s.studentName`,
            [...params, className]
        );

        res.json({ success: true, className, from, to, summary: rows });
    } catch (error) {
        console.error("Student Attendance Summary Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance summary." });
    }
};
