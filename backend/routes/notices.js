const express = require("express");
const router = express.Router();
const c = require("../controllers/noticeController");
const { requireRole, requirePage } = require("../middleware/authMiddleware");

// READ — every logged-in staff member (admin, principal, manager,
// accountant, teacher, supporting_teacher) can see notices.
router.get("/", requireRole("admin", "accountant", "principal", "manager", "teacher", "supporting_teacher"), c.listNotices);
router.post("/:id/read", requireRole("admin", "accountant", "principal", "manager", "teacher", "supporting_teacher"), c.markRead);

// WRITE — notice management is a permission-controlled action.
router.post("/", requirePage("notices"), c.createNotice);
router.put("/:id", requirePage("notices"), c.updateNotice);
router.delete("/:id", requirePage("notices"), c.deleteNotice);

module.exports = router;
