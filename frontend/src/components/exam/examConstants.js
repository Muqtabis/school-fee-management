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
