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
// fallback landing page.
// =====================================================

export const APP_PAGES = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "🏠" },
    { key: "students", label: "Students", path: "/students", icon: "👨‍🎓" },
    { key: "fees", label: "Fee Management", path: "/fees", icon: "📚" },
    { key: "payments", label: "Payments", path: "/payments", icon: "💰" },
    { key: "expenses", label: "Expenses", path: "/expenses", icon: "💸" },
    { key: "reports", label: "Reports", path: "/reports", icon: "📊" },
    { key: "class_management", label: "Class Management", path: "/class-management", icon: "🏫" },
    { key: "teacher_management", label: "Teacher Management", path: "/teacher-management", icon: "🧑‍🏫" },
    { key: "exam_results", label: "Exam & Results", path: "/exam-results", icon: "📝" },
    { key: "results_overview", label: "Results Overview", path: "/results-overview", icon: "🧮" },
    { key: "attendance_overview", label: "Attendance Overview", path: "/attendance-overview", icon: "📈" },
    { key: "marks_entry", label: "Marks Entry", path: "/marks-entry", icon: "✏️" },
    { key: "teacher_attendance", label: "Teacher Attendance", path: "/teacher-attendance", icon: "🗓️" },
    { key: "student_attendance", label: "Student Attendance", path: "/student-attendance", icon: "📋" },
    { key: "my_attendance", label: "My Attendance", path: "/my-attendance", icon: "🧑‍🏫" },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: "🔔" },
    { key: "settings", label: "Settings", path: "/settings", icon: "⚙️" },
    { key: "users", label: "Users", path: "/users", icon: "👥" }
];
