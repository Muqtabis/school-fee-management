const express = require("express");
const router = express.Router();
const feeController = require("../controllers/feeController");
const { requireRole, requireAdmin } = require("../middleware/authMiddleware");

// =====================================================
// ROLE
// =====================================================

router.use(requireRole("admin", "receptionist"));

// =====================================================
// ACADEMIC YEARS
// =====================================================

router.get("/academic-years", feeController.getAcademicYears);
router.post("/academic-years", requireAdmin, feeController.createAcademicYear);
router.post("/academic-years/:id/activate", requireAdmin, feeController.activateAcademicYear);

// =====================================================
// FEE STRUCTURES
// =====================================================

router.get("/structures", feeController.getStructures);
router.get("/structures/:id", feeController.getStructure);

// NEW: Route to create a new class structure dynamically
router.post("/structures", requireAdmin, feeController.createStructure);

router.put("/structures/:id", requireAdmin, feeController.updateStructure);
router.post("/structures/:id/copy/:targetYearId", requireAdmin, feeController.copyStructure);

// =====================================================
// PREPARE ACADEMIC YEAR
// =====================================================

router.post("/academic-years/:id/prepare", requireAdmin, feeController.prepareAcademicYear);

// =====================================================
// STUDENT FEE ACCOUNT
// =====================================================

router.get("/student/:studentId", feeController.getStudentFeeAccount);

module.exports = router;