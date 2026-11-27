// =====================================================
// TESTS — simple class-wise test records (date, max marks,
// min marks). Mirrors the lightweight notice CRUD pattern.
// =====================================================
const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");

exports.listTests = async (req, res) => {
    try {
        const rows = await allQuery(
            `SELECT * FROM tests ORDER BY testDate DESC, id DESC`
        );
        res.json(rows);
    } catch (e) {
        console.error("List tests error:", e);
        res.status(500).json({ success: false, message: "Unable to load tests." });
    }
};

const readBody = (body) => ({
    title: String(body?.title || "").trim(),
    className: String(body?.className || "").trim(),
    testDate: body?.testDate ? String(body.testDate).slice(0, 10) : "",
    maxMarks: Number(body?.maxMarks),
    minMarks: Number(body?.minMarks || 0)
});

const valid = (t) => {
    if (!t.className || !t.testDate) return "Class and date are required.";
    if (!Number.isFinite(t.maxMarks) || t.maxMarks <= 0) return "Enter a valid max marks.";
    if (!Number.isFinite(t.minMarks) || t.minMarks < 0) return "Enter a valid min marks.";
    if (t.minMarks > t.maxMarks) return "Min marks cannot exceed max marks.";
    return null;
};

exports.createTest = async (req, res) => {
    const t = readBody(req.body);
    const problem = valid(t);
    if (problem) return res.status(400).json({ success: false, message: problem });
    try {
        const r = await runQuery(
            `INSERT INTO tests (title, className, testDate, maxMarks, minMarks, createdBy, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [t.title || null, t.className, t.testDate, t.maxMarks, t.minMarks, req.user.id, new Date().toISOString()]
        );
        logAudit({ userId: req.user.id, action: "TEST_CREATED", entityType: "test", entityId: r.lastID,
            details: { className: t.className, testDate: t.testDate } }).catch(() => {});
        res.status(201).json({ success: true, id: r.lastID, message: "Test added." });
    } catch (e) {
        console.error("Create test error:", e);
        res.status(500).json({ success: false, message: "Unable to add test." });
    }
};

exports.updateTest = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    const t = readBody(req.body);
    const problem = valid(t);
    if (problem) return res.status(400).json({ success: false, message: problem });
    try {
        await runQuery(
            `UPDATE tests SET title=?, className=?, testDate=?, maxMarks=?, minMarks=? WHERE id=?`,
            [t.title || null, t.className, t.testDate, t.maxMarks, t.minMarks, id]
        );
        logAudit({ userId: req.user.id, action: "TEST_UPDATED", entityType: "test", entityId: id }).catch(() => {});
        res.json({ success: true, message: "Test updated." });
    } catch (e) {
        console.error("Update test error:", e);
        res.status(500).json({ success: false, message: "Unable to update test." });
    }
};

exports.deleteTest = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        await runQuery(`DELETE FROM tests WHERE id = ?`, [id]);
        logAudit({ userId: req.user.id, action: "TEST_DELETED", entityType: "test", entityId: id }).catch(() => {});
        res.json({ success: true, message: "Test removed." });
    } catch (e) {
        console.error("Delete test error:", e);
        res.status(500).json({ success: false, message: "Unable to remove test." });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const rows = await allQuery(`SELECT DISTINCT className FROM classes ORDER BY className`);
        res.json((rows || []).map((r) => r.className).filter(Boolean));
    } catch (e) {
        console.error("Test classes error:", e);
        res.status(500).json({ success: false, message: "Unable to load classes." });
    }
};

// ---- Per-test detail, mirroring the exam detail tabs ----
const findTest = async (id) => {
    const rows = await allQuery(`SELECT * FROM tests WHERE id = ?`, [id]);
    return rows[0] || null;
};

const subjectsFor = async (test) => allQuery(
    `SELECT id, subjectName, ? AS maxMarks FROM subjects WHERE className = ? ORDER BY subjectName`,
    [test.maxMarks, test.className]
);

exports.getTestDetail = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        const test = await findTest(id);
        if (!test) return res.status(404).json({ success: false, message: "Test not found." });
        res.json({ ...test, subjects: await subjectsFor(test) });
    } catch (e) {
        console.error("Test detail error:", e);
        res.status(500).json({ success: false, message: "Unable to load test." });
    }
};

exports.getTestMarks = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        const test = await findTest(id);
        if (!test) return res.status(404).json({ success: false, message: "Test not found." });
        const [students, marks, subjects] = await Promise.all([
            allQuery(`SELECT id, studentName, rollNumber FROM students WHERE className = ? AND status = 'active' ORDER BY rollNumber, studentName`, [test.className]),
            allQuery(`SELECT * FROM test_marks WHERE testId = ?`, [id]),
            subjectsFor(test)
        ]);
        res.json({ students, marks, subjects });
    } catch (e) {
        console.error("Test marks error:", e);
        res.status(500).json({ success: false, message: "Unable to load marks." });
    }
};

exports.saveTestMarks = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        const test = await findTest(id);
        if (!test) return res.status(404).json({ success: false, message: "Test not found." });
        const entries = Array.isArray(req.body?.marks) ? req.body.marks : [];
        const now = new Date().toISOString();
        for (const en of entries) {
            const studentId = Number(en.studentId);
            const subjectId = Number(en.subjectId);
            const absent = en.isAbsent ? 1 : 0;
            const obtained = absent || en.marksObtained === "" || en.marksObtained === null || en.marksObtained === undefined
                ? 0 : Number(en.marksObtained);
            if (!studentId || !subjectId || !Number.isFinite(obtained) || obtained < 0 || obtained > Number(test.maxMarks)) {
                continue;
            }
            await runQuery(
                `INSERT INTO test_marks (testId, studentId, subjectId, marksObtained, isAbsent, updatedBy, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(testId, studentId, subjectId) DO UPDATE SET
                   marksObtained = excluded.marksObtained, isAbsent = excluded.isAbsent,
                   updatedBy = excluded.updatedBy, updatedAt = excluded.updatedAt`,
                [id, studentId, subjectId, obtained, absent, req.user.id, now]
            );
        }
        logAudit({ userId: req.user.id, action: "TEST_MARKS_SAVED", entityType: "test", entityId: id,
            details: { rows: entries.length } }).catch(() => {});
        res.json({ success: true, message: "Marks saved." });
    } catch (e) {
        console.error("Save test marks error:", e);
        res.status(500).json({ success: false, message: "Unable to save marks." });
    }
};

exports.getTestResults = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        const test = await findTest(id);
        if (!test) return res.status(404).json({ success: false, message: "Test not found." });
        const [students, marks, subjects] = await Promise.all([
            allQuery(`SELECT id, studentName, rollNumber FROM students WHERE className = ? AND status = 'active' ORDER BY rollNumber, studentName`, [test.className]),
            allQuery(`SELECT * FROM test_marks WHERE testId = ?`, [id]),
            subjectsFor(test)
        ]);
        const maxTotal = Number(test.maxMarks) * subjects.length;
        const results = students.map((s) => {
            const rows = subjects.map((sub) => {
                const m = marks.find((x) => x.studentId === s.id && x.subjectId === sub.id);
                const obtained = m ? Number(m.marksObtained || 0) : 0;
                return { subjectName: sub.subjectName, obtained, passed: obtained >= Number(test.minMarks) };
            });
            const total = rows.reduce((sum, r) => sum + r.obtained, 0);
            return {
                studentId: s.id, studentName: s.studentName, rollNumber: s.rollNumber,
                subjects: rows, total, maxTotal,
                percentage: maxTotal ? Math.round((total / maxTotal) * 100) : 0,
                status: rows.length > 0 && rows.every((r) => r.passed) ? "pass" : "fail"
            };
        });
        res.json({ results, maxTotal, minMarks: test.minMarks });
    } catch (e) {
        console.error("Test results error:", e);
        res.status(500).json({ success: false, message: "Unable to load results." });
    }
};

exports.getTestSchedule = async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid test ID." });
    try {
        const test = await findTest(id);
        if (!test) return res.status(404).json({ success: false, message: "Test not found." });
        const slots = await allQuery(
            `SELECT ts.dayOfWeek, ts.periodNumber, ts.startTime, ts.endTime, s.subjectName
             FROM timetable_slots ts LEFT JOIN subjects s ON s.id = ts.subjectId
             WHERE ts.className = ? ORDER BY ts.dayOfWeek, ts.periodNumber`,
            [test.className]
        );
        res.json({ testDate: test.testDate, className: test.className, slots });
    } catch (e) {
        console.error("Test schedule error:", e);
        res.status(500).json({ success: false, message: "Unable to load schedule." });
    }
};

exports.getTestDelivery = async (req, res) => {
    res.json({ sent: 0, failed: 0, records: [] });
};
