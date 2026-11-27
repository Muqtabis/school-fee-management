const express = require("express");
const router = express.Router();
const c = require("../controllers/testController");
const { requireRole, requirePage } = require("../middleware/authMiddleware");

// Tests are an examination record. Read is open to staff with the
// page; writes stay with admin / principal.
const readers = [
    requireRole("admin", "principal", "manager", "accountant", "teacher", "supporting_teacher"),
    requirePage("tests")
];
const writers = [
    requireRole("admin", "principal"),
    requirePage("tests")
];

router.get("/classes", readers, c.getClasses);
router.get("/", readers, c.listTests);
router.post("/", writers, c.createTest);

// Per-test detail tabs (mirror the exam detail view).
router.get("/:id", readers, c.getTestDetail);
router.get("/:id/marks", readers, c.getTestMarks);
router.put("/:id/marks", writers, c.saveTestMarks);
router.get("/:id/results", readers, c.getTestResults);
router.get("/:id/schedule", readers, c.getTestSchedule);
router.get("/:id/delivery", readers, c.getTestDelivery);

router.put("/:id", writers, c.updateTest);
router.delete("/:id", writers, c.deleteTest);

module.exports = router;
