const express = require("express");
const router = express.Router();
const concessionController = require("../controllers/concessionController");
const { requireRole, requireAdmin, requirePage } = require("../middleware/authMiddleware");

// =====================================================
// PAGE ACCESS: "fee_concessions"
// =====================================================
router.use(requirePage("fee_concessions"));

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
