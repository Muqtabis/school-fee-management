import { useEffect, useState } from "react";

import api from "../../services/api";


// =====================================================
// GRADING SCALES MANAGER (admin)
//
// Admin-configurable grade bands (spec item 15). A scale is
// a named set of bands; each band maps a percentage window
// to a letter grade. Nothing here is hard-coded — result
// calculation reads whatever the admin defines.
// =====================================================

const BLANK_BAND = { grade: "", minPercent: "", maxPercent: "" };


function GradingScalesManager() {

    const [scales, setScales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    // Editor state: either creating (id null) or editing an existing scale.
    const [editing, setEditing] = useState(null); // { id, name, bands: [] } | null

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get("/exams/grading-scales");
            setScales(res.data.scales || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load grading scales.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);


    const startCreate = () => {
        setEditing({
            id: null,
            name: "",
            bands: [
                { grade: "A", minPercent: 80, maxPercent: 100 },
                { grade: "B", minPercent: 60, maxPercent: 79.99 },
                { grade: "C", minPercent: 40, maxPercent: 59.99 },
                { grade: "F", minPercent: 0, maxPercent: 39.99 }
            ]
        });
    };

    const startEdit = (scale) => {
        setEditing({
            id: scale.id,
            name: scale.name,
            bands: (scale.bands || []).map((b) => ({
                grade: b.grade,
                minPercent: b.minPercent,
                maxPercent: b.maxPercent
            }))
        });
    };

    const cancelEdit = () => setEditing(null);

    const setBand = (idx, patch) => {
        setEditing((prev) => ({
            ...prev,
            bands: prev.bands.map((b, i) => (i === idx ? { ...b, ...patch } : b))
        }));
    };

    const addBand = () => {
        setEditing((prev) => ({ ...prev, bands: [...prev.bands, { ...BLANK_BAND }] }));
    };

    const removeBand = (idx) => {
        setEditing((prev) => ({ ...prev, bands: prev.bands.filter((_, i) => i !== idx) }));
    };

    const save = async () => {
        if (!editing) return;
        if (!editing.name.trim()) { alert("A scale name is required."); return; }
        const bands = editing.bands.map((b) => ({
            grade: String(b.grade || "").trim(),
            minPercent: Number(b.minPercent),
            maxPercent: b.maxPercent === "" || b.maxPercent === null ? 100 : Number(b.maxPercent)
        }));
        try {
            setBusy(true);
            if (editing.id) {
                await api.put(`/exams/grading-scales/${editing.id}`, { name: editing.name.trim(), bands });
            } else {
                await api.post("/exams/grading-scales", { name: editing.name.trim(), bands });
            }
            setEditing(null);
            await load();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save grading scale.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (scale) => {
        if (!window.confirm(`Delete grading scale "${scale.name}"?`)) return;
        try {
            setBusy(true);
            await api.delete(`/exams/grading-scales/${scale.id}`);
            await load();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to delete grading scale.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="settings-card" style={{ marginTop: "25px" }}>
            <div className="exam-row-between">
                <h3 style={{ margin: 0 }}>Grading Scales</h3>
                {!editing && (
                    <button type="button" className="primary-btn" onClick={startCreate}>
                        + New Scale
                    </button>
                )}
            </div>
            <p style={{ color: "#666", marginTop: "6px" }}>
                Grades are configurable. Each band maps a percentage range to a letter grade.
                The first scale you create becomes the default.
            </p>

            {editing && (
                <div style={{ marginTop: "16px", border: "1px solid #e2e2e2", borderRadius: "8px", padding: "16px" }}>
                    <input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        placeholder="Scale name (e.g. Standard, Board Pattern)"
                        style={{ minWidth: "260px" }}
                    />

                    <div className="table-container" style={{ marginTop: "14px" }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Grade</th>
                                    <th>Min %</th>
                                    <th>Max %</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editing.bands.map((b, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <input
                                                value={b.grade}
                                                onChange={(e) => setBand(idx, { grade: e.target.value })}
                                                style={{ width: "70px" }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" min="0" max="100" step="0.01"
                                                value={b.minPercent}
                                                onChange={(e) => setBand(idx, { minPercent: e.target.value })}
                                                style={{ width: "90px" }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" min="0" max="100" step="0.01"
                                                value={b.maxPercent}
                                                onChange={(e) => setBand(idx, { maxPercent: e.target.value })}
                                                style={{ width: "90px" }}
                                            />
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => removeBand(idx)}>Remove</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                        <button type="button" onClick={addBand}>+ Add Band</button>
                        <button type="button" className="primary-btn" onClick={save} disabled={busy}>
                            {busy ? "Saving..." : "Save Scale"}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
                    </div>
                </div>
            )}

            {!editing && (
                <div className="table-container" style={{ marginTop: "16px" }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Scale</th>
                                <th>Bands</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="3">Loading...</td></tr>
                            ) : scales.length === 0 ? (
                                <tr><td colSpan="3">No grading scales yet.</td></tr>
                            ) : (
                                scales.map((s) => (
                                    <tr key={s.id}>
                                        <td>
                                            {s.name}
                                            {s.isDefault ? (
                                                <span className="exam-badge exam-badge-default" style={{ marginLeft: "8px" }}>
                                                    Default
                                                </span>
                                            ) : null}
                                        </td>
                                        <td>
                                            {(s.bands || []).map((b) => `${b.grade} (${b.minPercent}–${b.maxPercent})`).join(", ")}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                <button type="button" onClick={() => startEdit(s)}>Edit</button>
                                                {!s.isDefault && (
                                                    <button type="button" onClick={() => remove(s)} disabled={busy}>
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}


export default GradingScalesManager;
