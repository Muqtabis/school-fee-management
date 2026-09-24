const express =
    require("express");

const router =
    express.Router();

const userController =
    require("../controllers/userController");

const {
    requireAdmin
} =
    require("../middleware/authMiddleware");


// =====================================================
// CHANGE OWN PASSWORD (any authenticated user)
// Declared BEFORE the admin gate so receptionists/teachers
// can change their own password. Uses req.user.id, never a param.
// =====================================================

router.put(
    "/change-own-password",
    userController.changeOwnPassword
);


// =====================================================
// ALL REMAINING USER ROUTES ARE ADMIN ONLY
// =====================================================

router.use(
    requireAdmin
);


// =====================================================
// LIST USERS
// =====================================================

router.get(
    "/",
    userController.getUsers
);


// =====================================================
// CREATE RECEPTIONIST
// =====================================================

router.post(
    "/",
    userController.createUser
);


// =====================================================
// RESET RECEPTIONIST PASSWORD
// =====================================================

router.put(
    "/:id/password",
    userController.resetPassword
);


// =====================================================
// DELETE RECEPTIONIST
// =====================================================

router.delete(
    "/:id",
    userController.deleteUser
);


// =====================================================
// PAGE ACCESS MANAGEMENT
// ADMIN ONLY (whole router is requireAdmin)
// =====================================================

// Master list of assignable pages
router.get(
    "/pages/registry",
    userController.getPageRegistry
);

// Get a user's current page access + lock state
router.get(
    "/:id/pages",
    userController.getUserPages
);

// Replace a user's page access
router.put(
    "/:id/pages",
    userController.setUserPages
);

// Lock / unlock a user's page access
router.post(
    "/:id/lock",
    userController.lockUserAccess
);

router.post(
    "/:id/unlock",
    userController.unlockUserAccess
);


module.exports = router;