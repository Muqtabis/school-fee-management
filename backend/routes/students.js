const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { requireRole, requireAdmin } = require("../middleware/authMiddleware");
const multer = require("multer");

// Configure Multer for temp storage
const upload = multer({ dest: "uploads/" });

// =====================================================
// LIST
// ADMIN + RECEPTIONIST
// =====================================================
router.get(
    "/",
    requireRole("admin", "receptionist"),
    studentController.getStudents
);

// =====================================================
// BULK IMPORT EXCEL
// ADMIN + RECEPTIONIST
// (Must be placed before /:id)
// =====================================================
router.post(
    "/import",
    requireRole("admin", "receptionist"),
    upload.single("file"),
    studentController.importStudents
);

// =====================================================
// SINGLE STUDENT
// ADMIN + RECEPTIONIST
// =====================================================
router.get(
    "/:id",
    requireRole("admin", "receptionist"),
    studentController.getStudent
);

// =====================================================
// CREATE
// ADMIN + RECEPTIONIST
// =====================================================
router.post(
    "/",
    requireRole("admin", "receptionist"),
    studentController.addStudent
);

// =====================================================
// UPDATE
// ADMIN + RECEPTIONIST
// =====================================================
router.put(
    "/:id",
    requireRole("admin", "receptionist"),
    studentController.updateStudent
);

// =====================================================
// ARCHIVE
// ADMIN ONLY
// =====================================================
router.post(
    "/:id/archive",
    requireAdmin,
    studentController.archiveStudent
);

// =====================================================
// RESTORE
// ADMIN ONLY
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
    requireAdmin,
    (req, res) => {
        return res.status(405).json({
            success: false,
            message: "Permanent student deletion is disabled. Use Archive instead."
        });
    }
);

module.exports = router;