const express = require("express");

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
// PROFILE
// =====================================================

router.get(
    "/profile",
    authenticateToken,
    authController.profile
);


// =====================================================
// PUBLIC SIGNUP DISABLED
// =====================================================

router.post(
    "/signup",
    (
        req,
        res
    ) => {

        res.status(403).json({

            success: false,

            message:
                "Public signup is disabled. An administrator must create user accounts."

        });

    }
);


module.exports = router;