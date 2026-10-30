// =====================================================
// PAGE REGISTRY
//
// Single source of truth for every page that can be
// permission-controlled from the admin Users page.
//
// - key:   stable identifier stored in user_page_access
//          and checked by the backend requirePage guard.
// - label: shown to admin in the access checklist.
// - path:  frontend route (used by the sidebar / router).
//
// Admin always has access to every page regardless of
// this table (enforced in middleware + frontend), so
// admin can never be locked out.
//
// When a new page is added to the app, register it here.
// =====================================================

const PAGES = [
    {
        key: "dashboard",
        label: "Dashboard",
        path: "/dashboard",
        description: "Main overview with key metrics, summaries, and quick actions."
    },
    {
        key: "students",
        label: "Students",
        path: "/students",
        description: "View, add, edit, import, and categorize student records."
    },
    {
        key: "fee_concessions",
        label: "Fee Concessions",
        path: "/fee-concessions",
        description: "Manage student fee categories (Regular, RTE, Management, Others) and grant fee waivers."
    },
    {
        key: "fees",
        label: "Fee Management",
        path: "/fees",
        description: "Define fee structures, manage academic years, and configure class-wise fees."
    },
    {
        key: "payments",
        label: "Payments",
        path: "/payments",
        description: "Record fee payments, view receipts, and track payment history."
    },
    {
        key: "expenses",
        label: "Expenses",
        path: "/expenses",
        description: "Log school expenses, track budgets, and manage vendor payments."
    },
    {
        key: "reports",
        label: "Reports",
        path: "/reports",
        description: "Generate comprehensive financial and student attendance reports."
    },
    {
        key: "notifications",
        label: "Notifications",
        path: "/notifications",
        description: "Send announcements, reminders, and alerts to staff and parents."
    },
    {
        key: "settings",
        label: "Settings",
        path: "/settings",
        description: "Update your profile information and change your password."
    },
    {
        key: "users",
        label: "Users",
        path: "/users",
        description: "Manage staff accounts, roles, and page access permissions."
    },
    {
        key: "class_management",
        label: "Class Management",
        path: "/class-management",
        description: "Create classes, assign sections, and manage class-related settings."
    },
    {
        key: "teacher_management",
        label: "Teacher Management",
        path: "/teacher-management",
        description: "Manage teacher profiles, class assignments, and subject linkages."
    },
    {
        key: "student_attendance",
        label: "Student Attendance",
        path: "/student-attendance",
        description: "Mark and track student attendance by class and date."
    },
    {
        key: "exam_results",
        label: "Exam & Results",
        path: "/exam-results",
        description: "Create exams, publish results, and manage report cards."
    },
    {
        key: "results_overview",
        label: "Results Overview",
        path: "/results-overview",
        description: "View and analyze student performance across exams and subjects."
    },
    {
        key: "attendance_overview",
        label: "Attendance Overview",
        path: "/attendance-overview",
        description: "Monitor overall attendance patterns and generate attendance reports."
    },
    {
        key: "marks_entry",
        label: "Marks Entry",
        path: "/marks-entry",
        description: "Enter exam marks, manage co-scholastic grades, and lock submissions."
    },
    {
        key: "teacher_attendance",
        label: "Staff Attendance",
        path: "/teacher-attendance",
        description: "Mark and review attendance for all staff (teachers, accountant, manager, etc.) and generate reports."
    }
];


// =====================================================
// DERIVED HELPERS
// =====================================================

const PAGE_KEYS = PAGES.map((page) => page.key);

const isValidPageKey = (key) => PAGE_KEYS.includes(key);


// =====================================================
// ROLE → GRANTABLE PAGES
//
// Which pages the admin checklist offers per role. What each
// INDIVIDUAL user actually gets is whatever admin ticks in
// the Users page checklist (user_page_access rows).
//
//  - accountant keeps the classic staff page set (matches original receptionist)
//  - principal and manager may be granted ANY registered
//    page — admin decides per user; route guards accept
//    them wherever the matching page grant exists
//  - teacher keeps the teacher page set
// =====================================================

const STAFF_ROLE_PAGES = [
    "dashboard",
    "students",
    "fees",
    "payments",
    "expenses",
    "teacher_attendance"
];

const TEACHER_ROLE_PAGES = [
    "marks_entry",
    "teacher_attendance",
    "student_attendance"
];

// Pages that can NEVER be granted to principal/manager —
// they stay admin-only no matter what.
const ADMIN_ONLY_PAGES = ["users"];

const ROLE_PAGE_KEYS = {
    accountant: STAFF_ROLE_PAGES,
    principal: PAGE_KEYS.filter((key) => !ADMIN_ONLY_PAGES.includes(key)),
    manager: PAGE_KEYS.filter((key) => !ADMIN_ONLY_PAGES.includes(key)),
    teacher: TEACHER_ROLE_PAGES
};

// Admin can hold every page; other roles are limited to the
// map above. Unknown roles get nothing.
const grantablePagesForRole = (role) => {
    if (role === "admin") return PAGE_KEYS.slice();
    return ROLE_PAGE_KEYS[role] || [];
};

const isPageGrantableForRole = (role, key) =>
    grantablePagesForRole(role).includes(key);


module.exports = {
    PAGES,
    PAGE_KEYS,
    isValidPageKey,
    ROLE_PAGE_KEYS,
    grantablePagesForRole,
    isPageGrantableForRole
};
