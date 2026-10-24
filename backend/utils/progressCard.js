// =====================================================
// PROGRESS CARD AGGREGATION ENGINE
//
// Turns several exams into ONE comprehensive academic
// progress card (the CBSE-style Term / Final report).
//
//   Unit Test (FA)  exams are scored simply and stand alone.
//   Term      (SA)  cards aggregate that term's Unit Tests +
//                   the term exam, per subject, by weightage.
//   Final           cards average Term I (50%) + Term II (50%).
//
// Aggregation is by SUBJECT NAME (a class's subjects are
// consistent across its exams). Each assessment contributes
// (obtained / max) * weightage; a term's subject percentage is
// the weighted mean of its assessments' percentages, so exams
// with different max marks combine cleanly. Grades come from
// the admin-configurable grading bands — nothing is hardcoded.
// =====================================================

const { allQuery } = require("../db");
const {
    loadBands,
    gradeForPercent,
    normalizeStatus,
    resolvePassMarks,
    EXCLUDED_STATUSES
} = require("./grading");

// Fixed co-scholastic areas (Part 2 decision: same for every class).
const CO_SCHOLASTIC_AREAS = [
    "Art Education",
    "Physical & Health Education",
    "Work Experience",
    "Attitude and Values"
];

// Default weightage per category when the admin hasn't set one on the
// exam definition. Only the RELATIVE size matters (a term subject % is a
// weighted mean), so these are sensible CBSE-ish defaults.
const DEFAULT_WEIGHTAGE = { unit_test: 15, term: 20, final: 0 };

