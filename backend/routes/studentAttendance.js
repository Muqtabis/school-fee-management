const express = require("express");
const router = express.Router();

const controller = require("../controllers/studentAttendanceController");

const {
    requireRole,
    requirePage,
    requireAnyPage
} = require("../middleware/authMiddleware");


// =====================================================
// STUDENT ATTENDANCE
//
// Marked by the CLASS TEACHER of a class (or admin, or a
// principal/manager granted the page). The role gate now
// also accepts principal/manager; requirePage enforces the
// "student_attendance" grant (admin bypasses); per-class
// ownership checks stay in the controller.
// =====================================================

router.use(requireRole("admin", "teacher", "principal", "manager"));

router.get("/my-classes", requirePage("student_attendance"), controller.getMyAttendanceClasses);
// The report is shared with the Attendance Overview page,
// which carries its own page key.
router.get("/report", requireAnyPage("student_attendance", "attendance_overview"), controller.getClassAttendanceReport);
router.get("/summary", requirePage("student_attendance"), controller.getClassAttendanceSummary);
router.get("/", requirePage("student_attendance"), controller.getClassAttendance);
router.put("/", requirePage("student_attendance"), controller.saveClassAttendance);


module.exports = router;
