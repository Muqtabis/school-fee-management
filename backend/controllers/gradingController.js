const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");


// =====================================================
// GRADING SCALES (admin-configurable, not hard-coded)
//
// A scale is a named set of bands; each band maps a
// percentage window to a letter grade. Exams reference a
// scale, and result calculation reads its bands. Admins
// create/edit/delete scales here (spec item 15).
// =====================================================


// Reject bands that overlap, run out of range, or are empty.
function validateBands(bands) {
    if (!Array.isArray(bands) || bands.length === 0) {
        return "At least one grade band is required.";
    }
    for (const b of bands) {
        const min = Number(b.minPercent);
        const max = b.maxPercent === undefined || b.maxPercent === null || b.maxPercent === "" ? 100 : Number(b.maxPercent);
        if (!b.grade || !String(b.grade).trim()) return "Every band needs a grade label.";
        if (!Number.isFinite(min) || min < 0 || min > 100) return "Band minimum % must be between 0 and 100.";
        if (!Number.isFinite(max) || max < min || max > 100) return "Band maximum % must be between its minimum and 100.";
    }
    return null;
}

async function insertBands(scaleId, bands) {
    // Store high→low so lookups find the highest matching band first.
    const sorted = [...bands].sort((a, b) => Number(b.minPercent) - Number(a.minPercent));
    let ordinal = 0;
    for (const b of sorted) {
        const max = b.maxPercent === undefined || b.maxPercent === null || b.maxPercent === "" ? 100 : Number(b.maxPercent);
        await runQuery(
            `INSERT INTO grading_bands (scaleId, grade, minPercent, maxPercent, ordinal)
             VALUES (?, ?, ?, ?, ?)`,
            [scaleId, String(b.grade).trim(), Number(b.minPercent), max, ordinal++]
        );
    }
}


exports.getGradingScales = async (req, res) => {
    try {
        const scales = await allQuery(
            `SELECT id, name, isDefault, createdAt FROM grading_scales ORDER BY isDefault DESC, name ASC`
        );
        for (const s of scales) {
            s.bands = await allQuery(
                `SELECT id, grade, minPercent, maxPercent, ordinal FROM grading_bands
                 WHERE scaleId = ? ORDER BY minPercent DESC`,
                [s.id]
            );
        }
        res.json({ success: true, scales });
    } catch (error) {
        console.error("Get Grading Scales Error:", error);
        res.status(500).json({ success: false, message: "Unable to load grading scales." });
    }
};


exports.createGradingScale = async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const bands = req.body?.bands;
    if (!name) return res.status(400).json({ success: false, message: "A scale name is required." });
    const bandErr = validateBands(bands);
    if (bandErr) return res.status(400).json({ success: false, message: bandErr });

    try {
        const existing = await allQuery(`SELECT COUNT(*) n FROM grading_scales`);
        const isDefault = existing[0].n === 0 ? 1 : 0; // first scale becomes default
        const ins = await runQuery(
            `INSERT INTO grading_scales (name, isDefault, createdBy) VALUES (?, ?, ?)`,
            [name, isDefault, req.user.id]
        );
        await insertBands(ins.lastID, bands);

        await logAudit({
            userId: req.user.id, action: "GRADING_SCALE_CREATED",
            entityType: "grading_scale", entityId: ins.lastID, details: { name, bands: bands.length }
        }).catch((e) => console.error("Audit Error:", e));

        res.status(201).json({ success: true, message: "Grading scale created.", id: ins.lastID });
    } catch (error) {
        console.error("Create Grading Scale Error:", error);
        res.status(500).json({ success: false, message: "Unable to create grading scale." });
    }
};


exports.updateGradingScale = async (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    const bands = req.body?.bands;
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: "Invalid scale ID." });
    if (!name) return res.status(400).json({ success: false, message: "A scale name is required." });
    const bandErr = validateBands(bands);
    if (bandErr) return res.status(400).json({ success: false, message: bandErr });

    try {
        const rows = await allQuery(`SELECT id FROM grading_scales WHERE id = ?`, [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Grading scale not found." });

        await runQuery(`UPDATE grading_scales SET name = ? WHERE id = ?`, [name, id]);
        await runQuery(`DELETE FROM grading_bands WHERE scaleId = ?`, [id]);
        await insertBands(id, bands);

        await logAudit({
            userId: req.user.id, action: "GRADING_SCALE_UPDATED",
            entityType: "grading_scale", entityId: id, details: { name, bands: bands.length }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({ success: true, message: "Grading scale updated." });
    } catch (error) {
        console.error("Update Grading Scale Error:", error);
        res.status(500).json({ success: false, message: "Unable to update grading scale." });
    }
};


exports.deleteGradingScale = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: "Invalid scale ID." });
    try {
        const rows = await allQuery(`SELECT id, isDefault FROM grading_scales WHERE id = ?`, [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Grading scale not found." });
        if (rows[0].isDefault) {
            return res.status(409).json({ success: false, message: "The default grading scale cannot be deleted." });
        }
        const used = await allQuery(`SELECT COUNT(*) n FROM exam_definitions WHERE gradingScaleId = ?`, [id]);
        if (used[0].n > 0) {
            return res.status(409).json({ success: false, message: `This scale is used by ${used[0].n} exam(s) and cannot be deleted.` });
        }
        await runQuery(`DELETE FROM grading_scales WHERE id = ?`, [id]); // bands cascade
        await logAudit({
            userId: req.user.id, action: "GRADING_SCALE_DELETED",
            entityType: "grading_scale", entityId: id, details: {}
        }).catch((e) => console.error("Audit Error:", e));
        res.json({ success: true, message: "Grading scale deleted." });
    } catch (error) {
        console.error("Delete Grading Scale Error:", error);
        res.status(500).json({ success: false, message: "Unable to delete grading scale." });
    }
};
