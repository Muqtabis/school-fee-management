const express = require("express");

const router = express.Router();

const feeController = require("../controllers/feeController");

const {
    requireRole,
    requireAdmin,
    requirePage
} = require("../middleware/authMiddleware");

// =====================================================
// ALLOWED ROLES
// ADMIN + STAFF, WITH "fees" PAGE ACCESS
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

// -----------------------------------------------------
// READ-ONLY ACADEMIC YEAR LIST
//
// Reference data consumed by many pages (Students, Payments,
// Reports, Exam & Results, ...), not just Fee Management.
// Declared BEFORE the "fees" page gate below so any granted
// page that needs the year list works standalone. Mutations
// remain gated.
// -----------------------------------------------------
router.get(
    "/academic-years",
    feeController.getAcademicYears
);

router.use(
    requirePage("fees")
);

// =====================================================
// ACADEMIC YEARS
// =====================================================

// -----------------------------------------------------
// CREATE ACADEMIC YEAR
// ADMIN ONLY (finance)
// -----------------------------------------------------
router.post(
    "/academic-years",
    requireAdmin,
    feeController.createAcademicYear
);

// -----------------------------------------------------
// ACTIVATE ACADEMIC YEAR
// ADMIN + STAFF
// -----------------------------------------------------
router.post(
    "/academic-years/:id/activate",
    feeController.activateAcademicYear
);

// =====================================================
// FEE STRUCTURES
// ADMIN + STAFF
// =====================================================

// -----------------------------------------------------
// LIST STRUCTURES
// -----------------------------------------------------
router.get(
    "/structures",
    feeController.getStructures
);

// -----------------------------------------------------
// SINGLE STRUCTURE
// -----------------------------------------------------
router.get(
    "/structures/:id",
    feeController.getStructure
);

// -----------------------------------------------------
// CREATE CLASS STRUCTURE
// ADMIN + STAFF
// -----------------------------------------------------
router.post(
    "/structures",
    feeController.createStructure
);

// -----------------------------------------------------
// UPDATE CLASS STRUCTURE
// ADMIN + STAFF
// -----------------------------------------------------
router.put(
    "/structures/:id",
    feeController.updateStructure
);

// -----------------------------------------------------
// COPY STRUCTURE
// ADMIN + STAFF
// -----------------------------------------------------
router.post(
    "/structures/:id/copy/:targetYearId",
    feeController.copyStructure
);

// =====================================================
// PREPARE ACADEMIC YEAR
// ADMIN + STAFF
// =====================================================
router.post(
    "/academic-years/:id/prepare",
    feeController.prepareAcademicYear
);

// =====================================================
// STUDENT FEE ACCOUNT
// ADMIN + STAFF
// =====================================================
router.get(
    "/student/:studentId",
    feeController.getStudentFeeAccount
);

// =====================================================
// DYNAMIC FEE COMPONENTS (NEW)
// =====================================================

router.get(
    "/components",
    feeController.getFeeComponents
);

router.post(
    "/components",
    requireAdmin,
    feeController.createFeeComponent
);

router.put(
    "/components/:id",
    requireAdmin,
    feeController.updateFeeComponent
);

router.delete(
    "/components/:id",
    requireAdmin,
    feeController.deleteFeeComponent
);

module.exports = router;