const express =
    require("express");

const router =
    express.Router();

const incomeController =
    require("../controllers/incomeController");

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
// SINGLE INCOME
// ADMIN + STAFF
// =====================================================

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
// EDIT INCOME
// ADMIN + STAFF
// =====================================================

router.put(
    "/:id",
    incomeController.updateIncome
);


// =====================================================
// REVERSE INCOME
// ADMIN ONLY (finance)
// =====================================================

router.post(
    "/:id/reverse",
    requireAdmin,
    incomeController.reverseIncome
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
                "Incomes cannot be permanently deleted. Use reversal instead."

        });

    }
);


module.exports = router;
