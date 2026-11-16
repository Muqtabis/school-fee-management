const express = require("express");
const router = express.Router();

const controller = require("../controllers/timetableController");

const { requireRole, requirePage } = require("../middleware/authMiddleware");

// =====================================================
// TIMETABLE
//
// READ endpoints are open to every staff role (teachers see
// their own schedule and their classes' grids; other roles
// simply get empty results). The EDITOR meta and the SAVE
// are gated by the "timetable" page grant — admin always
// passes. Specific paths are declared BEFORE "/:className"
// so the param route never swallows them.
// =====================================================

router.use(requireRole("admin", "principal", "manager", "teacher", "supporting_teacher", "accountant"));

// --- classes list for dropdowns ---
router.get("/classes", controller.listClasses);

// --- editor meta (subject + teacher dropdowns) — needs the grant ---
router.get("/meta", requirePage("timetable"), controller.getEditorMeta);

// --- the logged-in user's own slots / class-teacher classes ---
router.get("/my/schedule", controller.getMySchedule);
router.get("/my/classes", controller.getMyClassTimetables);

// --- one class's grid (read) and its save (grant required) ---
router.get("/:className", controller.getTimetable);
router.put("/:className", requirePage("timetable"), controller.saveTimetable);


module.exports = router;
