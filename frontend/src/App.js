import {
    Routes,
    Route,
    Navigate
} from "react-router-dom";


import LoginPage
    from "./pages/LoginPage";

import ForgotPasswordPage
    from "./pages/ForgotPasswordPage";

import ResetPasswordPage
    from "./pages/ResetPasswordPage";

import DashboardPage
    from "./pages/DashboardPage";

import StudentsPage
    from "./pages/StudentsPage";

import PaymentsPage
    from "./pages/PaymentsPage";

import ExpensesPage
    from "./pages/ExpensesPage";

import ReportsPage
    from "./pages/ReportsPage";

import SettingsPage
    from "./pages/SettingsPage";

import NotificationsPage
    from "./pages/NotificationsPage";

import UsersPage
    from "./pages/UsersPage";

import FeesPage
    from "./pages/FeesPage";

import ClassManagementPage
    from "./pages/ClassManagementPage";

import TeacherManagementPage
    from "./pages/TeacherManagementPage";

import StudentAttendancePage
    from "./pages/StudentAttendancePage";

import ExamResultsPage
    from "./pages/ExamResultsPage";

import ResultsOverviewPage
    from "./pages/ResultsOverviewPage";

import AttendanceOverviewPage
    from "./pages/AttendanceOverviewPage";

import MarksEntryPage
    from "./pages/MarksEntryPage";

import TeacherAttendancePage
    from "./pages/TeacherAttendancePage";

import MyAttendancePage
    from "./pages/MyAttendancePage";

import ProtectedRoute
    from "./components/ProtectedRoute";


function App() {

    return (

        <Routes>

            {/* =================================================
                ROOT
            ================================================= */}

            <Route
                path="/"
                element={
                    <Navigate
                        to="/login"
                        replace
                    />
                }
            />


            {/* =================================================
                LOGIN
            ================================================= */}

            <Route
                path="/login"
                element={
                    <LoginPage />
                }
            />


            {/* =================================================
                FORGOT PASSWORD
            ================================================= */}

            <Route
                path="/forgot-password"
                element={
                    <ForgotPasswordPage />
                }
            />


            {/* =================================================
                RESET PASSWORD
            ================================================= */}

            <Route
                path="/reset-password/:token"
                element={
                    <ResetPasswordPage />
                }
            />


            {/* =================================================
                SIGNUP
                DISABLED
            ================================================= */}

            <Route
                path="/signup"
                element={
                    <Navigate
                        to="/login"
                        replace
                    />
                }
            />


            {/* =================================================
                DASHBOARD
                ADMIN ONLY
            ================================================= */}

            <Route
                path="/dashboard"
                element={

                    <ProtectedRoute pageKey="dashboard">

                        <DashboardPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                STUDENTS
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/students"
                element={

                    <ProtectedRoute pageKey="students">

                        <StudentsPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                FEES
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/fees"
                element={

                    <ProtectedRoute pageKey="fees">

                        <FeesPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                PAYMENTS
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/payments"
                element={

                    <ProtectedRoute pageKey="payments">

                        <PaymentsPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                EXPENSES
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/expenses"
                element={

                    <ProtectedRoute pageKey="expenses">

                        <ExpensesPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                REPORTS
                ADMIN
            ================================================= */}

            <Route
                path="/reports"
                element={

                    <ProtectedRoute pageKey="reports">

                        <ReportsPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                CLASS MANAGEMENT
                ADMIN
            ================================================= */}

            <Route
                path="/class-management"
                element={
                    <ProtectedRoute pageKey="class_management">
                        <ClassManagementPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                TEACHER MANAGEMENT
                ADMIN
            ================================================= */}

            <Route
                path="/teacher-management"
                element={
                    <ProtectedRoute pageKey="teacher_management">
                        <TeacherManagementPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                EXAM & RESULTS
                ADMIN
            ================================================= */}

            <Route
                path="/exam-results"
                element={
                    <ProtectedRoute pageKey="exam_results">
                        <ExamResultsPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                RESULTS OVERVIEW (admin class-wise gradebook)
                ADMIN
            ================================================= */}

            <Route
                path="/results-overview"
                element={
                    <ProtectedRoute pageKey="results_overview">
                        <ResultsOverviewPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                ATTENDANCE OVERVIEW (admin class-wise summary)
                ADMIN
            ================================================= */}

            <Route
                path="/attendance-overview"
                element={
                    <ProtectedRoute pageKey="attendance_overview">
                        <AttendanceOverviewPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                MARKS ENTRY
                TEACHER
            ================================================= */}

            <Route
                path="/marks-entry"
                element={
                    <ProtectedRoute pageKey="marks_entry">
                        <MarksEntryPage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                TEACHER ATTENDANCE
                ADMIN + ASSIGNED MARKER
            ================================================= */}

            <Route
                path="/teacher-attendance"
                element={
                    <ProtectedRoute pageKey="teacher_attendance">
                        <TeacherAttendancePage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                STUDENT ATTENDANCE
                ADMIN + CLASS TEACHER
            ================================================= */}

            <Route
                path="/student-attendance"
                element={
                    <ProtectedRoute pageKey="student_attendance">
                        <StudentAttendancePage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                MY ATTENDANCE
                TEACHER (read-only self-view)
            ================================================= */}

            <Route
                path="/my-attendance"
                element={
                    <ProtectedRoute pageKey="my_attendance">
                        <MyAttendancePage />
                    </ProtectedRoute>
                }
            />


            {/* =================================================
                NOTIFICATIONS
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/notifications"
                element={

                    <ProtectedRoute pageKey="notifications">

                        <NotificationsPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                SETTINGS
                ADMIN + RECEPTIONIST
            ================================================= */}

            <Route
                path="/settings"
                element={

                    <ProtectedRoute pageKey="settings">

                        <SettingsPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                USERS
                ADMIN ONLY
            ================================================= */}

            <Route
                path="/users"
                element={

                    <ProtectedRoute pageKey="users">

                        <UsersPage />

                    </ProtectedRoute>

                }
            />


            {/* =================================================
                UNKNOWN ROUTE
            ================================================= */}

            <Route
                path="*"
                element={

                    <Navigate
                        to="/login"
                        replace
                    />

                }
            />

        </Routes>

    );

}


export default App;