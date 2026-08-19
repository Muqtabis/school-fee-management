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
// CREATE USER
// =====================================================

router.post(
    "/",
    userController.createUser
);


// =====================================================
// CHANGE ROLE
// =====================================================

router.put(
    "/:id/role",
    userController.changeRole
);


module.exports = router;