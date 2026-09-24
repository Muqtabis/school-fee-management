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
        path: "/dashboard"
    },
    {
        key: "students",
        label: "Students",
        path: "/students"
    },
    {
        key: "fees",
        label: "Fee Management",
        path: "/fees"
    },
    {
        key: "payments",
        label: "Payments",
        path: "/payments"
    },
    {
        key: "expenses",
        label: "Expenses",
        path: "/expenses"
    },
    {
        key: "reports",
        label: "Reports",
        path: "/reports"
    },
    {
        key: "notifications",
        label: "Notifications",
        path: "/notifications"
    },
    {
        key: "settings",
        label: "Settings",
        path: "/settings"
    },
    {
        key: "users",
        label: "Users",
        path: "/users"
    },
    {
        key: "class_management",
        label: "Class Management",
        path: "/class-management"
    },
    {
        key: "teacher_management",
        label: "Teacher Management",
        path: "/teacher-management"
    },
    {
        key: "student_attendance",
        label: "Student Attendance",
        path: "/student-attendance"
    },
    {
        key: "exam_results",
        label: "Exam & Results",
        path: "/exam-results"
    },
    {
        key: "results_overview",
        label: "Results Overview",
        path: "/results-overview"
    },
    {
        key: "attendance_overview",
        label: "Attendance Overview",
        path: "/attendance-overview"
    },
    {
        key: "marks_entry",
        label: "Marks Entry",
        path: "/marks-entry"
    },
    {
        key: "teacher_attendance",
        label: "Teacher Attendance",
        path: "/teacher-attendance"
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
// A page is only grantable to a role whose API routes can
// actually serve it. Granting a page the role's endpoints
// reject just produced a sidebar link that 403'd on open,
// so the admin checklist and the backend both use this map.
//
// Derived from the route guards:
//  - most staff pages are requireRole("admin","receptionist")
//  - marks_entry is requireTeacher (admin, teacher)
//  - teacher_attendance is page-gated only (any granted role)
//  - users / teacher_management / exam_results are admin-only
//    (not grantable to anyone else)
// =====================================================

const ROLE_PAGE_KEYS = {
    receptionist: [
        "dashboard",
        "students",
        "fees",
        "payments",
        "expenses",
        "reports",
        "notifications",
        "settings",
        "teacher_attendance"
    ],
    teacher: [
        "marks_entry",
        "teacher_attendance",
        "student_attendance"
    ]
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
