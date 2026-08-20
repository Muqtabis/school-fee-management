import {
    Navigate
} from "react-router-dom";

import {
    useAuth
} from "../context/AuthContext";


export default function ProtectedRoute({
    children,
    roles
}) {

    const {
        user,
        loading
    } = useAuth();


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <h2
                style={{
                    textAlign: "center"
                }}
            >
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
    // ROLE RESTRICTION
    // =====================================================

    if (
        roles &&
        !roles.includes(user.role)
    ) {

        // Receptionist
        if (
            user.role === "receptionist"
        ) {

            return (

                <Navigate
                    to="/fees"
                    replace
                />

            );

        }


        // Admin
        if (
            user.role === "admin"
        ) {

            return (

                <Navigate
                    to="/dashboard"
                    replace
                />

            );

        }


        // Unknown role
        return (

            <Navigate
                to="/login"
                replace
            />

        );

    }


    return children;

}