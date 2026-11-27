// =====================================================
// NOTICE BOARD
// Staff post announcements with an audience, publish date,
// optional expiry and a pin flag. Visible on the dashboard.
// =====================================================
const db = require("../db");
const logAudit = require("../utils/auditLogger");

const AUDIENCES = ["all", "admin", "principal", "manager", "accountant", "teacher", "supporting_teacher"];
const canSee = (n, role) => n.audience === "all" || n.audience === role;
const allQ = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));
const runQ = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

exports.listNotices = async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await allQ(`
            SELECT n.*,
                   SUM(CASE WHEN nr.readAt IS NOT NULL THEN 1 ELSE 0 END) AS readCount
            FROM notices n
            LEFT JOIN notice_reads nr ON nr.noticeId = n.id
            WHERE n.expiryDate IS NULL OR n.expiryDate = '' OR n.expiryDate >= ?
            GROUP BY n.id
            ORDER BY n.pinned DESC, COALESCE(n.publishDate, n.createdAt) DESC, n.id DESC
        `, [today]);
        res.json(rows.filter((n) => canSee(n, req.user.role)));
    } catch (e) {
        console.error("List notices error:", e);
        res.status(500).json({ success: false, message: "Unable to load notices." });
    }
};

exports.createNotice = async (req, res) => {
    try {
        const title = String(req.body?.title || "").trim();
        const body = String(req.body?.body || "").trim();
        const audience = String(req.body?.audience || "all").trim();
        const publishDate = req.body?.publishDate ? String(req.body.publishDate).slice(0, 10) : null;
        const expiryDate = req.body?.expiryDate ? String(req.body.expiryDate).slice(0, 10) : null;
        const pinned = req.body?.pinned ? 1 : 0;
        if (!title || !body) return res.status(400).json({ success: false, message: "Title and message are required." });
        if (!AUDIENCES.includes(audience)) return res.status(400).json({ success: false, message: "Invalid audience." });

        const now = new Date().toISOString();
        const r = await runQ(
            `INSERT INTO notices (title, body, audience, publishDate, expiryDate, pinned, createdBy, createdByName, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, body, audience, publishDate, expiryDate, pinned, req.user.id, req.user.name || "", now]
        );
        logAudit({ userId: req.user.id, action: "NOTICE_CREATED", entityType: "notice", entityId: r.lastID, details: { title, audience } }).catch(() => {});
        res.status(201).json({ success: true, id: r.lastID, message: "Notice published." });
    } catch (e) {
        console.error("Create notice error:", e);
        res.status(500).json({ success: false, message: "Unable to publish notice." });
    }
};

exports.updateNotice = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const title = String(req.body?.title || "").trim();
        const body = String(req.body?.body || "").trim();
        const audience = String(req.body?.audience || "all").trim();
        const publishDate = req.body?.publishDate ? String(req.body.publishDate).slice(0, 10) : null;
        const expiryDate = req.body?.expiryDate ? String(req.body.expiryDate).slice(0, 10) : null;
        const pinned = req.body?.pinned ? 1 : 0;
        if (!id || !title || !body) return res.status(400).json({ success: false, message: "Title and message are required." });
        if (!AUDIENCES.includes(audience)) return res.status(400).json({ success: false, message: "Invalid audience." });
        await runQ(`UPDATE notices SET title=?, body=?, audience=?, publishDate=?, expiryDate=?, pinned=? WHERE id=?`,
            [title, body, audience, publishDate, expiryDate, pinned, id]);
        logAudit({ userId: req.user.id, action: "NOTICE_UPDATED", entityType: "notice", entityId: id, details: { title } }).catch(() => {});
        res.json({ success: true, message: "Notice updated." });
    } catch (e) {
        console.error("Update notice error:", e);
        res.status(500).json({ success: false, message: "Unable to update notice." });
    }
};

exports.deleteNotice = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: "Invalid notice." });
        await runQ(`DELETE FROM notices WHERE id=?`, [id]);
        await runQ(`DELETE FROM notice_reads WHERE noticeId=?`, [id]);
        logAudit({ userId: req.user.id, action: "NOTICE_DELETED", entityType: "notice", entityId: id }).catch(() => {});
        res.json({ success: true, message: "Notice removed." });
    } catch (e) {
        console.error("Delete notice error:", e);
        res.status(500).json({ success: false, message: "Unable to remove notice." });
    }
};

exports.markRead = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: "Invalid notice." });
        await runQ(`INSERT OR IGNORE INTO notice_reads (noticeId, userId, readAt) VALUES (?, ?, ?)`,
            [id, req.user.id, new Date().toISOString()]);
        res.json({ success: true });
    } catch (e) {
        console.error("Mark read error:", e);
        res.status(500).json({ success: false, message: "Unable to mark as read." });
    }
};
