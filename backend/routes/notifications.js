const express =
    require("express");

const router =
    express.Router();

const notificationController =
    require("../controllers/notificationController");

const {
    requireRole
} =
    require("../middleware/authMiddleware");


// =====================================================
// ADMIN + RECEPTIONIST
// =====================================================

router.use(
    requireRole(
        "admin",
        "receptionist"
    )
);


// =====================================================
// GET ALL
// =====================================================

router.get(
    "/",
    notificationController.getNotifications
);


// =====================================================
// GET SINGLE
// =====================================================

router.get(
    "/:id",
    notificationController.getNotification
);


// =====================================================
// CREATE
// =====================================================

router.post(
    "/",
    notificationController.createNotification
);


// =====================================================
// STATUS
// =====================================================

router.put(
    "/:id/status",
    notificationController.updateNotificationStatus
);


// =====================================================
// RETRY
// =====================================================

router.post(
    "/:id/retry",
    notificationController.retryNotification
);


module.exports = router;