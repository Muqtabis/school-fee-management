// ============================================================
// SHARED REVERSE-REQUEST HELPERS for expenses / incomes.
// Non-approvers (anyone except admin/principal) submit a request
// with a reason; admin/principal list + approve (auto-reverse) or
// reject. Mirrors the payment reverse-request flow.
// ============================================================
const db = require("../db");
const logAudit = require("../utils/auditLogger");

const APPROVER_ROLES = ["admin", "principal"];
const isApprover = (req) => APPROVER_ROLES.includes(req?.user?.role);

function makeReverseRequestHandlers({ table, requestTable, entityIdColumn, entityLabel }) {
    // POST /:id/reverse — branch on role
    const reverse = (req, res) => {
        const id = Number(req.params.id);
        const reason = String(req.body?.reason || "").trim();
        if (!id || id <= 0) return res.status(400).json({ success: false, message: `Invalid ${entityLabel} ID.` });
        if (!reason) return res.status(400).json({ success: false, message: "A reversal reason is required." });

        db.get(`SELECT status FROM ${table} WHERE id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: `Unable to find ${entityLabel}.` });
            if (!row) return res.status(404).json({ success: false, message: `${Cap(entityLabel)} not found.` });
            if (row.status === "reversed") return res.status(409).json({ success: false, message: `This ${entityLabel} has already been reversed.` });

            if (!isApprover(req)) {
                db.run(
                    `INSERT INTO ${requestTable} (${entityIdColumn}, requestedBy, requestedByName, reason, status, createdAt) VALUES (?, ?, ?, ?, 'pending', ?)`,
                    [id, req.user.id, req.user.name || "", reason, new Date().toISOString()],
                    (insErr) => {
                        if (insErr) return res.status(500).json({ success: false, message: "Unable to submit reverse request." });
                        logAudit({ userId: req.user.id, action: "REVERSE_REQUESTED", entityType: entityLabel, entityId: id, details: { reason } })
                            .catch(() => {});
                        res.json({ success: true, requested: true, message: "Reverse request submitted for admin approval." });
                    }
                );
                return;
            }

            const reversedAt = new Date().toISOString();
            db.run(
                `UPDATE ${table} SET status = 'reversed', voidedAt = ?, voidedBy = ?, voidReason = ? WHERE id = ? AND (status IS NULL OR status != 'reversed')`,
                [reversedAt, req.user.id, reason, id],
                (updErr) => {
                    if (updErr) return res.status(500).json({ success: false, message: `Unable to reverse ${entityLabel}.` });
                    logAudit({ userId: req.user.id, action: "REVERSED", entityType: entityLabel, entityId: id, details: { reason, reversedAt } })
                        .catch(() => {});
                    res.json({ success: true, message: `${Cap(entityLabel)} reversed successfully.` });
                }
            );
        });
    };

    const listRequests = (req, res) => {
        db.all(
            `SELECT r.*, x.amount, x.${dateColumnFor(table)}, x.paymentMode
             FROM ${requestTable} r
             JOIN ${table} x ON x.id = r.${entityIdColumn}
             WHERE r.status = 'pending'
             ORDER BY r.createdAt DESC`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ success: false, message: "Unable to load reverse requests." });
                res.json(rows);
            }
        );
    };

    const approve = (req, res) => {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ success: false, message: "Invalid request ID." });
        db.get(`SELECT * FROM ${requestTable} WHERE id = ?`, [requestId], (err, request) => {
            if (err) return res.status(500).json({ success: false, message: "Database error." });
            if (!request) return res.status(404).json({ success: false, message: "Request not found." });
            if (request.status !== "pending") return res.status(409).json({ success: false, message: "This request was already reviewed." });

            const reversedAt = new Date().toISOString();
            db.run(
                `UPDATE ${table} SET status = 'reversed', voidedAt = ?, voidedBy = ?, voidReason = ? WHERE id = ? AND (status IS NULL OR status != 'reversed')`,
                [reversedAt, req.user.id, request.reason, request[entityIdColumn]],
                (revErr) => {
                    if (revErr) return res.status(500).json({ success: false, message: `Unable to reverse ${entityLabel}.` });
                    db.run(
                        `UPDATE ${requestTable} SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?`,
                        [req.user.id, reversedAt, requestId],
                        (updErr) => {
                            if (updErr) return res.status(500).json({ success: false, message: "Unable to update request." });
                            logAudit({ userId: req.user.id, action: "REVERSE_APPROVED", entityType: entityLabel, entityId: request[entityIdColumn], details: { reason: request.reason } })
                                .catch(() => {});
                            res.json({ success: true, message: "Request approved — reversed successfully." });
                        }
                    );
                }
            );
        });
    };

    const reject = (req, res) => {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ success: false, message: "Invalid request ID." });
        db.get(`SELECT * FROM ${requestTable} WHERE id = ?`, [requestId], (err, request) => {
            if (err) return res.status(500).json({ success: false, message: "Database error." });
            if (!request) return res.status(404).json({ success: false, message: "Request not found." });
            if (request.status !== "pending") return res.status(409).json({ success: false, message: "This request was already reviewed." });
            db.run(
                `UPDATE ${requestTable} SET status = 'rejected', reviewedBy = ?, reviewedAt = ? WHERE id = ?`,
                [req.user.id, new Date().toISOString(), requestId],
                (updErr) => {
                    if (updErr) return res.status(500).json({ success: false, message: "Unable to reject request." });
                    res.json({ success: true, message: "Reverse request rejected." });
                }
            );
        });
    };

    return { reverse, listRequests, approve, reject };
}

function Cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function dateColumnFor(table) { return table === "expenses" ? "expenseDate" : "incomeDate"; }

const expenseHandlers = makeReverseRequestHandlers({
    table: "expenses",
    requestTable: "expense_reverse_requests",
    entityIdColumn: "expenseId",
    entityLabel: "expense"
});

const incomeHandlers = makeReverseRequestHandlers({
    table: "incomes",
    requestTable: "income_reverse_requests",
    entityIdColumn: "incomeId",
    entityLabel: "income"
});

module.exports = {
    isApprover,
    reverseExpense: expenseHandlers.reverse,
    getExpenseReverseRequests: expenseHandlers.listRequests,
    approveExpenseRequest: expenseHandlers.approve,
    rejectExpenseRequest: expenseHandlers.reject,
    reverseIncome: incomeHandlers.reverse,
    getIncomeReverseRequests: incomeHandlers.listRequests,
    approveIncomeRequest: incomeHandlers.approve,
    rejectIncomeRequest: incomeHandlers.reject
};
