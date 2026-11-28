const express =
    require("express");

const router =
    express.Router();

const incomeController =
    require("../controllers/incomeController");

const financeReverse =
    require("../controllers/financeReverseController");

const financeEdit =
    require("../controllers/financeEditController");

const {
    requireRole,
    requireAdmin,
    requirePage
} =
    require("../middleware/authMiddleware");


// =====================================================
// ADMIN + STAFF, WITH "incomes" PAGE ACCESS
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
    requirePage("incomes")
);


// =====================================================
// LIST
// ADMIN + STAFF
// =====================================================

router.get(
    "/",
    incomeController.getIncomes
);


// =====================================================
// INCOME SUMMARY
// ADMIN ONLY (finance)
// =====================================================

router.get(
    "/summary",
    requireAdmin,
    incomeController.incomeSummary
);


// =====================================================
// INCOME CATEGORIES (dynamic, admin-created)
// LIST: admin + staff  |  MUTATE: admin only (finance)
// Declared before "/:id" so "categories" isn't captured as an id.
// =====================================================

router.get(
    "/categories",
    incomeController.getIncomeCategories
);

router.post(
    "/categories",
    requireAdmin,
    incomeController.createIncomeCategory
);

router.put(
    "/categories/:id",
    requireAdmin,
    incomeController.updateIncomeCategory
);

router.delete(
    "/categories/:id",
    requireAdmin,
    incomeController.deleteIncomeCategory
);


// =====================================================
// REVERSE REQUESTS (admin / principal only to review)
// Declared before "/:id" so "reverse-requests" isn't
// captured as an id.
// =====================================================

router.get(
    "/reverse-requests",
    requireRole("admin", "principal"),
    financeReverse.getIncomeReverseRequests
);

router.post(
    "/reverse-requests/:id/approve",
    requireRole("admin", "principal"),
    financeReverse.approveIncomeRequest
);

router.post(
    "/reverse-requests/:id/reject",
    requireRole("admin", "principal"),
    financeReverse.rejectIncomeRequest
);


// =====================================================
// SINGLE INCOME
// ADMIN + STAFF
// =====================================================

// Declared before "/:id" to avoid route collisions.
router.post(
    "/:id/edit-request",
    financeEdit.requestIncomeEdit
);
router.get(
    "/edit-requests",
    requireRole("admin", "principal"),
    financeEdit.getIncomeEditRequests
);
router.post(
    "/edit-requests/:id/approve",
    requireRole("admin", "principal"),
    financeEdit.approveIncomeEdit
);
router.post(
    "/edit-requests/:id/reject",
    requireRole("admin", "principal"),
    financeEdit.rejectIncomeEdit
);
router.get(
    "/:id",
    incomeController.getIncome
);


// =====================================================
// CREATE INCOME
// ADMIN + STAFF
// =====================================================

router.post(
    "/",
    incomeController.addIncome
);


// =====================================================
// REVERSE INCOME
// ADMIN + PRINCIPAL reverse directly; other staff submit
// a request for approval.
// =====================================================

router.post(
    "/:id/reverse",
    financeReverse.reverseIncome
);





module.exports = router;