function resolveWeightage(def) {
    const w = Number(def && def.weightage);
    if (Number.isFinite(w) && w > 0) return w;
    return DEFAULT_WEIGHTAGE[def && def.examCategory] || 10;
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

const TERM_LABEL = { term_1: "Term I", term_2: "Term II" };

// This exam's effective subjects (per-exam max/pass override, else the class
// default). Mirrors examController.getEffectiveSubjects but kept local so this
// util has no controller dependency.
async function effectiveSubjects(examId, className) {
    return allQuery(
        `SELECT s.id AS subjectId, s.subjectName,
                COALESCE(es.maxMarks, s.maxMarks) AS maxMarks,
                es.passMarks AS passMarks
         FROM subjects s
         LEFT JOIN exam_subjects es ON es.examId = ? AND es.subjectId = s.id
         WHERE s.className = ?
         ORDER BY s.subjectName`,
        [examId, className]
    );
}

// One assessment exam's per-subject cell for a single student, keyed by
// subjectName: { max, obtained, status, percent, grade }. Excluded statuses
// (exempted / medical_leave / not_applicable) yield a null cell.
async function examCellsForStudent(examId, className, studentId, bands) {
    const subjects = await effectiveSubjects(examId, className);
    const marks = await allQuery(
        `SELECT subjectId, marksObtained, isAbsent, markStatus
         FROM exam_marks WHERE examId = ? AND studentId = ?`,
        [examId, studentId]
    );
    const byId = new Map(marks.map((m) => [m.subjectId, m]));
    const cells = new Map();
    for (const s of subjects) {
        const m = byId.get(s.subjectId) || {};
        const status = normalizeStatus(m.markStatus, m.isAbsent);
        const max = Number(s.maxMarks) || 0;
        if (EXCLUDED_STATUSES.has(status)) {
            cells.set(s.subjectName, { max, obtained: null, status, percent: null, grade: null });
            continue;
        }
        const obtained = status === "absent" ? 0 : (Number.isFinite(Number(m.marksObtained)) ? Number(m.marksObtained) : null);
        const percent = (obtained !== null && max > 0) ? (obtained / max) * 100 : null;
        cells.set(s.subjectName, {
            max,
            obtained,
            status,
            percent: percent === null ? null : round2(percent),
            grade: (status === "present" && percent !== null) ? gradeForPercent(bands, percent) : null
        });
    }
    return cells;
}

// The exams that make up a term for a class + academic year, ordered
// unit-tests-first then the term exam. category IN (unit_test, term).
// Only finalized assessments count — an exam still 'open' (marks editable)
// is excluded so a card never shows a half-entered column.
async function termAssessments(className, academicYearId, term) {
    const params = [className];
    let sql =
        `SELECT e.id AS examId, e.examName, d.examCategory, d.term, d.weightage
         FROM exams e JOIN exam_definitions d ON d.id = e.examDefinitionId
         WHERE e.className = ? AND d.examCategory IN ('unit_test','term')
           AND e.status <> 'open'`;
    // Term match is NULL-aware: an untermed card (term === null) aggregates the
    // class's untermed assessments instead of defaulting to a 'term_1' that can
    // never match NULL rows — which is what left real, untagged exams off the
    // card entirely (empty scholastic table).
    if (term) { sql += ` AND d.term = ?`; params.push(term); }
    else { sql += ` AND d.term IS NULL`; }
    // Year match is relaxed: a year-scoped card still picks up assessments left
    // with no academic year (NULL = unscoped, applies broadly). An unscoped card
    // (no year) matches assessments of any year for the class.
    if (academicYearId) { sql += ` AND (d.academicYearId = ? OR d.academicYearId IS NULL)`; params.push(academicYearId); }
    sql += ` ORDER BY CASE d.examCategory WHEN 'unit_test' THEN 0 ELSE 1 END, e.id`;
    return allQuery(sql, params);
}

// Aggregate ONE term for ONE student into a per-subject table.
// Returns { term, label, assessments:[{examId,examName,category,weightage}],
//   subjects:[{ subjectName, cells:{examId:cell}, aggregatePercent, aggregateGrade }],
//   coScholastic:[{ area, cells:{examId:grade}, aggregateGrade }], meta }.
async function buildTerm(className, academicYearId, term, studentId, bands, labelOverride) {
    const assessments = await termAssessments(className, academicYearId, term);
    const termExam = assessments.find((a) => a.examCategory === "term") || null;

    // Gather each assessment's cells + weightage.
    const perExam = [];
    for (const a of assessments) {
        const cells = await examCellsForStudent(a.examId, className, studentId, bands);
        perExam.push({ ...a, weight: resolveWeightage(a), cells });
    }

    // Union of subject names across the term's assessments.
    const subjectNames = [];
    const seen = new Set();
    for (const pe of perExam) {
        for (const name of pe.cells.keys()) {
            if (!seen.has(name)) { seen.add(name); subjectNames.push(name); }
        }
    }

    const subjects = subjectNames.map((subjectName) => {
        const cells = {};
        let wSum = 0, wPct = 0;
        for (const pe of perExam) {
            const c = pe.cells.get(subjectName) || null;
            cells[pe.examId] = c;
            if (c && c.percent !== null) { wSum += pe.weight; wPct += c.percent * pe.weight; }
        }
        const aggregatePercent = wSum > 0 ? round2(wPct / wSum) : null;
        return {
            subjectName,
            cells,
            aggregatePercent,
            aggregateGrade: aggregatePercent === null ? null : gradeForPercent(bands, aggregatePercent)
        };
    });

    const coScholastic = await buildCoScholastic(perExam, termExam, studentId);
    const meta = termExam ? await loadTermMeta(termExam.examId, studentId) : null;

    return {
        term,
        label: labelOverride || TERM_LABEL[term] || term || "Progress",
        termExamId: termExam ? termExam.examId : null,
        assessments: perExam.map((pe) => ({ examId: pe.examId, examName: pe.examName, category: pe.examCategory, weightage: pe.weight })),
        subjects,
        coScholastic,
        meta
    };
}

// Co-scholastic grades per area across the term's assessments. Grades are
// entered (letter grades), stored in co_scholastic_marks per exam. The
// aggregate simply carries the term exam's grade when present, else the last
// assessment that has one.
async function buildCoScholastic(perExam, termExam, studentId) {
    const examIds = perExam.map((pe) => pe.examId);
    if (examIds.length === 0) return CO_SCHOLASTIC_AREAS.map((area) => ({ area, cells: {}, aggregateGrade: null }));
    const placeholders = examIds.map(() => "?").join(",");
    const rows = await allQuery(
        `SELECT examId, area, grade FROM co_scholastic_marks
         WHERE studentId = ? AND examId IN (${placeholders})`,
        [studentId, ...examIds]
    );
    const byArea = new Map();
    for (const r of rows) {
        if (!byArea.has(r.area)) byArea.set(r.area, {});
        byArea.get(r.area)[r.examId] = r.grade;
    }
    return CO_SCHOLASTIC_AREAS.map((area) => {
        const cells = byArea.get(area) || {};
        const aggregateGrade = (termExam && cells[termExam.examId]) ||
            examIds.map((id) => cells[id]).filter(Boolean).pop() || null;
        return { area, cells, aggregateGrade };
    });
}

// Term-level meta (attendance / stature / remark / promotion) for the card.
async function loadTermMeta(examId, studentId) {
    const rows = await allQuery(
        `SELECT workingDays, daysAttended, heightCm, weightKg, remark, promotionStatus, promotedToClass
         FROM student_term_meta WHERE examId = ? AND studentId = ?`,
        [examId, studentId]
    );
    return rows[0] || null;
}

// =====================================================
// BUILD THE FULL CARD MODEL for one student.
//
// cardExam: the exam row being rendered (from examController.getExam),
// carrying examCategory / term / academicYearId / className.
// For 'term' -> one term block. For 'final' -> both terms + a final
// average block (Term I 50% + Term II 50% per subject).
// =====================================================
async function buildProgressCardModel(cardExam, studentId) {
    const bands = await loadBands(cardExam.gradingScaleId);
    const ay = cardExam.academicYearId || null;

    const terms = [];
    if (cardExam.examCategory === "final") {
        terms.push(await buildTerm(cardExam.className, ay, "term_1", studentId, bands));
        terms.push(await buildTerm(cardExam.className, ay, "term_2", studentId, bands));
    } else {
        // A 'term' or 'unit_test' card. Pass the exam's own term verbatim (may be
        // NULL for untagged exams) so termAssessments can match it NULL-aware; for
        // an untermed card label the block with the exam's own name rather than a
        // misleading "Term I".
        terms.push(await buildTerm(cardExam.className, ay, cardExam.term || null, studentId, bands, cardExam.term ? null : cardExam.examName));
    }

    let final = null;
    if (cardExam.examCategory === "final") {
        const [t1, t2] = terms;
        const names = [];
        const seen = new Set();
        for (const t of terms) for (const s of t.subjects) if (!seen.has(s.subjectName)) { seen.add(s.subjectName); names.push(s.subjectName); }
        const pick = (t, name) => (t.subjects.find((s) => s.subjectName === name) || {}).aggregatePercent ?? null;
        const subjects = names.map((subjectName) => {
            const p1 = pick(t1, subjectName);
            const p2 = pick(t2, subjectName);
            const parts = [p1, p2].filter((p) => p !== null);
            const finalPercent = parts.length ? round2(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
            return {
                subjectName,
                termIPercent: p1,
                termIIPercent: p2,
                finalPercent,
                grade: finalPercent === null ? null : gradeForPercent(bands, finalPercent)
            };
        });
        const counted = subjects.filter((s) => s.finalPercent !== null);
        const aggregatePercent = counted.length ? round2(counted.reduce((a, s) => a + s.finalPercent, 0) / counted.length) : null;
        // The promotion decision for a final card lives on the FINAL exam's own
        // term-meta row (not on either term exam), so load it here for the card.
        const finalMeta = await loadTermMeta(cardExam.id, studentId);
        final = { subjects, aggregatePercent, grade: aggregatePercent === null ? null : gradeForPercent(bands, aggregatePercent), meta: finalMeta };
    }

    return { exam: cardExam, studentId, category: cardExam.examCategory, terms, final, bands };
}

module.exports = {
    CO_SCHOLASTIC_AREAS,
    resolveWeightage,
    round2,
    TERM_LABEL,
    buildProgressCardModel
};
