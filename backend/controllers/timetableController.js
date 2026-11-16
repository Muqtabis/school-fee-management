const db = require("../db");
const logAudit = require("../utils/auditLogger");

// =====================================================
// TIMETABLE
//
// The weekly class timetable. One row in `timetable_slots`
// per (class, day, period) cell; a cell may be a free period
// (no subject / no teacher). READ endpoints are open to all
// staff roles — teachers see their own schedule, the class
// teacher (teacher_assignments.role = 'class_teacher') can
// open the whole class grid. WRITES are gated by the
// "timetable" page grant (admin always passes) and are the
// only writes here — every other query is a SELECT.
// =====================================================

// Promisified helpers (same pattern as the other controllers).
const allQ = (sql, params = []) =>
    new Promise((resolve, reject) => db.all(sql, params, (e, r) => (e ? reject(e) : resolve(r || []))));
const runQ = (sql, params = []) =>
    new Promise((resolve, reject) => db.run(sql, params, (e) => (e ? reject(e) : resolve())));

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const MAX_ROWS = 12;

// Stable day ordering inside SQL (constants only — no user input).
const DAY_ORDER_SQL = `CASE dayOfWeek ${DAYS.map((d, i) => `WHEN '${d}' THEN ${i}`).join(" ")} ELSE 99 END`;

const CLASS_ORDER = `CAST(NULLIF(className,'') AS INTEGER) ASC, className ASC`;

// =====================================================
// CLASSES FOR THE DROPDOWN
// Admin / staff: every class. Teacher / supporting_teacher:
// only the classes they are linked to (same union the Marks
// Entry "my-classes" endpoint uses).
// =====================================================
exports.listClasses = async (req, res) => {
    try {
        let rows;
        if (req.user.role === "teacher" || req.user.role === "supporting_teacher") {
            rows = await allQ(
                `SELECT c.className, c.section
                 FROM classes c
                 WHERE c.className IN (
                     SELECT className FROM teacher_assignments WHERE teacherId = ?
                     UNION
                     SELECT s.className
                     FROM subject_teacher_assignments sta
                     JOIN subjects s ON s.id = sta.subjectId
                     WHERE sta.teacherId = ?
                 )
                 ORDER BY ${CLASS_ORDER}, c.section ASC`,
                [req.user.id, req.user.id]
            );
        } else {
            rows = await allQ(
                `SELECT className, section FROM classes
                 ORDER BY ${CLASS_ORDER}, section ASC`
            );
        }
        res.json({ success: true, classes: rows });
    } catch (error) {
        console.error("Timetable listClasses Error:", error);
        res.status(500).json({ success: false, message: "Unable to load classes." });
    }
};

// =====================================================
// ONE CLASS'S FULL WEEK GRID (read-only)
// Flat slots grouped into period rows with one cell per day.
// =====================================================
exports.getTimetable = async (req, res) => {
    try {
        const className = String(req.params.className || "");

        const exists = await allQ(`SELECT 1 FROM classes WHERE className = ? LIMIT 1`, [className]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: "Class not found." });
        }

        const slots = await allQ(
            `SELECT
                t.periodNumber, t.startTime, t.endTime, t.dayOfWeek,
                t.subjectId, s.subjectName, t.teacherId, u.name AS teacherName
             FROM timetable_slots t
             LEFT JOIN subjects s ON s.id = t.subjectId
             LEFT JOIN users u ON u.id = t.teacherId
             WHERE t.className = ?
             ORDER BY t.periodNumber ASC, ${DAY_ORDER_SQL} ASC`,
            [className]
        );

        const rowMap = {};
        slots.forEach((s) => {
            if (!rowMap[s.periodNumber]) {
                rowMap[s.periodNumber] = {
                    periodNumber: s.periodNumber,
                    startTime: s.startTime || "",
                    endTime: s.endTime || "",
                    cells: {}
                };
            }
            rowMap[s.periodNumber].cells[s.dayOfWeek] = {
                subjectId: s.subjectId || null,
                subjectName: s.subjectName || "",
                teacherId: s.teacherId || null,
                teacherName: s.teacherName || ""
            };
        });

        const rows = Object.values(rowMap).sort((a, b) => a.periodNumber - b.periodNumber);
        res.json({ success: true, className, days: DAYS, rows });
    } catch (error) {
        console.error("Timetable getTimetable Error:", error);
        res.status(500).json({ success: false, message: "Unable to load the timetable." });
    }
};

