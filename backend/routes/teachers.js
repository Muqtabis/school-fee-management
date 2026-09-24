const express = require("express");
const router = express.Router();

const teacherController = require("../controllers/teacherController");

const {
    requireAdmin,
    requireTeacher,
    requirePage
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
// EVERYTHING BELOW IS TEACHER MANAGEMENT (ADMIN ONLY)
// Gated by both the admin role and the page permission.
// =====================================================

router.use(requireAdmin);
router.use(requirePage("teacher_management"));


// ---- Teachers ----
router.get("/", teacherController.getTeachers);


// ---- Class assignments (class teacher / general class link) ----
router.post("/:teacherId/classes", teacherController.assignClass);
router.delete("/:teacherId/classes", teacherController.unassignClass);


// ---- Subject-teacher assignments (standing Teacher -> Subject) ----
router.post("/:teacherId/subjects", teacherController.assignSubjectTeacher);
router.delete("/:teacherId/subjects", teacherController.unassignSubjectTeacher);


// ---- Subjects catalog (retrieved from Class Management) ----
router.get("/subjects", teacherController.getSubjects);
router.post("/subjects", teacherController.createSubject);
router.delete("/subjects/:id", teacherController.deleteSubject);


module.exports = router;
