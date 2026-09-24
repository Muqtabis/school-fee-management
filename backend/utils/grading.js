// =====================================================
// GRADING + RESULT CALCULATION
//
// One place that turns raw marks into a result: per
// subject pass/fail + grade, and the student's totals,
// percentage, overall grade and overall pass/fail.
//
// Grading bands are ADMIN-CONFIGURABLE (grading_scales /
// grading_bands) — nothing here hard-codes a letter grade.
// Pass marks are admin-decided per exam/class/subject; if
// an admin has not set one we fall back to a documented
// 33% of max (never a silent zero) so results still compute.
// =====================================================

const { allQuery } = require("../db");


// The mark statuses a cell can carry (spec item 10). "absent"
// is NOT the same as scoring zero — it is surfaced as absent.
const MARK_STATUSES = ["present", "absent", "exempted", "medical_leave", "not_applicable"];

// Statuses that take the subject OUT of the totals entirely
// (the student was not expected to sit it) rather than
// counting it as a zero.
const EXCLUDED_STATUSES = new Set(["exempted", "not_applicable", "medical_leave"]);

// Default pass threshold when an admin has not set an explicit
// pass mark for a subject. Documented, overridable — not a
// hard-coded grade.
const DEFAULT_PASS_FRACTION = 0.33;


function normalizeStatus(status, legacyIsAbsent) {
    const s = String(status || "").trim().toLowerCase();
    if (MARK_STATUSES.includes(s)) return s;
    // Fall back to the legacy boolean when a caller only sends isAbsent.
    return legacyIsAbsent ? "absent" : "present";
}


function resolvePassMarks(passMarks, maxMarks) {
    // Only an explicitly-set, valid value counts. null/undefined/"" mean the
    // admin has not set a pass mark — fall back to the documented default.
    // (Number(null) is 0, so we must guard before coercing.)
    if (passMarks !== null && passMarks !== undefined && passMarks !== "") {
        const p = Number(passMarks);
        if (Number.isFinite(p) && p >= 0) return p;
    }
    const max = Number(maxMarks) || 0;
    return Math.round(max * DEFAULT_PASS_FRACTION);
}


// Load the grading bands for a scale, ordered high→low so the
// first band whose minPercent a percentage clears is its grade.
// Falls back to the default scale when scaleId is missing.
async function loadBands(gradingScaleId) {
    let scaleId = Number(gradingScaleId);
    if (!Number.isInteger(scaleId) || scaleId <= 0) {
        const def = await allQuery(
            `SELECT id FROM grading_scales ORDER BY isDefault DESC, id ASC LIMIT 1`
        );
        if (!def.length) return [];
        scaleId = def[0].id;
    }
    return allQuery(
        `SELECT grade, minPercent, maxPercent FROM grading_bands
         WHERE scaleId = ? ORDER BY minPercent DESC`,
        [scaleId]
    );
}


// The grade whose [minPercent, maxPercent] window contains the
// percentage. Bands are sorted desc, so the first match wins.
function gradeForPercent(bands, percent) {
    if (!Array.isArray(bands) || !bands.length) return null;
    const p = Number(percent) || 0;
    for (const b of bands) {
        const min = Number(b.minPercent);
        const max = b.maxPercent === null || b.maxPercent === undefined ? 100 : Number(b.maxPercent);
        if (p >= min && p <= max) return b.grade;
    }
    return null;
}


// =====================================================
// COMPUTE ONE STUDENT'S RESULT
//
// subjects: [{ subjectId, subjectName, maxMarks, passMarks }]
// marksBySubject: Map subjectId -> { marksObtained, markStatus }
// bands: grading bands (from loadBands)
//
// Rules (spec items 10 & 14):
//  - present  : counts obtained + max; pass if obtained >= passMarks
//  - absent   : counts max, obtained 0 (shown as AB, NOT a scored 0);
//               fails the subject and flags the overall result absent
//  - exempted / medical_leave / not_applicable : excluded from totals
//    entirely (student was not expected to sit it)
//
// Overall: "absent" if any subject is absent; else "fail" if any
// counted subject fails its pass mark; else "pass".
// =====================================================

function computeStudentResult({ subjects, marksBySubject, bands }) {
    let totalObtained = 0;
    let totalMax = 0;
    let anyAbsent = false;
    let anyFail = false;
    let anyGraded = false;

    const subjectResults = (subjects || []).map((s) => {
        const entry = marksBySubject.get(s.subjectId) || {};
        const status = normalizeStatus(entry.markStatus, entry.isAbsent);
        const maxMarks = Number(s.maxMarks) || 0;
        const passMarks = resolvePassMarks(s.passMarks, maxMarks);

        let marksObtained = null;
        let subjectPass = null; // null = not applicable to pass/fail

        if (EXCLUDED_STATUSES.has(status)) {
            // Out of the totals altogether.
        } else if (status === "absent") {
            marksObtained = 0;
            totalMax += maxMarks;
            subjectPass = false;
            anyAbsent = true;
            anyGraded = true;
        } else {
            // present
            const raw = Number(entry.marksObtained);
            marksObtained = Number.isFinite(raw) ? raw : 0;
            totalObtained += marksObtained;
            totalMax += maxMarks;
            subjectPass = marksObtained >= passMarks;
            if (!subjectPass) anyFail = true;
            anyGraded = true;
        }

        const subjectPercent = maxMarks > 0 && marksObtained !== null
            ? (marksObtained / maxMarks) * 100
            : 0;

        return {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            maxMarks,
            passMarks,
            marksObtained,
            markStatus: status,
            grade: (status === "present") ? gradeForPercent(bands, subjectPercent) : null,
            subjectPass
        };
    });

    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const overallStatus = anyAbsent ? "absent" : (anyFail ? "fail" : "pass");
    const grade = anyGraded && totalMax > 0 ? gradeForPercent(bands, percentage) : null;

    return {
        subjectResults,
        totalObtained,
        totalMax,
        percentage: Math.round(percentage * 100) / 100,
        grade,
        overallStatus
    };
}


module.exports = {
    MARK_STATUSES,
    EXCLUDED_STATUSES,
    DEFAULT_PASS_FRACTION,
    normalizeStatus,
    resolvePassMarks,
    loadBands,
    gradeForPercent,
    computeStudentResult
};