// =====================================================
// MY SCHEDULE — the logged-in staff member's own slots
// (teachers / supporting teachers normally; other roles just
// get an empty list, which keeps the page safe for everyone).
// =====================================================
exports.getMySchedule = async (req, res) => {
    try {
        const slots = await allQ(
            `SELECT
                t.className, t.dayOfWeek, t.periodNumber, t.startTime, t.endTime,
                t.subjectId, s.subjectName
             FROM timetable_slots t
             LEFT JOIN subjects s ON s.id = t.subjectId
             WHERE t.teacherId = ?
             ORDER BY ${DAY_ORDER_SQL} ASC,
                      CASE WHEN t.startTime IS NULL OR t.startTime = '' THEN 1 ELSE 0 END ASC,
                      t.startTime ASC, t.periodNumber ASC`,
            [req.user.id]
        );
        res.json({ success: true, days: DAYS, slots });
    } catch (error) {
        console.error("Timetable getMySchedule Error:", error);
        res.status(500).json({ success: false, message: "Unable to load your schedule." });
    }
};

// =====================================================
// MY CLASS TIMETABLES — classes where this staff member is
// the CLASS TEACHER (teacher_assignments.role = 'class_teacher').
// Each returned class can then be opened with GET /:className.
// =====================================================
exports.getMyClassTimetables = async (req, res) => {
    try {
        const rows = await allQ(
            `SELECT className FROM teacher_assignments
             WHERE teacherId = ? AND role = 'class_teacher'
             ORDER BY ${CLASS_ORDER}`,
            [req.user.id]
        );
        res.json({ success: true, classes: rows.map((r) => r.className) });
    } catch (error) {
        console.error("Timetable getMyClassTimetables Error:", error);
        res.status(500).json({ success: false, message: "Unable to load your class timetables." });
    }
};

// =====================================================
// EDITOR META — the class's subject list (cell dropdown) and
// the staff who can be placed in a cell (teacher dropdown).
// Gated by the "timetable" page grant in the router.
// =====================================================
exports.getEditorMeta = async (req, res) => {
    try {
        const className = String(req.query.className || "");
        if (!className) {
            return res.status(400).json({ success: false, message: "className is required." });
        }

        const subjects = await allQ(
            `SELECT id, subjectName FROM subjects WHERE className = ? ORDER BY subjectName ASC`,
            [className]
        );
        const teachers = await allQ(
            `SELECT id, name, role FROM users
             WHERE role IN ('teacher', 'supporting_teacher', 'principal', 'manager')
             ORDER BY name ASC`
        );

        res.json({ success: true, subjects, teachers });
    } catch (error) {
        console.error("Timetable getEditorMeta Error:", error);
        res.status(500).json({ success: false, message: "Unable to load editor data." });
    }
};

