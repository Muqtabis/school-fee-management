import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import ArchivedStudentsPage from "./pages/ArchivedStudentsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import IncomesPage from "./pages/IncomesPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import UsersPage from "./pages/UsersPage";
import FeesPage from "./pages/FeesPage";
import FeeConcessionPage from "./pages/FeeConcessionPage";
import ClassManagementPage from "./pages/ClassManagementPage";
import TeacherManagementPage from "./pages/TeacherManagementPage";
import StudentAttendancePage from "./pages/StudentAttendancePage";
import ExamResultsPage from "./pages/ExamResultsPage";
import ResultsOverviewPage from "./pages/ResultsOverviewPage";
import AttendanceOverviewPage from "./pages/AttendanceOverviewPage";
import MarksEntryPage from "./pages/MarksEntryPage";
import TeacherAttendancePage from "./pages/TeacherAttendancePage";
import MyAttendancePage from "./pages/MyAttendancePage";
import MySchedulePage from "./pages/MySchedulePage";
import TimetablePage from "./pages/TimetablePage";
import DefaultersPage from "./pages/DefaultersPage";
import TransferCertificatePage from "./pages/TransferCertificatePage";
import ProtectedRoute from "./components/ProtectedRoute";
import DialogHost from "./components/DialogHost";

// App-like shell on phones; full original pages everywhere.
import MobileShell from "./components/mobile/MobileShell";
import CommandPalette from "./components/CommandPalette";
import OfflineBanner from "./components/OfflineBanner";
import usePullToRefresh from "./hooks/usePullToRefresh";

function App() {
    const ptrActive = usePullToRefresh();
    return (
        <>
            <OfflineBanner />
            <CommandPalette />
            <div className={"ptr-indicator" + (ptrActive ? " active" : "")}>↓ Release to refresh</div>
            <MobileShell>
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                    <Route path="/signup" element={<Navigate to="/login" replace />} />

                    <Route path="/dashboard" element={<ProtectedRoute pageKey="dashboard"><DashboardPage /></ProtectedRoute>} />
                    <Route path="/students" element={<ProtectedRoute pageKey="students"><StudentsPage /></ProtectedRoute>} />
                    <Route path="/archived-students" element={<ProtectedRoute pageKey="archived_students"><ArchivedStudentsPage /></ProtectedRoute>} />
                    <Route path="/fees" element={<ProtectedRoute pageKey="fees"><FeesPage /></ProtectedRoute>} />
                    <Route path="/fee-concessions" element={<ProtectedRoute pageKey="fee_concessions"><FeeConcessionPage /></ProtectedRoute>} />
                    <Route path="/transfer-certificate" element={<ProtectedRoute pageKey="transfer_certificate"><TransferCertificatePage /></ProtectedRoute>} />
                    <Route path="/payments" element={<ProtectedRoute pageKey="payments"><PaymentsPage /></ProtectedRoute>} />
                    <Route path="/expenses" element={<ProtectedRoute pageKey="expenses"><ExpensesPage /></ProtectedRoute>} />
                    <Route path="/incomes" element={<ProtectedRoute pageKey="incomes"><IncomesPage /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute pageKey="reports"><ReportsPage /></ProtectedRoute>} />
                    <Route path="/defaulters" element={<ProtectedRoute pageKey="defaulters"><DefaultersPage /></ProtectedRoute>} />
                    <Route path="/class-management" element={<ProtectedRoute pageKey="class_management"><ClassManagementPage /></ProtectedRoute>} />
                    <Route path="/teacher-management" element={<ProtectedRoute pageKey="teacher_management"><TeacherManagementPage /></ProtectedRoute>} />
                    <Route path="/timetable" element={<ProtectedRoute pageKey="timetable"><TimetablePage /></ProtectedRoute>} />
                    <Route path="/exam-results" element={<ProtectedRoute pageKey="exam_results"><ExamResultsPage /></ProtectedRoute>} />
                    <Route path="/results-overview" element={<ProtectedRoute pageKey="results_overview"><ResultsOverviewPage /></ProtectedRoute>} />
                    <Route path="/attendance-overview" element={<ProtectedRoute pageKey="attendance_overview"><AttendanceOverviewPage /></ProtectedRoute>} />
                    <Route path="/marks-entry" element={<ProtectedRoute pageKey="marks_entry"><MarksEntryPage /></ProtectedRoute>} />
                    <Route path="/teacher-attendance" element={<ProtectedRoute pageKey="teacher_attendance"><TeacherAttendancePage /></ProtectedRoute>} />
                    <Route path="/student-attendance" element={<ProtectedRoute pageKey="student_attendance"><StudentAttendancePage /></ProtectedRoute>} />
                    <Route path="/my-attendance" element={<ProtectedRoute pageKey="my_attendance"><MyAttendancePage /></ProtectedRoute>} />
                    <Route path="/my-schedule" element={<ProtectedRoute pageKey="my_schedule"><MySchedulePage /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute pageKey="notifications"><NotificationsPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute pageKey="settings"><SettingsPage /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute pageKey="users"><UsersPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </MobileShell>
            <DialogHost />
        </>
    );
}

export default App;
