const express = require("express");
const router = express.Router();

const teacherController = require("../controllers/teacherController");

const {
    requireRole,
    requireTeacher,
    requirePage,
    requireAnyPage
} = require("../middleware/authMiddleware");


// =====================================================
// MY ASSIGNED CLASSES
// TEACHER or ADMIN — must come before the admin gate.
// Used by the Marks Entry page to know which classes
// the logged-in teacher may work on.
// =====================================================

router.get(
    "/my-classes",
    requireTeacher,
    teacherController.getMyClasses
);


// =====================================================
// EVERYTHING BELOW IS TEACHER MANAGEMENT
// Role gate: admin, or principal/manager. The page
// permission is applied PER ROUTE because the subjects
// catalog is shared with Class Management (either page
// grant opens it).
// =====================================================

router.use(requireRole("admin", "principal", "manager"));


// ---- Teachers ----
router.get("/", requirePage("teacher_management"), teacherController.getTeachers);


// ---- Class assignments (class teacher / general class link) ----
router.post("/:teacherId/classes", requirePage("teacher_management"), teacherController.assignClass);
router.delete("/:teacherId/classes", requirePage("teacher_management"), teacherController.unassignClass);


// ---- Subject-teacher assignments (standing Teacher -> Subject) ----
router.post("/:teacherId/subjects", requirePage("teacher_management"), teacherController.assignSubjectTeacher);
router.delete("/:teacherId/subjects", requirePage("teacher_management"), teacherController.unassignSubjectTeacher);


// ---- Subjects catalog (retrieved from Class Management) ----
// The catalog is edited from BOTH Teacher Management and
// Class Management, so either page grant opens it.
router.get("/subjects", requireAnyPage("teacher_management", "class_management"), teacherController.getSubjects);
router.post("/subjects", requireAnyPage("teacher_management", "class_management"), teacherController.createSubject);
router.delete("/subjects/:id", requireAnyPage("teacher_management", "class_management"), teacherController.deleteSubject);


module.exports = router;
