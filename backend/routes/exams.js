const express = require("express");
const router = express.Router();

const examController = require("../controllers/examController");
const resultController = require("../controllers/resultController");
const gradingController = require("../controllers/gradingController");

const {
    requireAdmin,
    requireTeacher,
    requirePage
} = require("../middleware/authMiddleware");

// Guard shorthands: the two audiences for this router.
const teacher = [requireTeacher, requirePage("marks_entry")];
const admin = [requireAdmin, requirePage("exam_results")];


// =====================================================
// TEACHER-FACING ENDPOINTS (Marks Entry)
//
// List the teacher's exams, load/save the marks grid, and
// submit (lock). Per-exam and per-SUBJECT authorization is
// enforced inside the controller — the backend is the final
// authority, a teacher cannot write another teacher's
// subjects or a class they are not assigned to.
// =====================================================

router.get("/", teacher, examController.getExams);
router.get("/:examId/marks", teacher, examController.getExamMarks);
router.put("/:examId/marks", teacher, examController.saveExamMarks);
router.post("/:examId/lock", teacher, examController.lockExam);


// =====================================================
// ADMIN-FACING ENDPOINTS (Exam & Results)
//
// Literal-prefixed routes first (grading scales, exam
// definitions, student history) so they are never shadowed
// by the parameterized "/:examId/..." routes below.
// =====================================================

// Grading scales (configurable grading).
router.get("/grading-scales", admin, gradingController.getGradingScales);
router.post("/grading-scales", admin, gradingController.createGradingScale);
router.put("/grading-scales/:id", admin, gradingController.updateGradingScale);
router.delete("/grading-scales/:id", admin, gradingController.deleteGradingScale);

// Exam definitions (the exam as a whole, spanning classes).
router.get("/definitions", requireTeacher, requirePage("marks_entry"), examController.getExamDefinitions);
router.get("/definitions/:definitionId", admin, examController.getExamDefinition);

// A student's structured result history across exams.
router.get("/students/:studentId/results", admin, resultController.getStudentResultHistory);

// Create an exam (definition + one child exam per class).
router.post("/", admin, examController.createExam);

// Per-exam (child, per-class) admin operations.
router.get("/:examId/subjects", admin, examController.getExamSubjects);
router.put("/:examId/subjects", admin, examController.updateExamSubjects);
router.post("/:examId/unlock", admin, examController.unlockExam);

router.get("/:examId/results", admin, resultController.getExamResults);
router.post("/:examId/publish", admin, resultController.publishExam);

router.post("/:examId/deliver", admin, resultController.deliverResults);
router.post("/:examId/deliver/:studentId", admin, resultController.resendResult);
router.get("/:examId/notifications", admin, resultController.getExamNotifications);

router.get("/:examId/corrections", admin, resultController.getCorrections);
router.post("/:examId/corrections", admin, resultController.correctMark);

router.get("/:examId/report-card/:studentId", admin, resultController.getReportCard);


module.exports = router;
