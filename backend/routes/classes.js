const express = require("express");
const router = express.Router();

const classController = require("../controllers/classController");
const { requireStaff, requireRole, requirePage } = require("../middleware/authMiddleware");

// =====================================================
// ALLOWED ROLES: ADMIN + STAFF (accountant, principal, manager)
// =====================================================
router.use(requireStaff);

// -----------------------------------------------------
// READ-ONLY CLASS LIST
//
// Reference data consumed by several pages (Students class
// filter, exam setup, fee structures...), not just Class
// Management. Declared BEFORE the "class_management" page
// gate so a granted page that needs the list works
// standalone. Mutations stay gated below.
// -----------------------------------------------------
router.get("/", classController.getClasses);
router.get("/:id", classController.getClass);

// =====================================================
// PAGE ACCESS: "class_management"
// =====================================================
router.use(requirePage("class_management"));


// =====================================================
// CLASSES MANAGEMENT ROUTES
// =====================================================

// CREATE CLASS (Supports both standard and /add paths)
router.post("/", classController.createClass);
router.post("/add", classController.createClass);

// UPDATE CLASS
router.put("/:id", classController.updateClass);

// LOCK / UNLOCK CLASS — principal/manager with the page
// grant may manage this too (like admin).
router.post("/:id/lock", requireRole("admin", "principal", "manager"), classController.lockClass);
router.post("/:id/unlock", requireRole("admin", "principal", "manager"), classController.unlockClass);

// DELETE CLASS — destructive cascade; principal/manager with
// the page grant may manage this too (like admin).
router.delete("/:id", requireRole("admin", "principal", "manager"), classController.deleteClass);

module.exports = router;