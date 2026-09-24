const express = require("express");
const router = express.Router();

const controller = require("../controllers/studentAttendanceController");

const {
    requireTeacher,
    requirePage
} = require("../middleware/authMiddleware");


// =====================================================
// STUDENT ATTENDANCE
//
// Marked by the CLASS TEACHER of a class (or admin).
// requireTeacher restricts to teacher/admin; requirePage
// enforces the "student_attendance" grant (admin bypasses);
// per-class ownership (class teacher?) is checked in the
// controller.
// =====================================================

router.use(requireTeacher);
router.use(requirePage("student_attendance"));

router.get("/my-classes", controller.getMyAttendanceClasses);
router.get("/report", controller.getClassAttendanceReport);
router.get("/summary", controller.getClassAttendanceSummary);
router.get("/", controller.getClassAttendance);
router.put("/", controller.saveClassAttendance);


module.exports = router;
