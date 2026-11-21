const express = require("express");
const router = express.Router();
const concessionController = require("../controllers/concessionController");
const { requireRole, requireAdmin, requirePage } = require("../middleware/authMiddleware");

// =====================================================
// PAGE ACCESS: "fee_concessions"
// =====================================================
router.use(requirePage("fee_concessions"));

// READ-ONLY TC concession records (before "/:studentId" routes).
router.get(
    "/tc-records",
    requireRole("admin", "accountant", "principal", "manager"),
    concessionController.getTCConcessions
);

// Previous-dues concessions (before "/:studentId" routes).
router.get(
    "/previous-dues",
    requireRole("admin", "accountant", "principal", "manager"),
    concessionController.getPreviousDuesConcessions
);
router.put(
    "/previous-dues/:studentId",
    requireRole("admin", "accountant", "principal", "manager"),
    concessionController.upsertPreviousDuesConcession
);

// =====================================================
// LIST
// ADMIN + STAFF (accountant, principal, manager)
// =====================================================
router.get(
    "/",
    requireRole("admin", "accountant", "principal", "manager"),
    concessionController.getConcessions
);

// =====================================================
// SAVE (create or update one student's category + concession)
// ADMIN + STAFF (accountant, principal, manager)
// =====================================================
router.put(
    "/:studentId",
    requireRole("admin", "accountant", "principal", "manager"),
    concessionController.upsertConcession
);

// =====================================================
// REMOVE
// ADMIN ONLY (finance — money-impacting reversal)
// =====================================================
router.delete(
    "/:studentId",
    requireAdmin,
    concessionController.deleteConcession
);

module.exports = router;
