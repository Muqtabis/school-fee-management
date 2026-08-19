const express = require("express");

const router = express.Router();

const paymentController =
    require("../controllers/paymentController");

const {
    requireRole
} = require("../middleware/authMiddleware");

// =====================================================
// ROLE
// =====================================================

router.use(
    requireRole(
        "admin",
        "receptionist"
    )
);

// =====================================================
// PAYMENTS
// =====================================================

router.get(
    "/",
    paymentController.getPayments
);

// =====================================================
// DASHBOARD SUMMARY
// IMPORTANT: BEFORE /:id
// =====================================================

router.get(
    "/summary",
    paymentController.dashboardSummary
);

// =====================================================
// REPORT SUMMARY
// IMPORTANT: BEFORE /:id
// =====================================================

router.get(
    "/report-summary",
    paymentController.reportSummary
);

// =====================================================
// MONTHLY COLLECTION
// IMPORTANT: BEFORE /:id
// =====================================================

router.get(
    "/monthly-collection",
    paymentController.monthlyCollection
);

// =====================================================
// STUDENT HISTORY
// =====================================================

router.get(
    "/history/student/:studentId",
    paymentController.studentFeeHistory
);

// =====================================================
// RECEIPT
// =====================================================

router.get(
    "/receipt/:id",
    paymentController.getReceipt
);

// =====================================================
// SINGLE PAYMENT
// =====================================================

router.get(
    "/:id",
    paymentController.getPayment
);

// =====================================================
// ADD PAYMENT
// =====================================================

router.post(
    "/",
    paymentController.addPayment
);

// =====================================================
// REVERSE PAYMENT
// =====================================================

router.post(
    "/:id/reverse",
    paymentController.reversePayment
);

// =====================================================
// DISABLED
// =====================================================

router.put(
    "/:id",
    paymentController.updatePayment
);

router.delete(
    "/:id",
    paymentController.deletePayment
);

module.exports = router;