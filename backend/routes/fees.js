const express = require("express");

const router = express.Router();

const feeController = require("../controllers/feeController");

const {
    requireRole,
    requireAdmin
} = require("../middleware/authMiddleware");


// =====================================================
// ALLOWED ROLES
// ADMIN + RECEPTIONIST
// =====================================================

router.use(
    requireRole(
        "admin",
        "receptionist"
    )
);


// =====================================================
// ACADEMIC YEARS
// =====================================================

// View academic years
router.get(
    "/academic-years",
    feeController.getAcademicYears
);


// -----------------------------------------------------
// CREATE ACADEMIC YEAR
// ADMIN ONLY
// -----------------------------------------------------

router.post(
    "/academic-years",
    requireAdmin,
    feeController.createAcademicYear
);


// -----------------------------------------------------
// ACTIVATE ACADEMIC YEAR
// ADMIN + RECEPTIONIST
// -----------------------------------------------------

router.post(
    "/academic-years/:id/activate",
    feeController.activateAcademicYear
);


// =====================================================
// FEE STRUCTURES
// ADMIN + RECEPTIONIST
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
// ADMIN + RECEPTIONIST
// -----------------------------------------------------

router.post(
    "/structures",
    feeController.createStructure
);


// -----------------------------------------------------
// UPDATE CLASS STRUCTURE
// ADMIN + RECEPTIONIST
// -----------------------------------------------------

router.put(
    "/structures/:id",
    feeController.updateStructure
);


// -----------------------------------------------------
// COPY STRUCTURE
// ADMIN + RECEPTIONIST
// -----------------------------------------------------

router.post(
    "/structures/:id/copy/:targetYearId",
    feeController.copyStructure
);


// =====================================================
// PREPARE ACADEMIC YEAR
// ADMIN + RECEPTIONIST
// =====================================================

router.post(
    "/academic-years/:id/prepare",
    feeController.prepareAcademicYear
);


// =====================================================
// STUDENT FEE ACCOUNT
// ADMIN + RECEPTIONIST
// =====================================================

router.get(
    "/student/:studentId",
    feeController.getStudentFeeAccount
);


module.exports = router;