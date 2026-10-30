const express = require("express");
const router = express.Router();

const examController = require("../controllers/examController");
const resultController = require("../controllers/resultController");
const gradingController = require("../controllers/gradingController");
const coScholasticController = require("../controllers/coScholasticController");

const {
    requireRole,
    requirePage,
    requireAnyPage
} = require("../middleware/authMiddleware");

// Guard shorthands: the two audiences for this router.
// Marks Entry stays teacher-scoped inside the controller
// (a principal/manager granted the page sees an empty
// list rather than another teacher's work).
const teacher = [
    requireRole("admin", "teacher", "principal", "manager"),
    requirePage("marks_entry")
];
// Exam & Results management: admin, or principal/manager
// granted the "exam_results" page.
const examAdmin = [
    requireRole("admin", "principal", "manager"),
    requirePage("exam_results")
];


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

// Class-teacher-only authoring of the comprehensive card's Part 2:
// co-scholastic grades, attendance, physical stature, remark. The
// class-teacher (or admin) check is enforced inside the controller.
router.get("/:examId/co-scholastic", teacher, coScholasticController.getCoScholastic);
router.put("/:examId/co-scholastic", teacher, coScholasticController.saveCoScholastic);
router.put("/:examId/term-meta", teacher, coScholasticController.saveTermMeta);


// =====================================================
// ADMIN-FACING ENDPOINTS (Exam & Results)
//
// Literal-prefixed routes first (grading scales, exam
// definitions, student history) so they are never shadowed
// by the parameterized "/:examId/..." routes below.
// =====================================================

// Grading scales (configurable grading).
router.get("/grading-scales", examAdmin, gradingController.getGradingScales);
router.post("/grading-scales", examAdmin, gradingController.createGradingScale);
router.put("/grading-scales/:id", examAdmin, gradingController.updateGradingScale);
router.delete("/grading-scales/:id", examAdmin, gradingController.deleteGradingScale);

// Exam definitions (the exam as a whole, spanning classes).
// Shared by Marks Entry, Exam & Results AND Results Overview,
// so any of those page grants opens it.
router.get("/definitions", requireRole("admin", "teacher", "principal", "manager"), requireAnyPage("marks_entry", "exam_results", "results_overview"), examController.getExamDefinitions);
router.get("/definitions/:definitionId", examAdmin, examController.getExamDefinition);

// A student's structured result history across exams.
router.get("/students/:studentId/results", examAdmin, resultController.getStudentResultHistory);

// Create an exam (definition + one child exam per class).
router.post("/", examAdmin, examController.createExam);

// Per-exam (child, per-class) admin operations.
router.get("/:examId/subjects", examAdmin, examController.getExamSubjects);
router.put("/:examId/subjects", examAdmin, examController.updateExamSubjects);
router.post("/:examId/unlock", examAdmin, examController.unlockExam);

router.get("/:examId/results", requireRole("admin", "principal", "manager"), requireAnyPage("exam_results", "results_overview"), resultController.getExamResults);
router.post("/:examId/publish", examAdmin, resultController.publishExam);

router.post("/:examId/deliver", examAdmin, resultController.deliverResults);
router.post("/:examId/deliver/:studentId", examAdmin, resultController.resendResult);
router.get("/:examId/notifications", examAdmin, resultController.getExamNotifications);

router.get("/:examId/corrections", examAdmin, resultController.getCorrections);
router.post("/:examId/corrections", examAdmin, resultController.correctMark);

router.get("/:examId/report-card/:studentId", examAdmin, resultController.getReportCard);

// All students' cards for the exam's class, one combined PDF.
router.get("/:examId/report-cards", examAdmin, resultController.getClassReportCards);


module.exports = router;
