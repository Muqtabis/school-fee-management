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

                    <ProtectedRoute
                        roles={[
                            "admin"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            
                        ]}
                    >

                        <ReportsPage />

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin",
                            "receptionist"
                        ]}
                    >

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

                    <ProtectedRoute
                        roles={[
                            "admin"
                        ]}
                    >

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