const express = require("express");

const router = express.Router();

const expenseController =
    require("../controllers/expenseController");


// =====================================================
// EXPENSES
// =====================================================

// Get all expenses + filters
router.get(
    "/",
    expenseController.getExpenses
);


// =====================================================
// EXPENSE SUMMARY
// IMPORTANT: Keep this BEFORE /:id
// =====================================================
router.get("/summary", expenseController.expenseSummary);

// =====================================================
// SINGLE EXPENSE
// =====================================================

router.get(
    "/:id",
    expenseController.getExpense
);


// =====================================================
// ADD EXPENSE
// =====================================================

router.post(
    "/",
    expenseController.addExpense
);


// =====================================================
// UPDATE EXPENSE
// =====================================================

router.put(
    "/:id",
    expenseController.updateExpense
);


// =====================================================
// DELETE EXPENSE
// =====================================================

router.delete(
    "/:id",
    expenseController.deleteExpense
);


module.exports = router;