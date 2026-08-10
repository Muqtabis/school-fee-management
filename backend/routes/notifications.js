const express = require("express");

const router = express.Router();

const notificationController =
    require("../controllers/notificationController");


/*
====================================================
GET ALL NOTIFICATIONS
====================================================
*/

router.get(
    "/",
    notificationController.getNotifications
);


/*
====================================================
GET SINGLE NOTIFICATION
====================================================
*/

router.get(
    "/:id",
    notificationController.getNotification
);


/*
====================================================
CREATE NOTIFICATION
====================================================
*/

router.post(
    "/",
    notificationController.createNotification
);


/*
====================================================
UPDATE NOTIFICATION STATUS
====================================================
*/

router.put(
    "/:id/status",
    notificationController.updateNotificationStatus
);


module.exports = router;