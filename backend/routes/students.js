const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const resultController = require("../controllers/resultController");
const { requireRole, requireAdmin, requirePage } = require("../middleware/authMiddleware");
const multer = require("multer");

// Configure Multer for temp storage
const upload = multer({ dest: "uploads/" });

// =====================================================
// PAGE ACCESS: "students"
// Admin bypasses; receptionist needs the page assigned.
// =====================================================
router.use(requirePage("students"));

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
// EXAM RESULT HISTORY (published results only)
// ADMIN + RECEPTIONIST — mirrors fee-history access so the
// student detail modal can show a "Results" tab alongside
// "Fee Account". Reuses the exams-module controller.
// (Multi-segment paths — no clash with GET "/:id".)
// =====================================================
router.get(
    "/:studentId/results",
    requireRole("admin", "receptionist"),
    resultController.getStudentResultHistory
);

// =====================================================
// DOWNLOAD ONE REPORT CARD (in-memory PDF, no disk write)
// ADMIN + RECEPTIONIST
// =====================================================
router.get(
    "/:studentId/report-card/:examId",
    requireRole("admin", "receptionist"),
    resultController.getReportCard
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