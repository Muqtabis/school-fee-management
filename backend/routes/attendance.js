const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");

const {
    requireTeacher,
    requirePage
} = require("../middleware/authMiddleware");


// =====================================================
// TEACHER SELF-VIEW (read-only)
//
// Any teacher (or admin) may read their own attendance.
// Declared BEFORE the marker page gate below.
// =====================================================

router.get(
    "/mine",
    requireTeacher,
    attendanceController.getMyAttendance
);


// =====================================================
// MARKER ENDPOINTS
//
// Admin, or whichever user the admin granted the
// "teacher_attendance" page, may mark and review all
// teachers' attendance. requirePage lets admin bypass
// and requires the grant for everyone else.
// =====================================================

router.get(
    "/",
    requirePage("teacher_attendance"),
    attendanceController.getAttendanceForDate
);

router.put(
    "/",
    requirePage("teacher_attendance"),
    attendanceController.saveAttendance
);

router.get(
    "/report",
    requirePage("teacher_attendance"),
    attendanceController.getAttendanceReport
);

router.get(
    "/summary",
    requirePage("teacher_attendance"),
    attendanceController.getAttendanceSummary
);


module.exports = router;
