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
router.get(
    "/defaulters",
    paymentController.getDefaulters
);

router.put(
    "/defaulters/:studentId/followup",
    paymentController.saveFollowUp
);


// REVERSE REQUESTS (admin / principal only)
// Declared before "/:id" routes to avoid route collisions.
// =====================================================

router.get(
    "/reverse-requests",
    requireRole("admin", "principal"),
    paymentController.getReverseRequests
);

router.post(
    "/reverse-requests/:id/approve",
    requireRole("admin", "principal"),
    paymentController.approveReverseRequest
);

router.post(
    "/reverse-requests/:id/reject",
    requireRole("admin", "principal"),
    paymentController.rejectReverseRequest
);


// =====================================================
// SINGLE PAYMENT
// ADMIN + STAFF
// =====================================================

// Declared before "/:id" to avoid route collisions.
// Edit requests (staff submit; admin/principal review).
router.post(
    "/:id/edit-request",
    paymentController.requestEdit
);
router.get(
    "/edit-requests",
    requireRole("admin", "principal"),
    paymentController.getEditRequests
);
router.post(
    "/edit-requests/:id/approve",
    requireRole("admin", "principal"),
    paymentController.approveEditRequest
);
router.post(
    "/edit-requests/:id/reject",
    requireRole("admin", "principal"),
    paymentController.rejectEditRequest
);



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
// EDIT PAYMENT (once-only)
// ADMIN + STAFF
// =====================================================

router.post(
    "/:id/edit",
    paymentController.editPayment
);

// =====================================================
// REVERSE PAYMENT
// ADMIN + STAFF (staff submit a request for approval)
// =====================================================

router.post(
    "/:id/reverse",
    paymentController.reversePayment
);

// Fix the explanation on an already-reversed payment (admin/principal only).
router.put(
    "/:id/void-reason",
    requireRole("admin", "principal"),
    paymentController.updateVoidReason
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