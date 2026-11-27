const express =
    require("express");

const router =
    express.Router();

const dashboardController =
    require("../controllers/dashboardController");

const activityController =
    require("../controllers/activityController");

const { requireRole } =
    require("../middleware/authMiddleware");


// =====================================================
// DASHBOARD SUMMARY
// ADMIN + STAFF (accountant, principal, manager)
//
// Mounted OUTSIDE the payments router so it is NOT
// gated by the "payments" page grant — only by role.
// Financial fields are zeroed server-side for
// principal and manager.
// =====================================================

router.get(
    "/summary",
    requireRole("admin", "accountant", "principal", "manager"),
    dashboardController.summary
);

// Full staff list for the dashboard Staff card.
router.get(
    "/staff",
    requireRole("admin", "accountant", "principal", "manager"),
    dashboardController.staffList
);

// Recent activity feed (read-only, role-filtered).
router.get(
    "/activity",
    requireRole("admin", "accountant", "principal", "manager"),
    activityController.recentActivity
);


module.exports = router;
