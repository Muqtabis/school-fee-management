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
// - description: helper text for admin in UsersPage checklist
//
// Order here is the order pages appear in the sidebar
// and the order ProtectedRoute uses when picking a
// fallback landing page. `group` buckets the item under a
// collapsible sidebar section (Dashboard stays ungrouped/pinned).
// =====================================================

// Collapsible sidebar section order.
export const PAGE_GROUPS = ["Students", "Finance", "Exams", "Attendance", "Staff & Admin"];

export const APP_PAGES = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "🏠", description: "Main overview with key metrics, summaries, and quick actions." },
    { key: "students", label: "Students", path: "/students", icon: "👨‍🎓", group: "Students", description: "View, add, edit, import, and categorize student records." },
    { key: "fee_concessions", label: "Fee Concessions", path: "/fee-concessions", icon: "🏷️", group: "Finance", description: "Manage student fee categories and grant fee waivers." },
    { key: "fees", label: "Fee Management", path: "/fees", icon: "📚", group: "Finance", description: "Define fee structures, manage academic years, and configure class-wise fees." },
    { key: "payments", label: "Payments", path: "/payments", icon: "💰", group: "Finance", description: "Record fee payments, view receipts, and track payment history." },
    { key: "expenses", label: "Expenses", path: "/expenses", icon: "💸", group: "Finance", description: "Log school expenses, track budgets, and manage vendor payments." },
    { key: "reports", label: "Reports", path: "/reports", icon: "📊", group: "Finance", description: "Generate comprehensive financial and student attendance reports." },
    { key: "exam_results", label: "Exam & Results", path: "/exam-results", icon: "📝", group: "Exams", description: "Create exams, publish results, and manage report cards." },
    { key: "marks_entry", label: "Marks Entry", path: "/marks-entry", icon: "✏️", group: "Exams", description: "Enter exam marks, manage co-scholastic grades, and lock submissions." },
    { key: "results_overview", label: "Results Overview", path: "/results-overview", icon: "🧮", group: "Exams", description: "View and analyze student performance across exams and subjects." },
    { key: "teacher_attendance", label: "Staff Attendance", path: "/teacher-attendance", icon: "🗓️", group: "Attendance", description: "Mark and review attendance for all staff (teachers, accountant, manager, etc.) and generate reports." },
    { key: "student_attendance", label: "Student Attendance", path: "/student-attendance", icon: "📋", group: "Attendance", description: "Mark and track student attendance by class and date." },
    { key: "attendance_overview", label: "Attendance Overview", path: "/attendance-overview", icon: "📈", group: "Attendance", description: "Monitor overall attendance patterns and generate attendance reports." },
    { key: "class_management", label: "Class Management", path: "/class-management", icon: "🏫", group: "Staff & Admin", description: "Create classes, assign sections, and manage class-related settings." },
    { key: "teacher_management", label: "Teacher Management", path: "/teacher-management", icon: "🧑‍🏫", group: "Staff & Admin", description: "Manage teacher profiles, class assignments, and subject linkages." },
    { key: "users", label: "Users", path: "/users", icon: "👥", group: "Staff & Admin", description: "Manage staff accounts, roles, and page access permissions." },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: "🔔", group: "Staff & Admin", description: "Send announcements, reminders, and alerts to staff and parents." },
    { key: "settings", label: "Settings", path: "/settings", icon: "⚙️", group: "Staff & Admin", description: "Update your profile information and change your password." }
];