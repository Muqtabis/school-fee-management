// ============================================================
// SHARED EDIT-REQUEST HELPERS for expenses / incomes.
// Non-approvers propose changes with a reason; admin/principal
// list + approve (apply) or reject. Mirrors payment edit requests.
// ============================================================
const db = require("../db");
const logAudit = require("../utils/auditLogger");

const APPROVER_ROLES = ["admin", "principal"];
const isApprover = (req) => APPROVER_ROLES.includes(req?.user?.role);
const validReason = (r) => r.length >= 10 && !/^(.)\1+$/.test(r);

function makeEditRequestHandlers({ table, requestTable, entityIdColumn, entityLabel, applyFields, labelColumn }) {
    // POST /:id/edit-request — staff submit, approvers apply directly.
    const requestEdit = (req, res) => {
        const id = Number(req.params.id);
        const reason = String(req.body?.reason || "").trim();
        if (!id || id <= 0) return res.status(400).json({ success: false, message: `Invalid ${entityLabel} ID.` });
        // Approvers may edit directly without a reason; staff must supply one.
        if (!isApprover(req) && !validReason(reason)) return res.status(400).json({ success: false, message: "Please enter a clear reason (at least 10 characters)." });

        const proposed = {};
        applyFields.forEach((f) => { if (typeof req.body[f] !== "undefined") proposed[f] = req.body[f]; });
        if (!Object.keys(proposed).length) return res.status(400).json({ success: false, message: "No changes supplied." });

        db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
            if (err) return res.status(500).json({ success: false, message: "Database error." });
            if (!row) return res.status(404).json({ success: false, message: `${Cap(entityLabel)} not found.` });
            if (row.status === "reversed") return res.status(409).json({ success: false, message: `A reversed ${entityLabel} cannot be edited.` });
            if (Number(row.editCount || 0) >= 1) return res.status(409).json({ success: false, message: `This ${entityLabel} has already been edited once.` });

            if (isApprover(req)) {
                return applyEdit(row, proposed, req.user.id, (e) => {
                    if (e) return res.status(500).json({ success: false, message: e.message || `Unable to edit ${entityLabel}.` });
                    logAudit({ userId: req.user.id, action: `${entityLabel.toUpperCase()}_EDITED`, entityType: entityLabel, entityId: id, details: { direct: true } }).catch(() => {});
                    res.json({ success: true, applied: true, message: `${Cap(entityLabel)} edited successfully.` });
                });
            }

            // Resolve requester name from users (older tokens may lack it).
            db.get(`SELECT name, email FROM users WHERE id = ?`, [req.user.id], (uErr, u) => {
                const name = req.user.name || u?.name || u?.email || "";
                db.get(`SELECT id FROM ${requestTable} WHERE ${entityIdColumn} = ? AND status = 'pending'`, [id], (pErr, pending) => {
                    if (pErr) return res.status(500).json({ success: false, message: "Database error." });
                    if (pending) return res.status(409).json({ success: false, message: `An edit request is already pending for this ${entityLabel}.` });
                    db.run(
                        `INSERT INTO ${requestTable} (${entityIdColumn}, requestedBy, requestedByName, reason, proposed, status, createdAt)
                         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
                        [id, req.user.id, name, reason, JSON.stringify(proposed), new Date().toISOString()],
                        (iErr) => {
                            if (iErr) return res.status(500).json({ success: false, message: "Unable to submit edit request." });
                            logAudit({ userId: req.user.id, action: `${entityLabel.toUpperCase()}_EDIT_REQUESTED`, entityType: entityLabel, entityId: id, details: { reason } }).catch(() => {});
                            res.json({ success: true, requested: true, message: "Edit request submitted for admin approval." });
                        }
                    );
                });
            });
        });
    };

    const applyEdit = (row, proposed, actorId, done) => {
        const fields = [];
        const vals = [];
        applyFields.forEach((f) => {
            if (typeof proposed[f] !== "undefined") { fields.push(`${f} = ?`); vals.push(proposed[f]); }
        });
        fields.push("editCount = COALESCE(editCount, 0) + 1");
        vals.push(row.id);
        db.run(`UPDATE ${table} SET ${fields.join(", ")} WHERE id = ?`, vals, (e) => done(e));
    };

    const listRequests = (req, res) => {
        db.all(
            `SELECT r.*, x.${labelColumn} AS itemLabel, x.amount, COALESCE(NULLIF(r.requestedByName,''), u.name, u.email, '') AS displayRequester
             FROM ${requestTable} r
             JOIN ${table} x ON x.id = r.${entityIdColumn}
             LEFT JOIN users u ON u.id = r.requestedBy
             WHERE r.status = 'pending'
             ORDER BY r.createdAt DESC`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ success: false, message: "Unable to load edit requests." });
                const shaped = (rows || []).map((r) => {
                    let proposed = {};
                    try { proposed = JSON.parse(r.proposed || "{}"); } catch (e) { proposed = {}; }
                    return { ...r, proposed };
                });
                res.json(shaped);
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
            db.get(`SELECT * FROM ${table} WHERE id = ?`, [request[entityIdColumn]], (pErr, row) => {
                if (pErr || !row) return res.status(404).json({ success: false, message: `${Cap(entityLabel)} not found.` });
                if (Number(row.editCount || 0) >= 1) {
                    return db.run(`UPDATE ${requestTable} SET status='rejected', reviewedBy=?, reviewedAt=? WHERE id=?`,
                        [req.user.id, new Date().toISOString(), requestId], () =>
                        res.status(409).json({ success: false, message: `${Cap(entityLabel)} was already edited — request auto-rejected.` }));
                }
                let proposed = {};
                try { proposed = JSON.parse(request.proposed || "{}"); } catch (e) { proposed = {}; }
                applyEdit(row, proposed, req.user.id, (e) => {
                    if (e) return res.status(500).json({ success: false, message: e.message || "Unable to apply edit." });
                    db.run(`UPDATE ${requestTable} SET status='approved', reviewedBy=?, reviewedAt=? WHERE id=?`,
                        [req.user.id, new Date().toISOString(), requestId], (uErr) => {
                            if (uErr) return res.status(500).json({ success: false, message: "Unable to update request." });
                            logAudit({ userId: req.user.id, action: `${entityLabel.toUpperCase()}_EDIT_APPROVED`, entityType: entityLabel, entityId: row.id, details: { reason: request.reason } }).catch(() => {});
                            res.json({ success: true, message: "Edit request approved and applied." });
                        });
                });
            });
        });
    };

    const reject = (req, res) => {
        const requestId = Number(req.params.id);
        if (!requestId) return res.status(400).json({ success: false, message: "Invalid request ID." });
        db.get(`SELECT id, status FROM ${requestTable} WHERE id = ?`, [requestId], (err, request) => {
            if (err) return res.status(500).json({ success: false, message: "Database error." });
            if (!request) return res.status(404).json({ success: false, message: "Request not found." });
            if (request.status !== "pending") return res.status(409).json({ success: false, message: "This request was already reviewed." });
            db.run(`UPDATE ${requestTable} SET status='rejected', reviewedBy=?, reviewedAt=? WHERE id=?`,
                [req.user.id, new Date().toISOString(), requestId], (uErr) => {
                    if (uErr) return res.status(500).json({ success: false, message: "Unable to reject request." });
                    res.json({ success: true, message: "Edit request rejected." });
                });
        });
    };

    return { requestEdit, listRequests, approve, reject };
}

function Cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

const expense = makeEditRequestHandlers({
    table: "expenses", requestTable: "expense_edit_requests", entityIdColumn: "expenseId",
    entityLabel: "expense", labelColumn: "expenseName",
    applyFields: ["expenseName", "category", "amount", "expenseDate", "paymentMode", "paidTo", "description"]
});
const income = makeEditRequestHandlers({
    table: "incomes", requestTable: "income_edit_requests", entityIdColumn: "incomeId",
    entityLabel: "income", labelColumn: "incomeName",
    applyFields: ["incomeName", "category", "amount", "incomeDate", "paymentMode", "receivedFrom", "description"]
});

module.exports = {
    requestExpenseEdit: expense.requestEdit,
    getExpenseEditRequests: expense.listRequests,
    approveExpenseEdit: expense.approve,
    rejectExpenseEdit: expense.reject,
    requestIncomeEdit: income.requestEdit,
    getIncomeEditRequests: income.listRequests,
    approveIncomeEdit: income.approve,
    rejectIncomeEdit: income.reject
};
