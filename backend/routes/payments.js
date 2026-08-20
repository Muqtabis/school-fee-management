const express =
    require("express");

const router =
    express.Router();

const paymentController =
    require("../controllers/paymentController");

const {
    requireRole,
    requireAdmin
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
// PAYMENT LIST
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/",
    paymentController.getPayments
);


// =====================================================
// DASHBOARD FINANCIAL SUMMARY
// ADMIN ONLY
// =====================================================

router.get(
    "/summary",
    requireAdmin,
    paymentController.dashboardSummary
);


// =====================================================
// FINANCIAL REPORT
// ADMIN ONLY
// =====================================================

router.get(
    "/report-summary",
    requireAdmin,
    paymentController.reportSummary
);


// =====================================================
// MONTHLY COLLECTION
// ADMIN ONLY
// =====================================================

router.get(
    "/monthly-collection",
    requireAdmin,
    paymentController.monthlyCollection
);


// =====================================================
// STUDENT FEE HISTORY
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/history/student/:studentId",
    paymentController.studentFeeHistory
);


// =====================================================
// RECEIPT
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/receipt/:id",
    paymentController.getReceipt
);


// =====================================================
// SINGLE PAYMENT
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/:id",
    paymentController.getPayment
);


// =====================================================
// ADD PAYMENT
// ADMIN + RECEPTIONIST
// =====================================================

router.post(
    "/",
    paymentController.addPayment
);


// =====================================================
// REVERSE PAYMENT
// ADMIN + RECEPTIONIST
// =====================================================

router.post(
    "/:id/reverse",
    paymentController.reversePayment
);


// =====================================================
// UPDATE DISABLED
// =====================================================

router.put(
    "/:id",
    paymentController.updatePayment
);


// =====================================================
// DELETE DISABLED
// =====================================================

router.delete(
    "/:id",
    paymentController.deletePayment
);


module.exports = router;