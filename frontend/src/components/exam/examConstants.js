// Shared exam presentation helpers (labels, badges) used across the
// exam list, the tabbed detail, and marks entry. Keeps wording and
// colours consistent without hard-coding them in several places.

export const EXAM_TYPES = [
    { value: "unit_test", label: "Unit Test" },
    { value: "mid_term", label: "Mid Term" },
    { value: "term_1", label: "Term 1" },
    { value: "term_2", label: "Term 2" },
    { value: "pre_board", label: "Pre-Board" },
    { value: "final", label: "Final" },
    { value: "other", label: "Other" }
];

export function examTypeLabel(value) {
    const found = EXAM_TYPES.find((t) => t.value === value);
    return found ? found.label : (value || "—");
}

// Report-card CATEGORY (dynamic progress card, Part 2). This — not the free
// examType — drives conditional rendering: a unit_test prints a simple single
// -exam marksheet, while term/final print the comprehensive progress card that
// aggregates the term's assessments.
export const EXAM_CATEGORIES = [
    { value: "unit_test", label: "Unit Test (FA)" },
    { value: "term", label: "Term Exam (SA)" },
    { value: "final", label: "Final (Term I + II)" }
];

export function examCategoryLabel(value) {
    const found = EXAM_CATEGORIES.find((c) => c.value === value);
    return found ? found.label : (value || "—");
}

// Which term an exam rolls up into, for aggregation. Final spans both terms,
// so its term is left blank.
export const TERM_OPTIONS = [
    { value: "term_1", label: "Term I" },
    { value: "term_2", label: "Term II" }
];

export function termLabel(value) {
    const found = TERM_OPTIONS.find((t) => t.value === value);
    return found ? found.label : (value || "—");
}

// A single "assessment slot" picker for exam creation. It speaks the CCE card's
// own language (FA1/FA2 + SA per term, or Final) and maps each choice onto the
// stored examCategory + term + legacy examType, so what the admin picks matches
// exactly what prints on the progress card. (FA numbering within a term still
// follows creation order, so create FA1 before FA2.)
export const ASSESSMENT_SLOTS = [
    { value: "t1_fa1", label: "Term I — Formative Assessment 1 (FA1)", examCategory: "unit_test", term: "term_1", examType: "unit_test" },
    { value: "t1_fa2", label: "Term I — Formative Assessment 2 (FA2)", examCategory: "unit_test", term: "term_1", examType: "unit_test" },
    { value: "t1_sa", label: "Term I — Summative Assessment (SA1)", examCategory: "term", term: "term_1", examType: "term_1" },
    { value: "t2_fa3", label: "Term II — Formative Assessment 3 (FA3)", examCategory: "unit_test", term: "term_2", examType: "unit_test" },
    { value: "t2_fa4", label: "Term II — Formative Assessment 4 (FA4)", examCategory: "unit_test", term: "term_2", examType: "unit_test" },
    { value: "t2_sa", label: "Term II — Summative Assessment (SA2)", examCategory: "term", term: "term_2", examType: "term_2" },
    { value: "final", label: "Final (whole year — Term I + II)", examCategory: "final", term: null, examType: "final" }
];

export function assessmentSlot(value) {
    return ASSESSMENT_SLOTS.find((s) => s.value === value) || ASSESSMENT_SLOTS[0];
}

// Child-exam workflow statuses (spec item 12). "locked" is the
// teacher-submitted / under-review state before an admin publishes.
export const STATUS_LABEL = {
    open: "Open",
    locked: "Submitted",
    published: "Published"
};

export const STATUS_HINT = {
    open: "Teacher is entering marks",
    locked: "Marks submitted — ready to review & publish",
    published: "Results published"
};

// Mark statuses (spec item 10). Absent is NOT a scored zero.
export const MARK_STATUS_OPTIONS = [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "exempted", label: "Exempted" },
    { value: "medical_leave", label: "Medical Leave" },
    { value: "not_applicable", label: "Not Applicable" }
];
