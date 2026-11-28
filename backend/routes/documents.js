const express = require("express");
const router = express.Router();
const tc = require("../controllers/transferCertificateController");
const { requireRole, requirePage } = require("../middleware/authMiddleware");

// Documents — Transfer Certificate. Admin + staff with page access.
router.use(requireRole("admin", "accountant", "principal", "manager"));
router.use(requirePage("transfer_certificate"));

// TC Records (declared before "/:id" to avoid route collisions)
router.get("/records", tc.listTCs);
router.put("/records/:id", requireRole("admin", "principal"), tc.updateTC);
router.get("/records/:id/pdf", tc.downloadTC);
router.get("/balance/:id", tc.getOverallBalance);
router.post("/issue/:id", tc.issueTC);

router.get("/:id/pdf", tc.generateTransferCertificate);

module.exports = router;
