const express =
    require("express");

const router =
    express.Router();

const expenseController =
    require("../controllers/expenseController");

const {
    requireRole
} =
    require("../middleware/authMiddleware");


router.use(
    requireRole(
        "admin",
        "receptionist"
    )
);


// =====================================================
// LIST
// =====================================================

router.get(
    "/",
    expenseController.getExpenses
);


// =====================================================
// SUMMARY
// =====================================================

router.get(
    "/summary",
    expenseController.expenseSummary
);


// =====================================================
// SINGLE
// =====================================================

router.get(
    "/:id",
    expenseController.getExpense
);


// =====================================================
// CREATE
// =====================================================

router.post(
    "/",
    expenseController.addExpense
);


// =====================================================
// EDIT ACTIVE EXPENSE
// =====================================================

router.put(
    "/:id",
    expenseController.updateExpense
);


// =====================================================
// REVERSE
// ADMIN + RECEPTIONIST
// =====================================================

router.post(
    "/:id/reverse",
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

        res.status(405).json({

            success: false,

            message:
                "Expenses cannot be permanently deleted. Use reversal instead."

        });

    }
);


module.exports = router;