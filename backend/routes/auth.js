const express =
    require("express");

const router =
    express.Router();

const authController =
    require("../controllers/authController");

const userController =
    require("../controllers/userController");

const {
    authenticateToken
} =
    require("../middleware/authMiddleware");

const rateLimit =
    require("express-rate-limit");


// =====================================================
// BRUTE-FORCE PROTECTION
// Throttle the unauthenticated, credential-taking routes.
// Keyed by client IP; only failed logins count so a
// legitimate user isn't locked out after signing in.
// =====================================================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,                    // 10 failed logins per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: "Too many login attempts. Please try again in a few minutes."
    }
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 5,                     // 5 reset requests per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many password reset requests. Please try again later."
    }
});


// =====================================================
// LOGIN
// =====================================================

router.post(
    "/login",
    loginLimiter,
    authController.login
);


// =====================================================
// PUBLIC SIGNUP
// DISABLED BY CONTROLLER
// =====================================================

router.post(
    "/signup",
    authController.signup
);


// =====================================================
// FORGOT PASSWORD
// PUBLIC ROUTE
// =====================================================

router.post(
    "/forgot-password",
    passwordResetLimiter,
    authController.forgotPassword
);


// =====================================================
// RESET PASSWORD
// PUBLIC ROUTE
// =====================================================

router.post(
    "/reset-password/:token",
    passwordResetLimiter,
    authController.resetPassword
);


// =====================================================
// PROFILE
// AUTHENTICATED USERS ONLY
// =====================================================

router.get(
    "/profile",
    authenticateToken,
    authController.profile
);


// =====================================================
// MY PAGE ACCESS
// AUTHENTICATED USERS ONLY
//
// Frontend loads this at login to build the sidebar
// and gate routes.
// =====================================================

router.get(
    "/me/pages",
    authenticateToken,
    userController.getMyPages
);


module.exports =
    router;