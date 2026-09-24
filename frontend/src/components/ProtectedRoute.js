import {
    Navigate
} from "react-router-dom";

import {
    useAuth
} from "../context/AuthContext";

import {
    APP_PAGES
} from "../config/pages";


// =====================================================
// PROTECTED ROUTE
//
// Access is decided by page keys (admin-configured),
// not hardcoded roles.
//
// - pageKey: the page this route represents. If the
//   user is not allowed it, they are redirected to the
//   first page they ARE allowed (or /login if none).
// - Admin always passes (canAccess handles that).
// =====================================================

export default function ProtectedRoute({
    children,
    pageKey
}) {

    const {
        user,
        loading,
        allowedPages,
        canAccess
    } = useAuth();


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (
            <h2 style={{ textAlign: "center" }}>
                Loading...
            </h2>
        );

    }


    // =====================================================
    // NOT LOGGED IN
    // =====================================================

    if (!user) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    // =====================================================
    // PAGE ACCESS CHECK
    // =====================================================

    if (pageKey && !canAccess(pageKey)) {

        // Redirect to the first page this user can open.
        const firstAllowed = APP_PAGES.find(
            (page) => allowedPages.includes(page.key)
        );

        if (firstAllowed) {
            return (
                <Navigate
                    to={firstAllowed.path}
                    replace
                />
            );
        }

        // No pages assigned at all — send back to login.
        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    return children;

}
