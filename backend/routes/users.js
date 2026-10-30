const express =
    require("express");

const router =
    express.Router();

const userController =
    require("../controllers/userController");

const {
    requireAdmin,
    requireRole,
    requirePage
} =
    require("../middleware/authMiddleware");


// =====================================================
// CHANGE OWN PASSWORD (any authenticated user)
// Declared BEFORE the admin gate so staff/teacher accounts
// can change their own password. Uses req.user.id, never a param.
// =====================================================

router.put(
    "/change-own-password",
    userController.changeOwnPassword
);


// =====================================================
// ALL REMAINING USER ROUTES
// ADMIN ONLY
//
// User management (accounts, roles, page access) never
// leaves admin hands: principal/manager are not granted
// the "users" page and the API rejects them outright.
// =====================================================

router.use(requireAdmin);


// =====================================================
// LIST USERS
// =====================================================

router.get(
    "/",
    userController.getUsers
);


// =====================================================
// CREATE STAFF / TEACHER USER
// =====================================================

router.post(
    "/",
    userController.createUser
);


// =====================================================
// RESET STAFF / TEACHER PASSWORD
// =====================================================

router.put(
    "/:id/password",
    userController.resetPassword
);


// =====================================================
// DELETE STAFF / TEACHER USER
// =====================================================

router.delete(
    "/:id",
    userController.deleteUser
);


// =====================================================
// PAGE ACCESS MANAGEMENT
// Same gate as above (admin, or principal/manager granted
// the "users" page).
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