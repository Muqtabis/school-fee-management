const express = require("express");
const router = express.Router();

const classController = require("../controllers/classController");
const { requireStaff } = require("../middleware/authMiddleware");

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

// DELETE CLASS
router.delete("/:id", classController.deleteClass);

module.exports = router;