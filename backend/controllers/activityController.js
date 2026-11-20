const db = require("../db");
const { requireRole } = require("../middleware/authMiddleware");

// Read-only recent activity feed for the Dashboard.
// Financial details stay role-gated: admin/accountant see everything,
// principal/manager see only non-financial actions (head-count, etc.).
const FINANCIAL_ACTIONS = new Set([
    "PAYMENT_CREATED", "PAYMENT_EDITED", "PAYMENT_REVERSED", "PAYMENT_REVERSE_REQUESTED",
    "PAYMENT_REVERSE_APPROVED", "EXPENSE_CREATED", "EXPENSE_UPDATED", "REVERSED",
    "REVERSE_REQUESTED", "REVERSE_APPROVED", "INCOME_CREATED", "INCOME_UPDATED"
]);

exports.recentActivity = (req, res) => {
    const isFull = req.user.role === "admin" || req.user.role === "accountant";
    const sql = `
        SELECT a.id, a.action, a.entityType, a.details, a.createdAt, u.name AS userName
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.userId
        ORDER BY a.id DESC
        LIMIT 60
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load activity." });
        const filtered = isFull ? rows : rows.filter((r) => !FINANCIAL_ACTIONS.has(r.action));
        res.json(filtered.slice(0, 10));
    });
};

// Route helper (attached in dashboard.js).
exports.recentActivityRoute = [requireRole("admin", "accountant", "principal", "manager"), exports.recentActivity];
