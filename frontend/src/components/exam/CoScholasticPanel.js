import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../services/api";


// =====================================================
// CO-SCHOLASTIC & TERM DETAILS (class-teacher only)
//
// The comprehensive progress card's Part 2: co-scholastic
// grades per fixed area, attendance (working / attended
// days), physical stature (height / weight) and the class
// teacher's remark. Only the class teacher of the exam's
// class (or an admin) may author these — the backend is the
// final authority and returns 403 otherwise, in which case
// this panel quietly hides.
//
// Shown from Marks Entry only for term / final exams, since
// unit-test cards do not carry a progress card.
// =====================================================

function CoScholasticPanel({ examId }) {

    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(true);
    const [editable, setEditable] = useState(false);
    // Promotion is a year-end decision, so its inputs show for final exams only.
    const [isFinal, setIsFinal] = useState(false);
    const [students, setStudents] = useState([]);
    const [areas, setAreas] = useState([]);
    const [savingGrades, setSavingGrades] = useState(false);
    const [savingMeta, setSavingMeta] = useState(false);

    // grades[studentId][area] = "A"; meta[studentId] = { workingDays, ... }
    const [grades, setGrades] = useState({});
    const [meta, setMeta] = useState({});
    // Students that already have a saved meta row — so a "cleared" row is still
    // sent (to persist the clear) while untouched students create no empty rows.
    const [existingMetaIds, setExistingMetaIds] = useState(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/exams/${examId}/co-scholastic`);
            const { students: st, areas: ar, grades: gr, meta: mt, editable: canEdit, exam } = res.data;
            setStudents(st || []);
            setAreas(ar || []);
            setEditable(!!canEdit);
            setIsFinal((exam && exam.examCategory) === "final");

            const g = {};
            (st || []).forEach((s) => { g[s.id] = {}; (ar || []).forEach((a) => { g[s.id][a] = ""; }); });
            (gr || []).forEach((row) => {
                if (!g[row.studentId]) g[row.studentId] = {};
                g[row.studentId][row.area] = row.grade || "";
            });
            setGrades(g);

            const m = {};
            (st || []).forEach((s) => {
                m[s.id] = {
                    workingDays: "", daysAttended: "", heightCm: "", weightKg: "", remark: "",
                    // Preserved (not exposed in this panel yet) so a save can't wipe them.
                    promotionStatus: "", promotedToClass: ""
                };
            });
            const existing = new Set();
            (mt || []).forEach((row) => {
                existing.add(row.studentId);
                m[row.studentId] = {
                    workingDays: row.workingDays ?? "",
                    daysAttended: row.daysAttended ?? "",
                    heightCm: row.heightCm ?? "",
                    weightKg: row.weightKg ?? "",
                    remark: row.remark ?? "",
                    promotionStatus: row.promotionStatus ?? "",
                    promotedToClass: row.promotedToClass ?? ""
                };
            });
            setExistingMetaIds(existing);
            setMeta(m);
            setAuthorized(true);
        } catch (error) {
            if (error.response?.status === 403) setAuthorized(false);
            else alert(error.response?.data?.message || "Unable to load co-scholastic details.");
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => { load(); }, [load]);

    const setGrade = (studentId, area, value) => {
        setGrades((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], [area]: value.toUpperCase().slice(0, 5) }
        }));
    };

    const setMetaCell = (studentId, patch) => {
        setMeta((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
    };

    const saveGrades = async () => {
        const payload = [];
        students.forEach((s) => {
            areas.forEach((a) => {
                payload.push({ studentId: s.id, area: a, grade: grades[s.id]?.[a] || null });
            });
        });
        try {
            setSavingGrades(true);
            const res = await api.put(`/exams/${examId}/co-scholastic`, { grades: payload });
            alert(res.data.message || "Co-scholastic grades saved.");
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save co-scholastic grades.");
        } finally {
            setSavingGrades(false);
        }
    };

    // A day count is invalid when attended exceeds working days. Used to flag
    // the cell, to count warnings, and to hold ONLY the bad rows back on save.
    const isAttInvalid = (mv) => {
        if (!mv || mv.workingDays === "" || mv.daysAttended === "") return false;
        const w = Number(mv.workingDays), a = Number(mv.daysAttended);
        return Number.isFinite(w) && Number.isFinite(a) && a > w;
    };

    const saveMeta = async () => {
        // Only send a row when the teacher actually has content for the student,
        // or the student already has a saved row (so an intentional clear sticks).
        // Untouched students no longer create empty NULL rows.
        const hasContent = (mv) => mv && Object.values(mv).some((v) => v !== "" && v !== null && v !== undefined);
        const eligible = students.filter((s) => hasContent(meta[s.id]) || existingMetaIds.has(s.id));
        // A single bad attendance row must not block everyone: hold back only the
        // invalid rows and save the rest, telling the teacher which were skipped.
        const skipped = eligible.filter((s) => isAttInvalid(meta[s.id]));
        const payload = eligible
            .filter((s) => !isAttInvalid(meta[s.id]))
            .map((s) => ({ studentId: s.id, ...(meta[s.id] || {}) }));

        if (payload.length === 0) {
            alert(skipped.length
                ? "Every filled row has days attended greater than working days. Fix the highlighted cells."
                : "Nothing to save.");
            return;
        }
        try {
            setSavingMeta(true);
            const res = await api.put(`/exams/${examId}/term-meta`, { meta: payload });
            let msg = res.data.message || "Term details saved.";
            if (skipped.length) {
                msg += `\n\nSkipped ${skipped.length} row(s) with days attended greater than working days:\n`
                    + skipped.map((s) => `• ${s.studentName}`).join("\n");
            }
            alert(msg);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save term details.");
        } finally {
            setSavingMeta(false);
        }
    };

    const attendanceWarnings = useMemo(
        () => students.filter((s) => isAttInvalid(meta[s.id])).length,
        [students, meta]
    );

    if (loading) return <p style={{ marginTop: "15px" }}>Loading co-scholastic details...</p>;
    // Not the class teacher of this class — silently hide (subject teachers
    // have no access here).
    if (!authorized) return null;

    return (
        <div style={{ marginTop: "26px", borderTop: "2px solid #e5e7eb", paddingTop: "18px" }}>
            <h3 style={{ margin: 0 }}>Co-Scholastic &amp; Term Details</h3>
            <p style={{ color: "#666", marginTop: "6px" }}>
                Class-teacher section for the progress card: co-scholastic grades, attendance,
                physical stature{isFinal ? ", your remark and the year-end promotion decision" : " and your remark"}.
                {!editable && " These are finalised because the exam is published."}
            </p>

            {students.length === 0 ? (
                <p>No active students in this class.</p>
            ) : (
                <>
                    {/* CO-SCHOLASTIC GRADES */}
                    <h4 style={{ marginBottom: "6px" }}>Co-Scholastic Grades</h4>
                    <div className="table-container">
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Roll</th>
                                    <th>Student</th>
                                    {areas.map((a) => <th key={a}>{a}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.rollNumber || "-"}</td>
                                        <td>{s.studentName}</td>
                                        {areas.map((a) => (
                                            <td key={a} data-label={a}>
                                                <input
                                                    value={grades[s.id]?.[a] || ""}
                                                    disabled={!editable}
                                                    placeholder="—"
                                                    onChange={(e) => setGrade(s.id, a, e.target.value)}
                                                    style={{ width: "60px", textAlign: "center" }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: "12px", color: "#777", marginTop: "6px" }}>
                        Enter a letter grade (e.g. A+, A, B) per area. Leave blank to clear.
                    </p>
                    {editable && (
                        <button type="button" className="primary-btn" onClick={saveGrades} disabled={savingGrades}>
                            {savingGrades ? "Saving..." : "Save Co-Scholastic"}
                        </button>
                    )}

                    {/* TERM DETAILS: attendance / stature / remark */}
                    <h4 style={{ margin: "24px 0 6px" }}>Attendance, Stature &amp; Remark</h4>
                    <div className="table-container">
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Roll</th>
                                    <th>Student</th>
                                    <th>Working days</th>
                                    <th>Days attended</th>
                                    <th>Height (cm)</th>
                                    <th>Weight (kg)</th>
                                    <th>Remark</th>
                                    {isFinal && <th>Promotion</th>}
                                    {isFinal && <th>Promoted to</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => {
                                    const m = meta[s.id] || {};
                                    const attInvalid = isAttInvalid(m);
                                    return (
                                        <tr key={s.id}>
                                            <td>{s.rollNumber || "-"}</td>
                                            <td>{s.studentName}</td>
                                            <td data-label="Working days">
                                                <input type="number" min="0" value={m.workingDays} disabled={!editable}
                                                    onChange={(e) => setMetaCell(s.id, { workingDays: e.target.value })}
                                                    style={{ width: "70px" }} />
                                            </td>
                                            <td data-label="Days attended">
                                                <input type="number" min="0" value={m.daysAttended} disabled={!editable}
                                                    className={attInvalid ? "exam-cell-invalid" : ""}
                                                    onChange={(e) => setMetaCell(s.id, { daysAttended: e.target.value })}
                                                    style={{ width: "70px" }} />
                                            </td>
                                            <td data-label="Height (cm)">
                                                <input type="number" min="0" step="0.1" value={m.heightCm} disabled={!editable}
                                                    onChange={(e) => setMetaCell(s.id, { heightCm: e.target.value })}
                                                    style={{ width: "70px" }} />
                                            </td>
                                            <td data-label="Weight (kg)">
                                                <input type="number" min="0" step="0.1" value={m.weightKg} disabled={!editable}
                                                    onChange={(e) => setMetaCell(s.id, { weightKg: e.target.value })}
                                                    style={{ width: "70px" }} />
                                            </td>
                                            <td data-label="Remark">
                                                <input value={m.remark} disabled={!editable} maxLength={500}
                                                    onChange={(e) => setMetaCell(s.id, { remark: e.target.value })}
                                                    style={{ width: "180px" }} />
                                            </td>
                                            {isFinal && (
                                                <td data-label="Promotion">
                                                    <select value={m.promotionStatus || ""} disabled={!editable}
                                                        onChange={(e) => setMetaCell(s.id, { promotionStatus: e.target.value })}
                                                        style={{ width: "140px" }}>
                                                        <option value="">—</option>
                                                        <option value="Promoted">Promoted</option>
                                                        <option value="Promoted on Trial">Promoted on Trial</option>
                                                        <option value="Detained">Detained</option>
                                                    </select>
                                                </td>
                                            )}
                                            {isFinal && (
                                                <td data-label="Promoted to">
                                                    <input value={m.promotedToClass} disabled={!editable} maxLength={60}
                                                        placeholder="next class"
                                                        onChange={(e) => setMetaCell(s.id, { promotedToClass: e.target.value })}
                                                        style={{ width: "110px" }} />
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {attendanceWarnings > 0 && (
                        <p style={{ color: "#b91c1c", fontSize: "13px", marginTop: "6px" }}>
                            {attendanceWarnings} student(s) have days attended greater than working days.
                            These row(s) are skipped on save — the rest still save.
                        </p>
                    )}
                    {editable && (
                        <button type="button" className="primary-btn" onClick={saveMeta}
                            disabled={savingMeta} style={{ marginTop: "10px" }}>
                            {savingMeta ? "Saving..." : "Save Term Details"}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

export default CoScholasticPanel;
