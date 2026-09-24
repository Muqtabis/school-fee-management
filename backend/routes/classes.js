const express = require("express");
const router = express.Router();

const classController = require("../controllers/classController");
const { requireStaff, requireAdmin } = require("../middleware/authMiddleware");

// =====================================================
// ALLOWED ROLES: ADMIN + RECEPTIONIST
// =====================================================
router.use(requireStaff);


// =====================================================
// CLASSES MANAGEMENT ROUTES
// =====================================================

// LIST ALL CLASSES
router.get("/", classController.getClasses);

// GET SINGLE CLASS DETAILS
router.get("/:id", classController.getClass);

// CREATE CLASS (Supports both standard and /add paths)
router.post("/", classController.createClass);
router.post("/add", classController.createClass);

// UPDATE CLASS
router.put("/:id", classController.updateClass);

// LOCK / UNLOCK CLASS (admin-only) — a locked class cannot be deleted.
router.post("/:id/lock", requireAdmin, classController.lockClass);
router.post("/:id/unlock", requireAdmin, classController.unlockClass);

// DELETE CLASS (admin-only) — destructive cascade; matches unlock being admin-only.
router.delete("/:id", requireAdmin, classController.deleteClass);

module.exports = router;