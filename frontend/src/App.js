import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

import ProtectedRoute from "./components/ProtectedRoute";


function App() {

    return (

        <Routes>

            <Route
                path="/"
                element={
                    <Navigate to="/login" />
                }
            />


            <Route
                path="/login"
                element={<LoginPage />}
            />


            <Route
                path="/signup"
                element={<SignupPage />}
            />


            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/students"
                element={
                    <ProtectedRoute>
                        <StudentsPage />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/payments"
                element={
                    <ProtectedRoute>
                        <PaymentsPage />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/expenses"
                element={
                    <ProtectedRoute>
                        <ExpensesPage />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/reports"
                element={
                    <ProtectedRoute>
                        <ReportsPage />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/settings"
                element={
                    <ProtectedRoute>
                        <SettingsPage />
                    </ProtectedRoute>
                }
            />

        </Routes>

    );

}


export default App;