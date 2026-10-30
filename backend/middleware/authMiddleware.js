const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET is not configured."
    );
}


// =====================================================
// AUTHENTICATE JWT
// =====================================================

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    if (!authHeader) {

        return res.status(401).json({

            success: false,

            message:
                "Authentication required."

        });

    }


    const parts =
        authHeader.split(" ");


    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid authorization format."

        });

    }


    const token =
        parts[1];


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        // =================================================
        // ONLY VALID APPLICATION ROLES
        // =================================================

        const VALID_ROLES = ["admin", "accountant", "principal", "manager", "teacher"];

        if (!VALID_ROLES.includes(decoded.role)) {

            return res.status(403).json({

                success: false,

                message:
                    "Invalid user role."

            });

        }


        req.user =
            decoded;


        next();

    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token."

        });

    }

}


// =====================================================
// ROLE AUTHORIZATION
// =====================================================

function requireRole(
    ...allowedRoles
) {

    return (
        req,
        res,
        next
    ) => {

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        if (
            !allowedRoles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You do not have permission for this action."

            });

        }


        next();

    };

}


// =====================================================
// PAGE ACCESS GUARD
//
// Enforces the admin-configured page access on the
// server side, so hiding a sidebar link in React is
// not the only thing protecting the data.
//
// - Admin always passes (never locked out).
// - Everyone else must have a matching row in
//   user_page_access for this pageKey.
// =====================================================

const { allQuery } = require("../db");

function requirePage(pageKey) {

    return async (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }


        // Admin bypasses page access entirely.
        if (req.user.role === "admin") {

            return next();

        }


        try {

            const rows = await allQuery(
                `
                SELECT 1
                FROM user_page_access
                WHERE userId = ? AND pageKey = ?
                LIMIT 1
                `,
                [req.user.id, pageKey]
            );


            if (!rows || rows.length === 0) {

                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this page."
                });

            }


            next();

        } catch (error) {

            console.error("Page Access Check Error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to verify page access."
            });

        }

    };

}


// =====================================================
// REQUIRE ANY PAGE
//
// Like requirePage, but passes when the user holds ANY of
// the given page keys. Used by endpoints shared by two
// pages (e.g. exam definitions serve both Marks Entry and
// Exam & Results; the attendance report serves both Student
// Attendance and Attendance Overview).
// =====================================================

function requireAnyPage(...pageKeys) {

    return async (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }


        // Admin bypasses page access entirely.
        if (req.user.role === "admin") {

            return next();

        }


        try {

            const placeholders = pageKeys.map(() => "?").join(", ");

            const rows = await allQuery(
                `
                SELECT 1
                FROM user_page_access
                WHERE userId = ? AND pageKey IN (${placeholders})
                LIMIT 1
                `,
                [req.user.id, ...pageKeys]
            );


            if (!rows || rows.length === 0) {

                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this page."
                });

            }


            next();

        } catch (error) {

            console.error("Page Access Check Error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to verify page access."
            });

        }

    };

}


// =====================================================
// ADMIN ONLY
// =====================================================

const requireAdmin =
    requireRole("admin");


// =====================================================
// STAFF ROLES (page-access managed)
//
// accountant (formerly "receptionist"), principal and
// manager all share the staff API surface; what each user
// actually reaches is narrowed by the admin-configured
// user_page_access rows (requirePage on page routes).
// =====================================================

const STAFF_ROLES = ["accountant", "principal", "manager"];

const requireStaff =
    requireRole("admin", ...STAFF_ROLES);


// =====================================================
// TEACHER (also allow admin, so admin can see/manage
// teacher-facing endpoints when needed)
// =====================================================

const requireTeacher =
    requireRole(
        "admin",
        "teacher"
    );


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    authenticateToken,

    requireRole,

    requireAdmin,

    requireStaff,

    requireTeacher,

    requirePage,

    requireAnyPage

};