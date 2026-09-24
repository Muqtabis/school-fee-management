const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");


// Allowed daily statuses.
const STATUSES = ["present", "absent", "half_day", "leave"];

// Basic YYYY-MM-DD shape check.
function isValidDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}


// =====================================================
// ATTENDANCE FOR A DATE
//
// Lists every teacher LEFT JOINed to their record for
// the given date (status null when not yet marked), so
// the marker sees the whole staff roster to fill in.
//
// MARKER (granted teacher_attendance) or ADMIN.
// =====================================================

exports.getAttendanceForDate = async (req, res) => {
    const date = req.query.date ? String(req.query.date).trim() : todayIso();

    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        const rows = await allQuery(
            `SELECT u.id AS teacherId, u.name, u.email,
                    ta.status, ta.remark
             FROM users u
             LEFT JOIN teacher_attendance ta
               ON ta.teacherId = u.id AND ta.attendanceDate = ?
             WHERE u.role = 'teacher'
             ORDER BY u.name ASC`,
            [date]
        );

        res.json({ success: true, date, records: rows });
    } catch (error) {
        console.error("Get Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance." });
    }
};


// =====================================================
// SAVE ATTENDANCE (bulk upsert for one date)
//
// Body: { date, records: [ { teacherId, status, remark } ] }
//
// MARKER (granted teacher_attendance) or ADMIN.
// =====================================================

exports.saveAttendance = async (req, res) => {
    const date = String(req.body?.date || "").trim();
    const records = Array.isArray(req.body?.records) ? req.body.records : null;

    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }
    if (!records) {
        return res.status(400).json({ success: false, message: "A records array is required." });
    }

    try {
        // Only accept teacherIds that are actually teachers.
        const teachers = await allQuery(`SELECT id FROM users WHERE role = 'teacher'`);
        const teacherIds = new Set(teachers.map((t) => t.id));

        let saved = 0;
        for (const r of records) {
            const teacherId = Number(r.teacherId);
            const status = String(r.status || "").trim();

            if (!teacherIds.has(teacherId)) continue;      // not a teacher
            if (!STATUSES.includes(status)) continue;       // invalid status -> skip

            const remark = r.remark ? String(r.remark).trim().slice(0, 500) : null;

            await runQuery(
                `INSERT INTO teacher_attendance (teacherId, attendanceDate, status, remark, markedBy)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(teacherId, attendanceDate)
                 DO UPDATE SET status    = excluded.status,
                               remark    = excluded.remark,
                               markedBy  = excluded.markedBy,
                               updatedAt = CURRENT_TIMESTAMP`,
                [teacherId, date, status, remark, req.user.id]
            );
            saved++;
        }

        await logAudit({
            userId: req.user.id,
            action: "TEACHER_ATTENDANCE_SAVED",
            entityType: "teacher_attendance",
            entityId: null,
            details: { date, saved }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: `Saved attendance for ${saved} teacher(s).`, saved });
    } catch (error) {
        console.error("Save Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to save attendance." });
    }
};


// =====================================================
// ATTENDANCE REPORT (history)
//
// Query: ?from=&to=&teacherId=  (all optional)
// Defaults to the current month when no range given.
//
// MARKER (granted teacher_attendance) or ADMIN.
// =====================================================

exports.getAttendanceReport = async (req, res) => {
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;

    if (from && !isValidDate(from)) {
        return res.status(400).json({ success: false, message: "Invalid 'from' date." });
    }
    if (to && !isValidDate(to)) {
        return res.status(400).json({ success: false, message: "Invalid 'to' date." });
    }

    try {
        const clauses = [];
        const params = [];

        if (from) { clauses.push("ta.attendanceDate >= ?"); params.push(from); }
        if (to) { clauses.push("ta.attendanceDate <= ?"); params.push(to); }
        if (Number.isInteger(teacherId)) { clauses.push("ta.teacherId = ?"); params.push(teacherId); }

        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

        const rows = await allQuery(
            `SELECT ta.id, ta.teacherId, u.name AS teacherName, u.email,
                    ta.attendanceDate, ta.status, ta.remark, ta.updatedAt
             FROM teacher_attendance ta
             JOIN users u ON u.id = ta.teacherId
             ${where}
             ORDER BY ta.attendanceDate DESC, u.name ASC`,
            params
        );

        res.json({ success: true, records: rows });
    } catch (error) {
        console.error("Attendance Report Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance report." });
    }
};


// =====================================================
// ATTENDANCE SUMMARY (per-teacher counts over a range)
//
// Query: ?from=&to=  (both optional; no range = all time)
// Returns EVERY teacher (LEFT JOIN), so a teacher with no
// marked days still appears with zeroed counts. Powers the
// per-teacher stats on the Teacher Management page.
//
// MARKER (granted teacher_attendance) or ADMIN.
// =====================================================

exports.getAttendanceSummary = async (req, res) => {
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    if (from && !isValidDate(from)) {
        return res.status(400).json({ success: false, message: "Invalid 'from' date." });
    }
    if (to && !isValidDate(to)) {
        return res.status(400).json({ success: false, message: "Invalid 'to' date." });
    }

    try {
        // Date range is applied in the JOIN's ON clause (not WHERE) so that
        // teachers with zero rows in the range are still returned with zeros.
        const joinClauses = ["ta.teacherId = u.id"];
        const params = [];
        if (from) { joinClauses.push("ta.attendanceDate >= ?"); params.push(from); }
        if (to) { joinClauses.push("ta.attendanceDate <= ?"); params.push(to); }

        const rows = await allQuery(
            `SELECT u.id AS teacherId, u.name, u.email,
                    SUM(CASE WHEN ta.status = 'present'  THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN ta.status = 'absent'   THEN 1 ELSE 0 END) AS absent,
                    SUM(CASE WHEN ta.status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
                    SUM(CASE WHEN ta.status = 'leave'    THEN 1 ELSE 0 END) AS leave,
                    COUNT(ta.id) AS markedDays
             FROM users u
             LEFT JOIN teacher_attendance ta ON ${joinClauses.join(" AND ")}
             WHERE u.role = 'teacher'
             GROUP BY u.id, u.name, u.email
             ORDER BY u.name ASC`,
            params
        );

        res.json({ success: true, from, to, summary: rows });
    } catch (error) {
        console.error("Attendance Summary Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance summary." });
    }
};


// =====================================================
// MY ATTENDANCE (teacher self-view, read-only)
//
// Query: ?from=&to=  (optional; defaults to current month)
//
// TEACHER (and admin). Only returns the caller's rows.
// =====================================================

exports.getMyAttendance = async (req, res) => {
    let from = req.query.from ? String(req.query.from).trim() : null;
    let to = req.query.to ? String(req.query.to).trim() : null;

    // Default to the current calendar month.
    if (!from || !to) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        from = from || `${y}-${m}-01`;
        to = to || `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    }

    if (!isValidDate(from) || !isValidDate(to)) {
        return res.status(400).json({ success: false, message: "Invalid date range." });
    }

    try {
        const rows = await allQuery(
            `SELECT attendanceDate, status, remark
             FROM teacher_attendance
             WHERE teacherId = ? AND attendanceDate >= ? AND attendanceDate <= ?
             ORDER BY attendanceDate DESC`,
            [req.user.id, from, to]
        );

        res.json({ success: true, from, to, records: rows });
    } catch (error) {
        console.error("My Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to load your attendance." });
    }
};
