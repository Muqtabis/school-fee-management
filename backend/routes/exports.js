const express = require("express");
const router = express.Router();

const controller = require("../controllers/exportController");

const { requirePage } = require("../middleware/authMiddleware");

// =====================================================
// DATA EXPORT CENTER
// Complete Excel exports for the Reports page dropdown.
// Anyone holding the "reports" page grant may download;
// admins always pass. All handlers are read-only SELECTs.
// =====================================================

router.use(requirePage("reports"));

router.get("/students", controller.exportStudents);
router.get("/attendance-staff", controller.exportStaffAttendance);
router.get("/attendance-students", controller.exportStudentAttendance);
router.get("/exams", controller.exportExams);
router.get("/payments", controller.exportPayments);
router.get("/expenses", controller.exportExpenses);


module.exports =
    router;
