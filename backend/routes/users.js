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
// ALL USER ROUTES ARE ADMIN ONLY
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
// CHANGE OWN PASSWORD
// =====================================================

router.put(
    "/change-own-password",
    userController.changeOwnPassword
);


module.exports = router;