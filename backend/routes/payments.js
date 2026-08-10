const express = require("express");

const router = express.Router();

const paymentController = require("../controllers/paymentController");

// =====================================================
// PAYMENTS
// =====================================================

// Get payments + filters
router.get(
    "/",
    paymentController.getPayments
);

// Dashboard summary
router.get(
    "/summary",
    paymentController.dashboardSummary
);

// Detailed reports
// IMPORTANT: keep this BEFORE /:id
router.get(
    "/report-summary",
    paymentController.reportSummary
);

// Monthly collection
router.get(
    "/monthly-collection",
    paymentController.monthlyCollection
);

// Student fee history
router.get(
    "/history/student/:studentId",
    paymentController.studentFeeHistory
);

// Receipt
router.get(
    "/receipt/:id",
    paymentController.getReceipt
);

// Single payment
router.get(
    "/:id",
    paymentController.getPayment
);

// Add payment
router.post(
    "/",
    paymentController.addPayment
);

// Update payment
router.put(
    "/:id",
    paymentController.updatePayment
);

// Delete payment
router.delete(
    "/:id",
    paymentController.deletePayment
);

module.exports = router;