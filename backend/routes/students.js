const express =
    require("express");

const router =
    express.Router();

const studentController =
    require("../controllers/studentController");

const {
    requireRole,
    requireAdmin
} =
    require("../middleware/authMiddleware");


// =====================================================
// LIST
// =====================================================

router.get(
    "/",
    requireRole(
        "admin",
        "receptionist"
    ),
    studentController.getStudents
);


// =====================================================
// SINGLE STUDENT
// =====================================================

router.get(
    "/:id",
    requireRole(
        "admin",
        "receptionist"
    ),
    studentController.getStudent
);


// =====================================================
// CREATE
// =====================================================

router.post(
    "/",
    requireRole(
        "admin",
        "receptionist"
    ),
    studentController.addStudent
);


// =====================================================
// UPDATE
// =====================================================

router.put(
    "/:id",
    requireRole(
        "admin",
        "receptionist"
    ),
    studentController.updateStudent
);


// =====================================================
// ARCHIVE — ADMIN ONLY
// =====================================================

router.post(
    "/:id/archive",
    requireAdmin,
    studentController.archiveStudent
);


// =====================================================
// RESTORE — ADMIN ONLY
// =====================================================

router.post(
    "/:id/restore",
    requireAdmin,
    studentController.restoreStudent
);


// =====================================================
// PERMANENT DELETE DISABLED
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
                "Permanent student deletion is disabled. Use Archive instead."

        });

    }
);


module.exports = router;