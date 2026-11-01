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
// Lists every STAFF USER (teacher, accountant, principal,
// manager, ...) LEFT JOINed to their record for the given
// date (status null when not yet marked), so the marker
// sees the whole staff roster to fill in.
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
            `SELECT u.id AS teacherId, u.name, u.email, u.role,
                    ta.status, ta.remark, COALESCE(ta.isLocked, 0) AS isLocked
             FROM users u
             LEFT JOIN teacher_attendance ta
               ON ta.teacherId = u.id AND ta.attendanceDate = ?
             ORDER BY u.name ASC`,
            [date]
        );

        // The day is considered locked as soon as ANY saved record for it is
        // locked (locks are applied to a whole date at once).
        const locked = rows.some((r) => r.isLocked === 1);

        res.json({ success: true, date, locked, records: rows });
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
        // Accept ids of ANY staff user (teacher, accountant, principal,
        // manager, ...) — attendance is now taken for all staff.
        const staff = await allQuery(`SELECT id FROM users`);
        const staffIds = new Set(staff.map((t) => t.id));

        // LOCK RULE: a locked day cannot be changed by ANYONE (not even the
        // admin) until an admin/principal unlocks it — same pattern as the
        // page-access and class locks.
        const lockedRows = await allQuery(
            `SELECT id FROM teacher_attendance WHERE attendanceDate = ? AND isLocked = 1 LIMIT 1`,
            [date]
        );
        if (lockedRows.length > 0) {
            return res.status(423).json({
                success: false,
                message: `Attendance for ${date} is locked. Unlock the day before saving changes.`
            });
        }

        let saved = 0;
        for (const r of records) {
            const teacherId = Number(r.teacherId);
            const status = String(r.status || "").trim();

            if (!staffIds.has(teacherId)) continue;         // not a real user
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

        res.json({ success: true, message: `Saved attendance for ${saved} staff member(s).`, saved });
    } catch (error) {
        console.error("Save Attendance Error:", error);
        res.status(500).json({ success: false, message: "Unable to save attendance." });
    }
};


// =====================================================
// LOCK / UNLOCK A DAY'S ATTENDANCE
//
// ADMIN and PRINCIPAL only — same pattern as the page-access
// and class locks. A locked day cannot be changed by any
// marker; unlocking hands the day back to the assigned staff
// for editing until it is locked again.
// =====================================================

async function changeDayLock(date, locked, actorId) {
    const result = await runQuery(
        `UPDATE teacher_attendance SET isLocked = ? WHERE attendanceDate = ?`,
        [locked ? 1 : 0, date]
    );

    const affected = result.changes || 0;

    await logAudit({
        userId: actorId,
        action: locked ? "TEACHER_ATTENDANCE_LOCKED" : "TEACHER_ATTENDANCE_UNLOCKED",
        entityType: "teacher_attendance",
        entityId: null,
        details: { date, affected }
    }).catch((e) => console.error("Audit Error:", e));

    return affected;
}

exports.setAttendanceLock = async (req, res) => {
    const date = String(req.body?.date || "").trim();

    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        const affected = await changeDayLock(date, true, req.user.id);
        res.json({
            success: true,
            message: affected > 0
                ? `Attendance locked for ${date} (${affected} record(s)).`
                : `Attendance locked for ${date} — nothing was saved yet.`,
            locked: true,
            affected
        });
    } catch (error) {
        console.error("Attendance Lock Error:", error);
        res.status(500).json({ success: false, message: "Unable to lock attendance." });
    }
};

exports.setAttendanceUnlock = async (req, res) => {
    const date = String(req.body?.date || "").trim();

    if (!isValidDate(date)) {
        return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    try {
        const affected = await changeDayLock(date, false, req.user.id);
        res.json({
            success: true,
            message: `Attendance unlocked for ${date} — the assigned staff can edit it again.`,
            locked: false,
            affected
        });
    } catch (error) {
        console.error("Attendance Unlock Error:", error);
        res.status(500).json({ success: false, message: "Unable to unlock attendance." });
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
            `SELECT ta.id, ta.teacherId, u.name AS teacherName, u.email, u.role,
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
        // staff users with zero rows in the range are still returned with
        // zeros. Covers ALL staff users now (teacher, accountant,
        // principal, manager, ...).
        const joinClauses = ["ta.teacherId = u.id"];
        const params = [];
        if (from) { joinClauses.push("ta.attendanceDate >= ?"); params.push(from); }
        if (to) { joinClauses.push("ta.attendanceDate <= ?"); params.push(to); }

        const rows = await allQuery(
            `SELECT u.id AS teacherId, u.name, u.email, u.role,
                    SUM(CASE WHEN ta.status = 'present'  THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN ta.status = 'absent'   THEN 1 ELSE 0 END) AS absent,
                    SUM(CASE WHEN ta.status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
                    SUM(CASE WHEN ta.status = 'leave'    THEN 1 ELSE 0 END) AS leave,
                    COUNT(ta.id) AS markedDays
             FROM users u
             LEFT JOIN teacher_attendance ta ON ${joinClauses.join(" AND ")}
             GROUP BY u.id, u.name, u.email, u.role
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


// =====================================================
// ATTENDANCE OVERVIEW
//
// Provides overall attendance statistics across ALL STAFF
// USERS for a given date range.
//
// Shared with Student Attendance page.
// =====================================================

exports.getAttendanceOverview = async (req, res) => {
    let from = req.query.from ? String(req.query.from).trim() : null;
    let to = req.query.to ? String(req.query.to).trim() : null;

    if (!from) {
        const now = new Date();
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    }
    if (!to) {
        to = new Date().toISOString().slice(0, 10);
    }

    try {
        const rows = await allQuery(
            `
            SELECT
                u.name AS teacherName,
                u.email AS teacherEmail,
                ta.attendanceDate,
                ta.status,
                ta.remark
            FROM users u
            LEFT JOIN teacher_attendance ta ON u.id = ta.teacherId AND ta.attendanceDate BETWEEN ? AND ?
            ORDER BY u.name, ta.attendanceDate DESC
            `,
            [from, to]
        );

        res.json({ success: true, from, to, overview: rows });
    } catch (error) {
        console.error("Attendance Overview Error:", error);
        res.status(500).json({ success: false, message: "Unable to load attendance overview." });
    }
};
