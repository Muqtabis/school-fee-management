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
// Admin bypasses; staff roles need the page assigned.
// =====================================================
router.use(requirePage("students"));

// =====================================================
// LIST
// ADMIN + STAFF
// =====================================================
router.get(
    "/",
    requireRole("admin", "accountant", "principal", "manager"),
    studentController.getStudents
);

// =====================================================
// BULK IMPORT EXCEL
// ADMIN + STAFF
// (Must be placed before /:id)
// =====================================================
router.post(
    "/import",
    requireRole("admin", "accountant", "principal", "manager"),
    upload.single("file"),
    studentController.importStudents
);

// =====================================================
// SINGLE STUDENT
// ADMIN + STAFF
// =====================================================
router.get(
    "/:id",
    requireRole("admin", "accountant", "principal", "manager"),
    studentController.getStudent
);

// =====================================================
// EXAM RESULT HISTORY (published results only)
// ADMIN + STAFF — mirrors fee-history access so the
// student detail modal can show a "Results" tab alongside
// "Fee Account". Reuses the exams-module controller.
// (Multi-segment paths — no clash with GET "/:id".)
// =====================================================
router.get(
    "/:studentId/results",
    requireRole("admin", "accountant", "principal", "manager"),
    resultController.getStudentResultHistory
);

// =====================================================
// DOWNLOAD ONE REPORT CARD (in-memory PDF, no disk write)
// ADMIN + STAFF
// =====================================================
router.get(
    "/:studentId/report-card/:examId",
    requireRole("admin", "accountant", "principal", "manager"),
    resultController.getReportCard
);

// =====================================================
// CREATE
// ADMIN + STAFF
// =====================================================
router.post(
    "/",
    requireRole("admin", "accountant", "principal", "manager"),
    studentController.addStudent
);

// =====================================================
// UPDATE
// ADMIN + STAFF
// =====================================================
router.put(
    "/:id",
    requireRole("admin", "accountant", "principal", "manager"),
    studentController.updateStudent
);

// =====================================================
// ARCHIVE
// ADMIN + PRINCIPAL + MANAGER (students page)
// =====================================================
router.post(
    "/:id/archive",
    requireRole("admin", "principal", "manager"),
    studentController.archiveStudent
);

// =====================================================
// RESTORE
// ADMIN + PRINCIPAL + MANAGER (students page)
// =====================================================
router.post(
    "/:id/restore",
    requireRole("admin", "principal", "manager"),
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