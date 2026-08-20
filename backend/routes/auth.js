const express =
    require("express");

const router =
    express.Router();

const authController =
    require("../controllers/authController");

const {
    authenticateToken
} =
    require("../middleware/authMiddleware");


// =====================================================
// LOGIN
// =====================================================

router.post(
    "/login",
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
    authController.forgotPassword
);


// =====================================================
// RESET PASSWORD
// PUBLIC ROUTE
// =====================================================

router.post(
    "/reset-password/:token",
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


module.exports =
    router;