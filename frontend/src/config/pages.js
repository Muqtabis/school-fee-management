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
export const PAGE_GROUPS = ["Students", "Finance", "Documents", "Exams", "Attendance", "Staff & Admin"];

export const APP_PAGES = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "🏠", description: "Main overview with key metrics, summaries, and quick actions.", actions: ["Recent Activity","Customize Cards"] },
    { key: "archived_students", label: "Archived Students", path: "/archived-students", icon: "🗄️", group: "Students", description: "View archived students, restore them, and access their transfer certificates." },
    { key: "students", label: "Students", path: "/students", icon: "👨‍🎓", group: "Students", description: "View, add, edit, import, and categorize student records.", actions: ["Add Student","Import Students","Archive Student","Restore Student","Edit Student","Student Details","Fee History","Exam Results"] },
    { key: "fee_concessions", label: "Fee Concessions", path: "/fee-concessions", icon: "🏷️", group: "Finance", description: "Manage student fee categories and grant fee waivers.", actions: ["Add Concession","Edit Concession","Remove Concession"] },
    { key: "fees", label: "Fee Management", path: "/fees", icon: "📚", group: "Finance", description: "Define fee structures, manage academic years, and configure class-wise fees.", actions: ["Academic Years","Fee Structure","Class Fee Components","Assess Fees"] },
    { key: "payments", label: "Payments", path: "/payments", icon: "💰", group: "Finance", description: "Record fee payments, view receipts, and track payment history.", actions: ["Collect Fee","Edit Payment","Reverse Payment","Reverse Requests","Payment Receipt","Payment History","Export Excel"] },
    { key: "expenses", label: "Expenses", path: "/expenses", icon: "💸", group: "Finance", description: "Log school expenses, track budgets, and manage vendor payments.", actions: ["Add Expense","Edit Expense","Reverse Expense","Reverse Requests","Manage Categories"] },
    { key: "incomes", label: "Incomes", path: "/incomes", icon: "📈", group: "Finance", description: "Record non-fee school income (donations, grants, events) with admin-managed categories.", actions: ["Add Income","Edit Income","Reverse Income","Reverse Requests","Manage Categories"] },
    { key: "reports", label: "Reports", path: "/reports", icon: "📊", group: "Finance", description: "Generate comprehensive financial and student attendance reports.", actions: ["Fee Inflow Report","Cash Flow Analysis","Class Matrix","Export Excel","Data Export Center"] },
    { key: "defaulters", label: "Fee Defaulters", path: "/defaulters", icon: "⚠️", group: "Finance", description: "Students with outstanding fee balances, with totals and contact details.", actions: ["Export Excel","Fee Defaulters"] },
    { key: "transfer_certificate", label: "Transfer Certificate", path: "/transfer-certificate", icon: "📄", group: "Documents", description: "Generate and print transfer certificates for students." },
    { key: "exam_results", label: "Exam & Results", path: "/exam-results", icon: "📝", group: "Exams", description: "Create exams, publish results, and manage report cards.", actions: ["Create Exam","Edit Exam","Grading Scales","Publish Results","Report Cards"] },
    { key: "marks_entry", label: "Marks Entry", path: "/marks-entry", icon: "✏️", group: "Exams", description: "Enter exam marks, manage co-scholastic grades, and lock submissions.", actions: ["Enter Marks","Lock Marks","Co-Scholastic Marks","Term Details"] },
    { key: "results_overview", label: "Results Overview", path: "/results-overview", icon: "🧮", group: "Exams", description: "View and analyze student performance across exams and subjects.", actions: ["Results Overview","Class Gradebook"] },
    { key: "teacher_attendance", label: "Staff Attendance", path: "/teacher-attendance", icon: "🗓️", group: "Attendance", description: "Mark and review attendance for all staff (teachers, accountant, manager, etc.) and generate reports.", actions: ["Mark Attendance","Attendance History","Lock Attendance"] },
    { key: "student_attendance", label: "Student Attendance", path: "/student-attendance", icon: "📋", group: "Attendance", description: "Mark and track student attendance by class and date.", actions: ["Mark Attendance","Attendance History","Lock Attendance"] },
    { key: "attendance_overview", label: "Attendance Overview", path: "/attendance-overview", icon: "📈", group: "Attendance", description: "Monitor overall attendance patterns and generate attendance reports.", actions: ["Attendance Report","Class Summary"] },
    { key: "my_attendance", label: "My Attendance", path: "/my-attendance", icon: "🙋", group: "Attendance", description: "Your own attendance record, read-only (default for every user).", actions: ["My Attendance"] },
    { key: "my_schedule", label: "My Schedule", path: "/my-schedule", icon: "🕒", group: "Attendance", description: "Your weekly class timings and the timetables of classes you lead (default for every user).", actions: ["My Schedule","Class Timetable"] },
    { key: "class_management", label: "Class Management", path: "/class-management", icon: "🏫", group: "Staff & Admin", description: "Create classes, assign sections, and manage class-related settings.", actions: ["Create Class","Edit Class","Assign Section"] },
    { key: "teacher_management", label: "Teacher Management", path: "/teacher-management", icon: "🧑‍🏫", group: "Staff & Admin", description: "Manage teacher profiles, class assignments, and subject linkages.", actions: ["Add Teacher","Edit Teacher","Assign Class","Assign Subject"] },
    { key: "timetable", label: "Timetable", path: "/timetable", icon: "🗓️", group: "Staff & Admin", description: "Set the weekly class timetable: periods, times, subjects, and teachers.", actions: ["Set Timetable","Edit Periods","Assign Subject Teacher"] },
    { key: "users", label: "Users", path: "/users", icon: "👥", group: "Staff & Admin", description: "Manage staff accounts, roles, and page access permissions.", actions: ["Add User","Edit User","Page Access","Reset Password","Lock Access"] },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: "🔔", group: "Staff & Admin", description: "Send announcements, reminders, and alerts to staff and parents.", actions: ["Send Notification","Notification History"] },
    { key: "settings", label: "Settings", path: "/settings", icon: "⚙️", group: "Staff & Admin", description: "Update your profile information and change your password.", actions: ["Change Password","Edit Profile"] }
];