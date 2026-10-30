const express =
    require("express");

const router =
    express.Router();

const paymentController =
    require("../controllers/paymentController");

const {
    requireRole,
    requireAdmin,
    requirePage
} =
    require("../middleware/authMiddleware");


// =====================================================
// ADMIN + STAFF, WITH "payments" PAGE ACCESS
// (admin bypasses the page check)
// =====================================================

router.use(
    requireRole(
        "admin",
        "accountant",
        "principal",
        "manager"
    )
);

router.use(
    requirePage("payments")
);


// =====================================================
// PAYMENT LIST
// ADMIN + STAFF
// =====================================================

router.get(
    "/",
    paymentController.getPayments
);


// =====================================================
// DASHBOARD FINANCIAL SUMMARY
// ADMIN + STAFF (accountant, principal, manager)
// =====================================================

router.get(
    "/summary",
    requireRole("admin", "accountant", "principal", "manager"),
    paymentController.dashboardSummary
);


// =====================================================
// FINANCIAL REPORT
// ADMIN ONLY (finance)
// =====================================================

router.get(
    "/report-summary",
    requireAdmin,
    paymentController.reportSummary
);


// =====================================================
// MONTHLY COLLECTION
// ADMIN ONLY (finance)
// =====================================================

router.get(
    "/monthly-collection",
    requireAdmin,
    paymentController.monthlyCollection
);


// =====================================================
// EXPORT BUNDLE (.zip: Excel + receipt PDFs)
// ADMIN ONLY (finance)  (declared before "/:id")
// =====================================================

router.get(
    "/export-bundle",
    requireAdmin,
    paymentController.exportBundle
);


// =====================================================
// STUDENT FEE HISTORY
// ADMIN + STAFF
// =====================================================

router.get(
    "/history/student/:studentId",
    paymentController.studentFeeHistory
);


// =====================================================
// RECEIPT
// ADMIN + STAFF
// =====================================================

router.get(
    "/receipt/:id",
    paymentController.getReceipt
);


// =====================================================
// SINGLE PAYMENT
// ADMIN + STAFF
// =====================================================

router.get(
    "/:id",
    paymentController.getPayment
);


// =====================================================
// ADD PAYMENT
// ADMIN + STAFF
// =====================================================

router.post(
    "/",
    paymentController.addPayment
);


// =====================================================
// REVERSE PAYMENT
// ADMIN + STAFF
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