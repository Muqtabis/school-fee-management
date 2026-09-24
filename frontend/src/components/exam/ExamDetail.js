import { useCallback, useEffect, useState } from "react";

import api from "../../services/api";
import { examTypeLabel, STATUS_LABEL, STATUS_HINT, MARK_STATUS_OPTIONS } from "./examConstants";


// =====================================================
// EXAM DETAIL (tabbed)
//
// One exam DEFINITION spans several classes; its config,
// marks and results live per class (child exam). So the
// detail view has a class picker, then tabs that operate on
// the chosen class's child exam:
//   Overview | Subjects | Schedule | Marks | Results | Delivery
// (spec item 25). Admin-only page.
// =====================================================

const TABS = ["Overview", "Subjects", "Schedule", "Marks", "Results", "Delivery"];


// Download a report-card PDF through the authenticated API (the
// route is admin-gated, so a plain link would omit the token).
async function downloadReportCard(examId, student) {
    try {
        const res = await api.get(`/exams/${examId}/report-card/${student.studentId}`, {
            responseType: "blob"
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = `report_${student.rollNumber || student.studentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert("Unable to download the report card.");
    }
}


function ExamDetail({ definition, onBack, onChanged }) {

    const [classes, setClasses] = useState([]);
    const [selected, setSelected] = useState(null); // child exam row
    const [tab, setTab] = useState("Overview");
    const [loading, setLoading] = useState(true);

    // Subjects/schedule config for the selected class.
    const [config, setConfig] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [configMeta, setConfigMeta] = useState({ editable: false, marksEntered: false });
    const [configLoading, setConfigLoading] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    // Results + analytics for the selected class.
    const [results, setResults] = useState(null);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    // Delivery: notification log + corrections.
    const [notifications, setNotifications] = useState([]);
    const [corrections, setCorrections] = useState([]);
    const [deliverLoading, setDeliverLoading] = useState(false);

    // Inline correction form (published results only).
    const [correcting, setCorrecting] = useState(null);


    // ---- Load the definition's child classes + completion counts ----
    const loadClasses = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/exams/definitions/${definition.id}`);
            const kids = res.data.classes || [];
            setClasses(kids);
            setSelected((prev) => {
                if (!prev) return kids[0] || null;
                return kids.find((k) => k.id === prev.id) || kids[0] || null;
            });
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load exam detail.");
        } finally {
            setLoading(false);
        }
    }, [definition.id]);

    useEffect(() => { loadClasses(); }, [loadClasses]);


    // ---- Per-tab data loading for the selected class ----
    const loadConfig = useCallback(async (examId) => {
        setConfigLoading(true);
        try {
            const res = await api.get(`/exams/${examId}/subjects`);
            setConfig((res.data.subjects || []).map((s) => ({
                subjectId: s.subjectId,
                subjectName: s.subjectName,
                maxMarks: s.maxMarks ?? "",
                passMarks: s.passMarks ?? "",
                teacherId: s.teacherId ?? "",
                examDate: s.examDate ?? "",
                startTime: s.startTime ?? "",
                endTime: s.endTime ?? "",
                room: s.room ?? "",
                instructions: s.instructions ?? ""
            })));
            setTeachers(res.data.teachers || []);
            setConfigMeta({ editable: !!res.data.editable, marksEntered: !!res.data.marksEntered });
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load subjects.");
        } finally {
            setConfigLoading(false);
        }
    }, []);

    const loadResults = useCallback(async (examId) => {
        setResultsLoading(true);
        try {
            const res = await api.get(`/exams/${examId}/results`);
            setResults(res.data);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load results.");
            setResults(null);
        } finally {
            setResultsLoading(false);
        }
    }, []);

    const loadDelivery = useCallback(async (examId) => {
        setDeliverLoading(true);
        try {
            const [n, c] = await Promise.all([
                api.get(`/exams/${examId}/notifications`),
                api.get(`/exams/${examId}/corrections`)
            ]);
            setNotifications(n.data.notifications || []);
            setCorrections(c.data.corrections || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load delivery log.");
        } finally {
            setDeliverLoading(false);
        }
    }, []);

    // Fetch the data a tab needs when the tab or the selected class changes.
    useEffect(() => {
        if (!selected) return;
        if (tab === "Subjects" || tab === "Schedule") loadConfig(selected.id);
        else if (tab === "Marks" || tab === "Results") loadResults(selected.id);
        else if (tab === "Delivery") loadDelivery(selected.id);
    }, [tab, selected, loadConfig, loadResults, loadDelivery]);


    const setConfigCell = (subjectId, patch) => {
        setConfig((prev) => prev.map((s) => (s.subjectId === subjectId ? { ...s, ...patch } : s)));
    };

    // Save subjects + schedule together (one PUT covers both tabs).
    const saveConfig = async (confirm = false) => {
        if (!selected) return;
        const subjects = config.map((s) => ({
            subjectId: s.subjectId,
            maxMarks: Number(s.maxMarks),
            passMarks: s.passMarks === "" ? null : Number(s.passMarks),
            teacherId: s.teacherId === "" ? null : Number(s.teacherId),
            examDate: s.examDate || null,
            startTime: s.startTime || null,
            endTime: s.endTime || null,
            room: s.room || null,
            instructions: s.instructions || null
        }));
        try {
            setSavingConfig(true);
            const res = await api.put(`/exams/${selected.id}/subjects`, { subjects, confirm });
            alert(res.data.message || "Saved.");
            await loadConfig(selected.id);
        } catch (error) {
            const data = error.response?.data;
            if (data?.requiresConfirmation) {
                if (window.confirm(`${data.message}`)) return saveConfig(true);
            } else {
                alert(data?.message || "Unable to save subject settings.");
            }
        } finally {
            setSavingConfig(false);
        }
    };

    const publish = async (confirm = false) => {
        if (!selected) return;
        try {
            setBusy(true);
            const res = await api.post(`/exams/${selected.id}/publish`, { confirm });
            alert(res.data.message || "Published.");
            await Promise.all([loadClasses(), loadResults(selected.id)]);
            onChanged && onChanged();
        } catch (error) {
            const data = error.response?.data;
            if (data?.requiresConfirmation) {
                if (window.confirm(data.message)) return publish(true);
            } else {
                alert(data?.message || "Unable to publish.");
            }
        } finally {
            setBusy(false);
        }
    };

    const unlock = async () => {
        if (!selected) return;
        if (!window.confirm("Return this class's marks to the teacher for editing?")) return;
        try {
            setBusy(true);
            await api.post(`/exams/${selected.id}/unlock`);
            await Promise.all([loadClasses(), loadResults(selected.id)]);
            onChanged && onChanged();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to unlock.");
        } finally {
            setBusy(false);
        }
    };

    const deliver = async (mode) => {
        if (!selected) return;
        const label = mode === "failed" ? "retry failed deliveries" : "deliver to pending students";
        if (!window.confirm(`Send report cards over WhatsApp (${label})? Delivered students are never re-sent.`)) return;
        try {
            setBusy(true);
            const res = await api.post(`/exams/${selected.id}/deliver`, { mode });
            alert(res.data.message || "Delivery done.");
            await loadDelivery(selected.id);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to deliver.");
        } finally {
            setBusy(false);
        }
    };

    const resend = async (studentId) => {
        if (!selected) return;
        if (!window.confirm("Re-send this student's report card?")) return;
        try {
            setBusy(true);
            const res = await api.post(`/exams/${selected.id}/deliver/${studentId}`);
            alert(res.data.message || "Re-sent.");
            await loadDelivery(selected.id);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to resend.");
        } finally {
            setBusy(false);
        }
    };

    const submitCorrection = async () => {
        if (!selected || !correcting) return;
        const { studentId, subjectId, newStatus, newMarks, reason } = correcting;
        if (!reason.trim()) { alert("A reason for the correction is required."); return; }
        try {
            setBusy(true);
            const res = await api.post(`/exams/${selected.id}/corrections`, {
                studentId, subjectId, newStatus,
                newMarks: newStatus === "present" ? Number(newMarks) : null,
                reason: reason.trim()
            });
            alert((res.data.message || "Correction saved.") + (res.data.needsRedelivery ? " Re-send the report card to update the recipient." : ""));
            setCorrecting(null);
            await Promise.all([loadResults(selected.id), loadDelivery(selected.id)]);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save correction.");
        } finally {
            setBusy(false);
        }
    };


    if (loading) {
        return (
            <div className="settings-card" style={{ marginTop: "20px" }}>
                <button type="button" onClick={onBack}>← Back to exams</button>
                <p style={{ marginTop: "15px" }}>Loading exam...</p>
            </div>
        );
    }

    const st = selected?.status;

    return (
        <div style={{ marginTop: "20px" }}>
            {/* HEADER */}
            <div className="settings-card">
                <div className="exam-row-between">
                    <div>
                        <button type="button" onClick={onBack} style={{ marginBottom: "10px" }}>
                            ← Back to exams
                        </button>
                        <h3 style={{ margin: 0 }}>{definition.name}</h3>
                        <p style={{ color: "#666", margin: "6px 0 0" }}>
                            {examTypeLabel(definition.examType)}
                            {definition.academicYear ? ` · ${definition.academicYear}` : ""}
                            {" · "}{classes.length} class{classes.length === 1 ? "" : "es"}
                        </p>
                    </div>
                </div>

                {/* CLASS PICKER */}
                <div className="exam-class-picker">
                    {classes.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={"exam-chip" + (selected?.id === c.id ? " exam-chip-active" : "")}
                            onClick={() => setSelected(c)}
                        >
                            {c.className}
                            <span className={"exam-badge exam-badge-" + c.status}>
                                {STATUS_LABEL[c.status] || c.status}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB BAR */}
            <div className="exam-tabbar">
                {TABS.map((t) => (
                    <button
                        key={t}
                        type="button"
                        className={"exam-tab" + (tab === t ? " exam-tab-active" : "")}
                        onClick={() => setTab(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {!selected ? (
                <div className="settings-card"><p>This exam has no classes you can view.</p></div>
            ) : (
                <div className="settings-card exam-tabpanel">
                    {tab === "Overview" && (
                        <>
                            <h4 style={{ marginTop: 0 }}>Classes in this exam</h4>
                            <p style={{ color: "#666" }}>{STATUS_HINT[st] || ""}</p>
                            <div className="exam-cards">
                                {classes.map((c) => {
                                    const pct = c.expectedCells > 0
                                        ? Math.round((c.enteredCells / c.expectedCells) * 100)
                                        : 0;
                                    return (
                                        <div key={c.id} className="exam-overview-card">
                                            <div className="exam-row-between">
                                                <strong>{c.className}</strong>
                                                <span className={"exam-badge exam-badge-" + c.status}>
                                                    {STATUS_LABEL[c.status] || c.status}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: "13px", color: "#555", marginTop: "8px" }}>
                                                {c.studentCount} students · {c.subjectCount} subjects
                                            </div>
                                            <div className="exam-progress" title={`${c.enteredCells}/${c.expectedCells} cells`}>
                                                <div className="exam-progress-fill" style={{ width: `${pct}%` }} />
                                            </div>
                                            <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>
                                                Marks entered: {pct}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {tab === "Subjects" && (
                        <>
                            <div className="exam-row-between">
                                <h4 style={{ margin: 0 }}>Subjects — {selected.className}</h4>
                            </div>
                            <p style={{ color: "#666" }}>
                                Max &amp; pass marks and the subject teacher are specific to this exam and class.
                                They do not change Class Management defaults or other exams.
                                {!configMeta.editable && " Editing is closed because the exam is no longer open."}
                            </p>
                            {configLoading ? (
                                <p>Loading...</p>
                            ) : (
                                <>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Subject</th>
                                                    <th>Max</th>
                                                    <th>Pass</th>
                                                    <th>Teacher</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config.length === 0 ? (
                                                    <tr><td colSpan="4">No subjects for this class.</td></tr>
                                                ) : config.map((s) => (
                                                    <tr key={s.subjectId}>
                                                        <td>{s.subjectName}</td>
                                                        <td>
                                                            <input
                                                                type="number" min="1" value={s.maxMarks}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { maxMarks: e.target.value })}
                                                                style={{ width: "80px" }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number" min="0" value={s.passMarks}
                                                                placeholder="auto"
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { passMarks: e.target.value })}
                                                                style={{ width: "80px" }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={s.teacherId}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { teacherId: e.target.value })}
                                                            >
                                                                <option value="">— Unassigned —</option>
                                                                {teachers.map((t) => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p style={{ fontSize: "12px", color: "#777", marginTop: "8px" }}>
                                        Leave pass marks blank to use the default (33% of max).
                                    </p>
                                    {configMeta.editable && config.length > 0 && (
                                        <button type="button" className="primary-btn" onClick={() => saveConfig(false)} disabled={savingConfig}>
                                            {savingConfig ? "Saving..." : "Save Subjects"}
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {tab === "Schedule" && (
                        <>
                            <h4 style={{ marginTop: 0 }}>Schedule — {selected.className}</h4>
                            <p style={{ color: "#666" }}>
                                Optional per-subject date, time, room and instructions.
                                {!configMeta.editable && " Editing is closed because the exam is no longer open."}
                            </p>
                            {configLoading ? (
                                <p>Loading...</p>
                            ) : (
                                <>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Subject</th>
                                                    <th>Date</th>
                                                    <th>Start</th>
                                                    <th>End</th>
                                                    <th>Room</th>
                                                    <th>Instructions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config.length === 0 ? (
                                                    <tr><td colSpan="6">No subjects for this class.</td></tr>
                                                ) : config.map((s) => (
                                                    <tr key={s.subjectId}>
                                                        <td>{s.subjectName}</td>
                                                        <td>
                                                            <input type="date" value={s.examDate || ""}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { examDate: e.target.value })} />
                                                        </td>
                                                        <td>
                                                            <input type="time" value={s.startTime || ""}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { startTime: e.target.value })} />
                                                        </td>
                                                        <td>
                                                            <input type="time" value={s.endTime || ""}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { endTime: e.target.value })} />
                                                        </td>
                                                        <td>
                                                            <input value={s.room || ""} style={{ width: "80px" }}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { room: e.target.value })} />
                                                        </td>
                                                        <td>
                                                            <input value={s.instructions || ""} style={{ width: "160px" }}
                                                                disabled={!configMeta.editable}
                                                                onChange={(e) => setConfigCell(s.subjectId, { instructions: e.target.value })} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {configMeta.editable && config.length > 0 && (
                                        <button type="button" className="primary-btn" onClick={() => saveConfig(false)} disabled={savingConfig}>
                                            {savingConfig ? "Saving..." : "Save Schedule"}
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {tab === "Marks" && (
                        <>
                            <h4 style={{ marginTop: 0 }}>Marks — {selected.className}</h4>
                            <p style={{ color: "#666" }}>
                                Read-only overview. Teachers enter and submit marks from the Marks Entry page.
                            </p>
                            {resultsLoading ? (
                                <p>Loading...</p>
                            ) : !results ? (
                                <p>No data.</p>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Roll</th>
                                                <th>Student</th>
                                                {results.subjects.map((s) => (
                                                    <th key={s.subjectId}>
                                                        {s.subjectName}
                                                        <span style={{ color: "#999", fontWeight: "normal" }}> /{s.maxMarks}</span>
                                                    </th>
                                                ))}
                                                <th>Missing</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.results.length === 0 ? (
                                                <tr><td colSpan={results.subjects.length + 3}>No active students.</td></tr>
                                            ) : results.results.map((r) => {
                                                const bySub = new Map(r.subjectResults.map((x) => [x.subjectId, x]));
                                                return (
                                                    <tr key={r.studentId}>
                                                        <td>{r.rollNumber || "-"}</td>
                                                        <td>{r.studentName}</td>
                                                        {results.subjects.map((s) => {
                                                            const cell = bySub.get(s.subjectId);
                                                            let text = "—";
                                                            if (cell) {
                                                                if (cell.markStatus === "present") text = cell.marksObtained;
                                                                else if (cell.markStatus === "absent") text = "AB";
                                                                else text = cell.markStatus.replace("_", " ");
                                                            }
                                                            return <td key={s.subjectId}>{text}</td>;
                                                        })}
                                                        <td>{r.missing > 0 ? <span style={{ color: "#b45309" }}>{r.missing}</span> : "0"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                    {tab === "Results" && (
                        <>
                            <div className="exam-row-between">
                                <h4 style={{ margin: 0 }}>Results — {selected.className}</h4>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {st === "locked" && (
                                        <>
                                            <button type="button" className="primary-btn" onClick={() => publish(false)} disabled={busy}>
                                                {busy ? "Working..." : "Publish Results"}
                                            </button>
                                            <button type="button" onClick={unlock} disabled={busy}>Return to teacher</button>
                                        </>
                                    )}
                                    {st === "open" && (
                                        <span style={{ color: "#888" }}>Preview — publish after the teacher submits.</span>
                                    )}
                                    {st === "published" && (
                                        <span className="exam-badge exam-badge-published">Published</span>
                                    )}
                                </div>
                            </div>

                            {resultsLoading ? (
                                <p>Loading...</p>
                            ) : !results ? (
                                <p>No data.</p>
                            ) : (
                                <>
                                    <div className="exam-stats">
                                        <div><span>{results.analytics.totalStudents}</span>Students</div>
                                        <div><span>{results.analytics.pass}</span>Pass</div>
                                        <div><span>{results.analytics.fail}</span>Fail</div>
                                        <div><span>{results.analytics.absent}</span>Absent</div>
                                        <div><span>{results.analytics.averagePercent}%</span>Average</div>
                                        <div><span>{results.analytics.highestPercent}%</span>Highest</div>
                                    </div>

                                    <div className="table-container" style={{ marginTop: "16px" }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Roll</th>
                                                    <th>Student</th>
                                                    <th>Total</th>
                                                    <th>%</th>
                                                    <th>Grade</th>
                                                    <th>Result</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.results.length === 0 ? (
                                                    <tr><td colSpan="7">No active students.</td></tr>
                                                ) : results.results.map((r) => (
                                                    <tr key={r.studentId}>
                                                        <td>{r.rollNumber || "-"}</td>
                                                        <td>{r.studentName}{r.missing > 0 && <span style={{ color: "#b45309" }}> ({r.missing} missing)</span>}</td>
                                                        <td>{r.totalObtained}/{r.totalMax}</td>
                                                        <td>{r.percentage}%</td>
                                                        <td>{r.grade || "—"}</td>
                                                        <td>
                                                            <span className={"exam-result-" + r.overallStatus}>
                                                                {r.overallStatus.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {results.published && (
                                                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                                    <button type="button" onClick={() => downloadReportCard(selected.id, r)}>PDF</button>
                                                                    <button type="button" onClick={() => setCorrecting({
                                                                        studentId: r.studentId, studentName: r.studentName,
                                                                        subjectId: r.subjectResults[0]?.subjectId || "",
                                                                        newStatus: "present", newMarks: "", reason: ""
                                                                    })}>Correct</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {correcting && (
                                        <div className="exam-correction">
                                            <div className="exam-row-between">
                                                <strong>Correct a mark — {correcting.studentName}</strong>
                                                <button type="button" onClick={() => setCorrecting(null)}>Close</button>
                                            </div>
                                            <p style={{ color: "#666", fontSize: "13px" }}>
                                                Published results are protected. A correction is logged with a reason,
                                                the result is recalculated, and the report card must be re-sent.
                                            </p>
                                            <div className="exam-correction-grid">
                                                <label>Subject
                                                    <select
                                                        value={correcting.subjectId}
                                                        onChange={(e) => setCorrecting({ ...correcting, subjectId: Number(e.target.value) })}
                                                    >
                                                        {results.subjects.map((s) => (
                                                            <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>Status
                                                    <select
                                                        value={correcting.newStatus}
                                                        onChange={(e) => setCorrecting({ ...correcting, newStatus: e.target.value })}
                                                    >
                                                        {MARK_STATUS_OPTIONS.map((o) => (
                                                            <option key={o.value} value={o.value}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                {correcting.newStatus === "present" && (
                                                    <label>New marks
                                                        <input type="number" min="0" value={correcting.newMarks}
                                                            onChange={(e) => setCorrecting({ ...correcting, newMarks: e.target.value })} />
                                                    </label>
                                                )}
                                                <label style={{ gridColumn: "1 / -1" }}>Reason
                                                    <input value={correcting.reason} placeholder="e.g. re-evaluation of answer sheet"
                                                        onChange={(e) => setCorrecting({ ...correcting, reason: e.target.value })} />
                                                </label>
                                            </div>
                                            <button type="button" className="primary-btn" onClick={submitCorrection} disabled={busy}>
                                                {busy ? "Saving..." : "Save Correction"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {tab === "Delivery" && (
                        <>
                            <div className="exam-row-between">
                                <h4 style={{ margin: 0 }}>Delivery — {selected.className}</h4>
                                {st === "published" && (
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button type="button" className="primary-btn" onClick={() => deliver("pending")} disabled={busy}>
                                            Send to Pending
                                        </button>
                                        <button type="button" onClick={() => deliver("failed")} disabled={busy}>
                                            Retry Failed
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p style={{ color: "#666" }}>
                                Delivery is separate from publishing. A failed WhatsApp send never changes the
                                academic result, and delivered students are never re-sent automatically.
                            </p>

                            {st !== "published" ? (
                                <p style={{ color: "#b45309" }}>Publish the results before delivering report cards.</p>
                            ) : deliverLoading ? (
                                <p>Loading...</p>
                            ) : (
                                <>
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Phone</th>
                                                    <th>Status</th>
                                                    <th>Attempts</th>
                                                    <th>Last update</th>
                                                    <th>Detail</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {notifications.length === 0 ? (
                                                    <tr><td colSpan="7">Nothing delivered yet.</td></tr>
                                                ) : notifications.map((n) => (
                                                    <tr key={n.id}>
                                                        <td>{n.studentName || `#${n.studentId}`}</td>
                                                        <td>{n.phoneNumber || "-"}</td>
                                                        <td>
                                                            <span className={n.status === "sent" || n.status === "delivered" ? "exam-result-pass" : "exam-result-fail"}>
                                                                {n.status}
                                                            </span>
                                                        </td>
                                                        <td>{n.attemptCount || 0}</td>
                                                        <td>{n.updatedAt ? new Date(n.updatedAt).toLocaleString() : "-"}</td>
                                                        <td style={{ maxWidth: "220px" }}>{n.error || n.providerMessageId || "-"}</td>
                                                        <td>
                                                            <button type="button" onClick={() => resend(n.studentId)} disabled={busy}>
                                                                Resend
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {corrections.length > 0 && (
                                        <>
                                            <h4 style={{ marginTop: "22px" }}>Correction history</h4>
                                            <div className="table-container">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>When</th>
                                                            <th>Student</th>
                                                            <th>Subject</th>
                                                            <th>From</th>
                                                            <th>To</th>
                                                            <th>Reason</th>
                                                            <th>By</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {corrections.map((c) => (
                                                            <tr key={c.id}>
                                                                <td>{c.createdAt ? new Date(c.createdAt).toLocaleString() : "-"}</td>
                                                                <td>{c.studentName || `#${c.studentId}`}</td>
                                                                <td>{c.subjectName || `#${c.subjectId}`}</td>
                                                                <td>{c.oldStatus === "present" ? c.oldMarks : (c.oldStatus || "-")}</td>
                                                                <td>{c.newStatus === "present" ? c.newMarks : c.newStatus}</td>
                                                                <td style={{ maxWidth: "220px" }}>{c.reason}</td>
                                                                <td>{c.changedByName || `#${c.changedBy}`}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    <span data-status={st} style={{ display: "none" }} />
                </div>
            )}
        </div>
    );
}


export default ExamDetail;
