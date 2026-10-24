// =====================================================
// FRONTEND PAGE REGISTRY
//
// Mirrors backend/config/pages.js. Single source of
// truth for the sidebar menu and route protection.
//
// - key:   matches the backend page key stored in
//          user_page_access.
// - label: menu / checklist label.
// - path:  route path.
// - icon:  sidebar icon.
//
// Order here is the order pages appear in the sidebar
// and the order ProtectedRoute uses when picking a
// fallback landing page. `group` buckets the item under a
// collapsible sidebar section (Dashboard stays ungrouped/pinned).
// =====================================================

// Collapsible sidebar section order.
export const PAGE_GROUPS = ["Students", "Finance", "Exams", "Attendance", "Staff & Admin"];

export const APP_PAGES = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "🏠" },
    { key: "students", label: "Students", path: "/students", icon: "👨‍🎓", group: "Students" },
    { key: "class_management", label: "Class Management", path: "/class-management", icon: "🏫", group: "Students" },
    { key: "fees", label: "Fee Management", path: "/fees", icon: "📚", group: "Finance" },
    { key: "payments", label: "Payments", path: "/payments", icon: "💰", group: "Finance" },
    { key: "expenses", label: "Expenses", path: "/expenses", icon: "💸", group: "Finance" },
    { key: "reports", label: "Reports", path: "/reports", icon: "📊", group: "Finance" },
    { key: "exam_results", label: "Exam & Results", path: "/exam-results", icon: "📝", group: "Exams" },
    { key: "marks_entry", label: "Marks Entry", path: "/marks-entry", icon: "✏️", group: "Exams" },
    { key: "results_overview", label: "Results Overview", path: "/results-overview", icon: "🧮", group: "Exams" },
    { key: "teacher_attendance", label: "Teacher Attendance", path: "/teacher-attendance", icon: "🗓️", group: "Attendance" },
    { key: "student_attendance", label: "Student Attendance", path: "/student-attendance", icon: "📋", group: "Attendance" },
    { key: "my_attendance", label: "My Attendance", path: "/my-attendance", icon: "🧑‍🏫", group: "Attendance" },
    { key: "attendance_overview", label: "Attendance Overview", path: "/attendance-overview", icon: "📈", group: "Attendance" },
    { key: "teacher_management", label: "Teacher Management", path: "/teacher-management", icon: "🧑‍🏫", group: "Staff & Admin" },
    { key: "users", label: "Users", path: "/users", icon: "👥", group: "Staff & Admin" },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: "🔔", group: "Staff & Admin" },
    { key: "settings", label: "Settings", path: "/settings", icon: "⚙️", group: "Staff & Admin" }
];
