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
export const PAGE_GROUPS = ["Student Management", "Finance Management", "Documentation", "Examination", "Attendance Management", "Staff and Administration"];

export const APP_PAGES = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "🏠", description: "Main overview with key metrics, summaries, and quick actions.", actions: ["Recent Activity","Customize Cards"] },
    { key: "notices", label: "Notice Board", path: "/notices", icon: "📢", group: "Staff and Administration", description: "Post and manage school announcements for all staff members.", actions: ["Post Notice","Edit Notice","Delete Notice"] },
    { key: "students", label: "Active Students", path: "/students", icon: "👨‍🎓", group: "Student Management", description: "View, add, edit, import, and categorize student records.", actions: ["Add Student","Import Students","Archive Student","Restore Student","Edit Student","Student Details","Fee History","Exam Results"] },
    { key: "archived_students", label: "Archived Students", path: "/archived-students", icon: "🗄️", group: "Student Management", description: "View archived students, restore them, and access their transfer certificates." },
    { key: "fee_concessions", label: "Fee Concession", path: "/fee-concessions", icon: "🏷️", group: "Finance Management", description: "Manage student fee categories and grant fee waivers.", actions: ["Add Concession","Edit Concession","Remove Concession"] },
    { key: "fees", label: "Fee Management", path: "/fees", icon: "📚", group: "Finance Management", description: "Define fee structures, manage academic years, and configure class-wise fees.", actions: ["Academic Years","Fee Structure","Class Fee Components","Assess Fees"] },
    { key: "payments", label: "Collection", path: "/payments", icon: "💰", group: "Finance Management", description: "Record fee payments, view receipts, and track payment history.", actions: ["Collect Fee","Edit Payment","Reverse Payment","Reverse Requests","Payment Receipt","Payment History","Export Excel"] },
    { key: "incomes", label: "Receipt", path: "/incomes", icon: "📈", group: "Finance Management", description: "Record non-fee school receipts (donations, grants, events) with admin-managed categories.", actions: ["Add Receipt","Edit Receipt","Reverse Receipt","Reverse Requests","Manage Categories"] },
    { key: "expenses", label: "Payment", path: "/expenses", icon: "💸", group: "Finance Management", description: "Log school payments, track budgets, and manage vendor payments.", actions: ["Add Payment","Edit Payment","Reverse Payment","Reverse Requests","Manage Categories"] },
    { key: "reports", label: "Reports", path: "/reports", icon: "📊", group: "Finance Management", description: "Generate comprehensive financial and student attendance reports.", actions: ["Fee Inflow Report","Cash Flow Analysis","Class Matrix","Export Excel","Data Export Center"] },
    { key: "defaulters", label: "Defaulters", path: "/defaulters", icon: "⚠️", group: "Finance Management", description: "Students with outstanding fee balances, with totals and contact details.", actions: ["Export Excel","Fee Defaulters"] },
    { key: "transfer_certificate", label: "Transfer Certificate", path: "/transfer-certificate", icon: "📄", group: "Documentation", description: "Generate and print transfer certificates for students." },
    { key: "exam_results", label: "Exams(FA's, SA's)", path: "/exam-results", icon: "📝", group: "Examination", description: "Create exams, publish results, and manage report cards.", actions: ["Create Exam","Edit Exam","Grading Scales","Publish Results","Report Cards"] },
    { key: "tests", label: "Tests", path: "/tests", icon: "🧪", group: "Examination", description: "Record class-wise tests with date, maximum and minimum marks.", actions: ["Add Test","Edit Test","Remove Test"] },
    { key: "marks_entry", label: "Marks Entry", path: "/marks-entry", icon: "✏️", group: "Examination", description: "Enter exam marks, manage co-scholastic grades, and lock submissions.", actions: ["Enter Marks","Lock Marks","Co-Scholastic Marks","Term Details"] },
    { key: "results_overview", label: "Results Overview", path: "/results-overview", icon: "🧮", group: "Examination", description: "View and analyze student performance across exams and subjects.", actions: ["Results Overview","Class Gradebook"] },
    { key: "teacher_attendance", label: "Staff Attendance", path: "/teacher-attendance", icon: "🗓️", group: "Attendance Management", description: "Mark and review attendance for all staff (teachers, accountant, manager, etc.) and generate reports.", actions: ["Mark Attendance","Attendance History","Lock Attendance"] },
    { key: "student_attendance", label: "Student Attendance", path: "/student-attendance", icon: "📋", group: "Attendance Management", description: "Mark and track student attendance by class and date.", actions: ["Mark Attendance","Attendance History","Lock Attendance"] },
    { key: "attendance_overview", label: "Attendance Overview", path: "/attendance-overview", icon: "📈", group: "Attendance Management", description: "Monitor overall attendance patterns and generate attendance reports.", actions: ["Attendance Report","Class Summary"] },
    { key: "my_attendance", label: "My Attendance", path: "/my-attendance", icon: "🙋", group: "Attendance Management", description: "Your own attendance record, read-only (default for every user).", actions: ["My Attendance"] },
    { key: "my_schedule", label: "My Schedule", path: "/my-schedule", icon: "🕒", group: "Attendance Management", description: "Your weekly class timings and the timetables of classes you lead (default for every user).", actions: ["My Schedule","Class Timetable"] },
    { key: "class_management", label: "Class Management", path: "/class-management", icon: "🏫", group: "Staff and Administration", description: "Create classes, assign sections, and manage class-related settings.", actions: ["Create Class","Edit Class","Assign Section"] },
    { key: "teacher_management", label: "Teacher Management", path: "/teacher-management", icon: "🧑‍🏫", group: "Staff and Administration", description: "Manage teacher profiles, class assignments, and subject linkages.", actions: ["Add Teacher","Edit Teacher","Assign Class","Assign Subject"] },
    { key: "timetable", label: "Timetable", path: "/timetable", icon: "🗓️", group: "Staff and Administration", description: "Set the weekly class timetable: periods, times, subjects, and teachers.", actions: ["Set Timetable","Edit Periods","Assign Subject Teacher"] },
    { key: "users", label: "Users", path: "/users", icon: "👥", group: "Staff and Administration", description: "Manage staff accounts, roles, and page access permissions.", actions: ["Add User","Edit User","Page Access","Reset Password","Lock Access"] },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: "🔔", group: "Staff and Administration", description: "Send announcements, reminders, and alerts to staff and parents.", actions: ["Send Notification","Notification History"] },
    { key: "settings", label: "Settings", path: "/settings", icon: "⚙️", group: "Staff and Administration", description: "Update your profile information and change your password.", actions: ["Change Password","Edit Profile"] },
    { key: "my_profile", label: "My Profile", path: "/my-profile", icon: "👤", group: "Staff and Administration", description: "Your details, role and everything your login can access (default for every user)." }
];