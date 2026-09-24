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
// ADMIN + RECEPTIONIST, WITH "expenses" PAGE ACCESS
// (admin bypasses the page check)
// =====================================================

router.use(
    requireRole(
        "admin",
        "receptionist"
    )
);

router.use(
    requirePage("expenses")
);


// =====================================================
// LIST
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/",
    expenseController.getExpenses
);


// =====================================================
// EXPENSE SUMMARY
// ADMIN ONLY
// =====================================================

router.get(
    "/summary",
    requireAdmin,
    expenseController.expenseSummary
);


// =====================================================
// EXPENSE CATEGORIES (dynamic)
// LIST: admin + receptionist  |  MUTATE: admin only
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
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/:id",
    expenseController.getExpense
);


// =====================================================
// CREATE EXPENSE
// ADMIN + RECEPTIONIST
// =====================================================

router.post(
    "/",
    expenseController.addExpense
);


// =====================================================
// EDIT EXPENSE
// ADMIN + RECEPTIONIST
// =====================================================

router.put(
    "/:id",
    expenseController.updateExpense
);


// =====================================================
// REVERSE EXPENSE
// ADMIN ONLY
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