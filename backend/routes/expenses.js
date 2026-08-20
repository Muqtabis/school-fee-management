const express =
    require("express");

const router =
    express.Router();

const expenseController =
    require("../controllers/expenseController");

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