// =====================================================
// SAVE ONE CLASS'S WHOLE GRID
// Body: { rows: [ { periodNumber, startTime, endTime,
//                  cells: [ { day, subjectId, teacherId } ] } ] }
//
// The client always sends all six day cells per period (an
// empty cell = free period), so a "break" row with only
// times survives the reload too. The class's previous grid
// is replaced inside a transaction. A teacher cannot be in
// two classes at the same day+period — the save is rejected
// with a clear message naming the clash.
// =====================================================
exports.saveTimetable = async (req, res) => {
    try {
        const className = String(req.params.className || "");
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;

        if (!rows) {
            return res.status(400).json({ success: false, message: "rows are required." });
        }
        if (rows.length < 1 || rows.length > MAX_ROWS) {
            return res.status(400).json({
                success: false,
                message: `A timetable needs between 1 and ${MAX_ROWS} periods.`
            });
        }

        const cls = await allQ(`SELECT 1 FROM classes WHERE className = ? LIMIT 1`, [className]);
        if (cls.length === 0) {
            return res.status(404).json({ success: false, message: "Class not found." });
        }

        // --- validate everything BEFORE touching the table ---
        const inserts = [];       // flat rows for timetable_slots
        const seenPeriods = new Set();
        const teacherSlots = [];  // for the cross-class clash check

        for (const row of rows) {
            const periodNumber = Number(row?.periodNumber);
            if (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 15) {
                return res.status(400).json({
                    success: false,
                    message: "Each period needs a whole number between 1 and 15."
                });
            }
            if (seenPeriods.has(periodNumber)) {
                return res.status(400).json({
                    success: false,
                    message: `Period ${periodNumber} appears more than once.`
                });
            }
            seenPeriods.add(periodNumber);

            const startTime = String(row?.startTime || "").trim();
            const endTime = String(row?.endTime || "").trim();
            if (startTime && !TIME_RE.test(startTime)) {
                return res.status(400).json({ success: false, message: `Invalid start time "${startTime}" (use HH:MM).` });
            }
            if (endTime && !TIME_RE.test(endTime)) {
                return res.status(400).json({ success: false, message: `Invalid end time "${endTime}" (use HH:MM).` });
            }

            const cells = Array.isArray(row?.cells) ? row.cells : [];
            const seenDays = new Set();
            for (const cell of cells) {
                const day = String(cell?.day || "");
                if (!DAYS.includes(day)) {
                    return res.status(400).json({ success: false, message: `Invalid day "${day}".` });
                }
                if (seenDays.has(day)) {
                    return res.status(400).json({
                        success: false,
                        message: `${day} appears twice in period ${periodNumber}.`
                    });
                }
                seenDays.add(day);

                let subjectId = cell.subjectId == null || cell.subjectId === "" ? null : Number(cell.subjectId);
                let teacherId = cell.teacherId == null || cell.teacherId === "" ? null : Number(cell.teacherId);

                if (subjectId != null) {
                    if (!Number.isInteger(subjectId)) {
                        return res.status(400).json({ success: false, message: "Invalid subject selection." });
                    }
                    const ok = await allQ(
                        `SELECT 1 FROM subjects WHERE id = ? AND className = ? LIMIT 1`,
                        [subjectId, className]
                    );
                    if (ok.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "One of the selected subjects does not belong to this class."
                        });
                    }
                }
                if (teacherId != null) {
                    if (!Number.isInteger(teacherId)) {
                        return res.status(400).json({ success: false, message: "Invalid teacher selection." });
                    }
                    const ok = await allQ(`SELECT 1 FROM users WHERE id = ? LIMIT 1`, [teacherId]);
                    if (ok.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "One of the selected teachers does not exist."
                        });
                    }
                    teacherSlots.push({ day, periodNumber, teacherId });
                }

                inserts.push([
                    className, day, periodNumber,
                    startTime || null, endTime || null,
                    subjectId, teacherId, req.user.id
                ]);
            }
        }

        // --- double-booking: same teacher, same day+period, another class ---
        for (const ts of teacherSlots) {
            const clash = await allQ(
                `SELECT className FROM timetable_slots
                 WHERE dayOfWeek = ? AND periodNumber = ? AND teacherId = ? AND className != ?
                 LIMIT 1`,
                [ts.day, ts.periodNumber, ts.teacherId, className]
            );
            if (clash.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Double booking: this teacher is already set for ${clash[0].className} on ${ts.day}, period ${ts.periodNumber}.`
                });
            }
        }

        // --- replace the class's grid in one transaction ---
        await runQ(`BEGIN IMMEDIATE`);
        try {
            await runQ(`DELETE FROM timetable_slots WHERE className = ?`, [className]);
            for (const row of inserts) {
                await runQ(
                    `INSERT INTO timetable_slots
                     (className, dayOfWeek, periodNumber, startTime, endTime, subjectId, teacherId, createdBy)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    row
                );
            }
            await runQ(`COMMIT`);
        } catch (txError) {
            await runQ(`ROLLBACK`).catch(() => {});
            throw txError;
        }

        logAudit({
            userId: req.user.id,
            action: "timetable_saved",
            entityType: "timetable",
            entityId: className,
            details: { periods: seenPeriods.size, slots: inserts.length }
        });

        res.json({ success: true, message: "Timetable saved." });
    } catch (error) {
        console.error("Timetable saveTimetable Error:", error);
        res.status(500).json({ success: false, message: "Unable to save the timetable." });
    }
};
