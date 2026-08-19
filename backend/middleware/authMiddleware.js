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

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            success: false,
            message: "Authentication required."
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
            message: "Invalid authorization format."
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

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    }

}


// =====================================================
// ROLE AUTHORIZATION
// =====================================================

function requireRole(...allowedRoles) {

    return (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }

        if (
            !allowedRoles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({
                success: false,
                message: "You do not have permission for this action."
            });

        }

        next();

    };

}


// =====================================================
// ADMIN
// =====================================================

const requireAdmin =
    requireRole("admin");


module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin
};