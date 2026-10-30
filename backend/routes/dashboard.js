const express =
    require("express");

const router =
    express.Router();

const dashboardController =
    require("../controllers/dashboardController");

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


module.exports = router;
