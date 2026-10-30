const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");

const {
    requireRole,
    requirePage,
    requireAnyPage
} = require("../middleware/authMiddleware");


// =====================================================
// TEACHER / STAFF SELF-VIEW (read-only)
//
// Any logged-in staff user (teacher, accountant, principal,
// manager, ...) may read their OWN attendance. Declared
// BEFORE the marker page gate below.
// =====================================================

router.get(
    "/mine",
    requireRole("admin", "teacher", "accountant", "principal", "manager"),
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

// =====================================================
// ATTENDANCE OVERVIEW
// =====================================================
// Shared with Student Attendance page
router.get(
    "/overview",
    requireAnyPage("teacher_attendance", "attendance_overview"),
    attendanceController.getAttendanceOverview
);


module.exports = router;
