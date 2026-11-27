const express =
    require("express");

const router =
    express.Router();

const expenseController =
    require("../controllers/expenseController");

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
// ADMIN + STAFF, WITH "expenses" PAGE ACCESS
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
    requirePage("expenses")
);


// =====================================================
// LIST
// ADMIN + STAFF
// =====================================================

router.get(
    "/",
    expenseController.getExpenses
);


// =====================================================
// EXPENSE SUMMARY
// ADMIN ONLY (finance)
// =====================================================

router.get(
    "/summary",
    requireAdmin,
    expenseController.expenseSummary
);


// =====================================================
// EXPENSE CATEGORIES (dynamic)
// LIST: admin + staff  |  MUTATE: admin only (finance)
// Declared before "/:id" so "categories" isn't captured as an id.
// =====================================================

router.get(
    "/categories",
    expenseController.getExpenseCategories
);

router.post(
    "/categories",
    requireAdmin,
    expenseController.createExpenseCategory
);

router.put(
    "/categories/:id",
    requireAdmin,
    expenseController.updateExpenseCategory
);

router.delete(
    "/categories/:id",
    requireAdmin,
    expenseController.deleteExpenseCategory
);


// =====================================================
// REVERSE REQUESTS (admin / principal only to review)
// Declared before "/:id" so "reverse-requests" isn't
// captured as an id.
// =====================================================

router.get(
    "/reverse-requests",
    requireRole("admin", "principal"),
    financeReverse.getExpenseReverseRequests
);

router.post(
    "/reverse-requests/:id/approve",
    requireRole("admin", "principal"),
    financeReverse.approveExpenseRequest
);

router.post(
    "/reverse-requests/:id/reject",
    requireRole("admin", "principal"),
    financeReverse.rejectExpenseRequest
);


// =====================================================
// SINGLE EXPENSE
// ADMIN + STAFF
// =====================================================

// Declared before "/:id" to avoid route collisions.
router.post(
    "/:id/edit-request",
    financeEdit.requestExpenseEdit
);
router.get(
    "/edit-requests",
    requireRole("admin", "principal"),
    financeEdit.getExpenseEditRequests
);
router.post(
    "/edit-requests/:id/approve",
    requireRole("admin", "principal"),
    financeEdit.approveExpenseEdit
);
router.post(
    "/edit-requests/:id/reject",
    requireRole("admin", "principal"),
    financeEdit.rejectExpenseEdit
);
router.get(
    "/:id",
    expenseController.getExpense
);


// =====================================================
// CREATE EXPENSE
// ADMIN + STAFF
// =====================================================

router.post(
    "/",
    expenseController.addExpense
);


// =====================================================
// EDIT EXPENSE
// ADMIN + STAFF
// =====================================================

router.put(
    "/:id",
    expenseController.updateExpense
);


// =====================================================
// REVERSE EXPENSE
// ADMIN + PRINCIPAL reverse directly; other staff submit
// a request for approval.
// =====================================================

router.post(
    "/:id/reverse",
    financeReverse.reverseExpense
);


// =====================================================
// DELETE DISABLED
// =====================================================

router.delete(
    "/:id",
    (
        req,
        res
    ) => {

        return res.status(405).json({

            success: false,

            message:
                "Expenses cannot be permanently deleted. Use reversal instead."

        });

    }
);


module.exports = router;