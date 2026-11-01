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
// "My Attendance" — a default page for every logged-in
// user (teacher, supporting_teacher, accountant,
// principal, manager, admin). supporting_staff is not
// listed because those accounts cannot log in at all.
// Declared BEFORE the marker page gate below.
// =====================================================

router.get(
    "/mine",
    requireRole("admin", "teacher", "supporting_teacher", "accountant", "principal", "manager"),
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

// =====================================================
// LOCK — any marker (admin, or a user granted the
// "teacher_attendance" page) may freeze a finished day.
// UNLOCK — admin & principal only.
// =====================================================

router.post(
    "/lock",
    requirePage("teacher_attendance"),
    attendanceController.setAttendanceLock
);

router.post(
    "/unlock",
    requireRole("admin", "principal"),
    attendanceController.setAttendanceUnlock
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
