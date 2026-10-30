const express =
    require("express");

const router =
    express.Router();

const expenseController =
    require("../controllers/expenseController");

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
// SINGLE EXPENSE
// ADMIN + STAFF
// =====================================================

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
// ADMIN ONLY (finance)
// =====================================================

router.post(
    "/:id/reverse",
    requireAdmin,
    expenseController.reverseExpense
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