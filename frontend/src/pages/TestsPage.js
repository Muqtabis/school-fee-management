/* Tests — simple class-wise test records + Exam-style tabbed detail view. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast, confirmDialog } from "../services/notify";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import OverlayDialog from "../components/OverlayDialog";
import { SkeletonTable } from "../components/Skeleton";

const TABS = ["Overview", "Subjects", "Schedule", "Marks", "Results", "Delivery"];
const emptyForm = { title: "", className: "", testDate: new Date().toISOString().slice(0, 10), maxMarks: "", minMarks: "" };
const fmtDate = (v) => v ? new Date(v).toLocaleDateString("en-IN") : "-";
const marks = (v) => Number(v || 0).toLocaleString("en-IN");

export default function TestsPage() {
    const { user } = useAuth();
    const canEdit = user?.role === "admin" || user?.role === "principal";

    const [tests, setTests] = useState([]);
    const [classes, setClasses] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState(null); // null | "new" | test object
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    // Detail view (mirrors the exam detail tab bar).
    const [openTest, setOpenTest] = useState(null);
    const [tab, setTab] = useState("Overview");
    const [detail, setDetail] = useState(null);
    const [marksData, setMarksData] = useState(null);
    const [resultsData, setResultsData] = useState(null);
    const [scheduleData, setScheduleData] = useState(null);
    const [deliveryData, setDeliveryData] = useState(null);
    const [grid, setGrid] = useState({});
    const [savingMarks, setSavingMarks] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, c] = await Promise.all([
                api.get("/tests"),
                api.get("/tests/classes").catch(() => ({ data: [] }))
            ]);
            setTests(Array.isArray(t.data) ? t.data : []);
            setClasses(Array.isArray(c.data) ? c.data : []);
        } catch (e) {
            toast(e.response?.data?.message || "Unable to load tests.");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const list = useMemo(
        () => tests.filter((t) => filter === "all" || t.className === filter),
        [tests, filter]
    );

    // Load whatever the active detail tab needs.
    useEffect(() => {
        if (!openTest) return;
        let alive = true;
        const run = async () => {
            try {
                if (tab === "Overview" || tab === "Subjects") {
                    const r = await api.get(`/tests/${openTest.id}`);
                    if (alive) setDetail(r.data);
                } else if (tab === "Marks") {
                    const r = await api.get(`/tests/${openTest.id}/marks`);
                    if (!alive) return;
                    setMarksData(r.data);
                    const next = {};
                    (r.data.marks || []).forEach((m) => {
                        next[`${m.studentId}-${m.subjectId}`] = { marksObtained: m.marksObtained, isAbsent: !!m.isAbsent };
                    });
                    setGrid(next);
                } else if (tab === "Results") {
                    const r = await api.get(`/tests/${openTest.id}/results`);
                    if (alive) setResultsData(r.data);
                } else if (tab === "Schedule") {
                    const r = await api.get(`/tests/${openTest.id}/schedule`);
                    if (alive) setScheduleData(r.data);
                } else if (tab === "Delivery") {
                    const r = await api.get(`/tests/${openTest.id}/delivery`);
                    if (alive) setDeliveryData(r.data);
                }
            } catch (e) {
                toast(e.response?.data?.message || "Unable to load test details.");
            }
        };
        run();
        return () => { alive = false; };
    }, [openTest, tab]);

    const openTestView = (t) => { setOpenTest(t); setTab("Overview"); setDetail(null); };
    const closeTestView = () => { setOpenTest(null); setDetail(null); setMarksData(null); setResultsData(null); setScheduleData(null); };

    const openNew = () => { setForm({ ...emptyForm }); setDialog("new"); };
    const openEdit = (t) => {
        setForm({ title: t.title || "", className: t.className, testDate: t.testDate, maxMarks: t.maxMarks, minMarks: t.minMarks });
        setDialog(t);
    };

    const save = async (e) => {
        e.preventDefault();
        const maxMarks = Number(form.maxMarks);
        const minMarks = Number(form.minMarks || 0);
        if (!form.className || !form.testDate) return toast("Class and date are required.");
        if (!Number.isFinite(maxMarks) || maxMarks <= 0) return toast("Enter a valid max marks.");
        if (!Number.isFinite(minMarks) || minMarks < 0) return toast("Enter a valid min marks.");
        if (minMarks > maxMarks) return toast("Min marks cannot exceed max marks.");
        try {
            setSaving(true);
            const payload = { ...form, maxMarks, minMarks };
            if (dialog === "new") await api.post("/tests", payload);
            else await api.put(`/tests/${dialog.id}`, payload);
            toast(dialog === "new" ? "Test added." : "Test updated.");
            setDialog(null);
            await load();
        } catch (err) {
            toast(err.response?.data?.message || "Unable to save test.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (t) => {
        if (!(await confirmDialog({ message: `Remove the test for ${t.className} dated ${fmtDate(t.testDate)}?`, confirmLabel: "Remove", danger: true }))) return;
        try {
            await api.delete(`/tests/${t.id}`);
            toast("Test removed.");
            if (openTest?.id === t.id) closeTestView();
            await load();
        } catch (e) {
            toast(e.response?.data?.message || "Unable to remove test.");
        }
    };

    const saveMarks = async () => {
        try {
            setSavingMarks(true);
            const payload = Object.entries(grid).map(([key, v]) => {
                const [studentId, subjectId] = key.split("-").map(Number);
                return { studentId, subjectId, marksObtained: v.marksObtained, isAbsent: v.isAbsent };
            });
            const r = await api.put(`/tests/${openTest.id}/marks`, { marks: payload });
            toast(r.data?.message || "Marks saved.");
            setTab("Results");
        } catch (e) {
            toast(e.response?.data?.message || "Unable to save marks.");
        } finally {
            setSavingMarks(false);
        }
    };

    // ---- Detail view with Exam-style tabs ----
    if (openTest) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content"><Navbar />
                    <div className="page-content">
                        <div className="page-header">
                            <div>
                                <h2>{openTest.title || `Test · ${openTest.className}`}</h2>
                                <p>{openTest.className} · {fmtDate(openTest.testDate)} · Max {marks(openTest.maxMarks)} · Min {marks(openTest.minMarks)}</p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" className="cancel-btn" onClick={closeTestView}>← Back to Tests</button>
                                {canEdit && <button type="button" className="edit-btn" onClick={() => openEdit(openTest)}>Edit Test</button>}
                            </div>
                        </div>

                        <div className="exam-tabbar">
                            {TABS.map((t) => (
                                <button key={t} type="button" className={"exam-tab" + (tab === t ? " exam-tab-active" : "")} onClick={() => setTab(t)}>{t}</button>
                            ))}
                        </div>

                        <div className="settings-card exam-tabpanel">
                            {tab === "Overview" && (
                                <div className="cards" style={{ margin: 0 }}>
                                    <div className="dashboard-card"><h3>Class</h3><h1 style={{ fontSize: 20 }}>{openTest.className}</h1></div>
                                    <div className="dashboard-card"><h3>Date</h3><h1 style={{ fontSize: 20 }}>{fmtDate(openTest.testDate)}</h1></div>
                                    <div className="dashboard-card"><h3>Max Marks</h3><h1>{marks(openTest.maxMarks)}</h1></div>
                                    <div className="dashboard-card"><h3>Min Marks</h3><h1>{marks(openTest.minMarks)}</h1></div>
                                </div>
                            )}

                            {tab === "Subjects" && (
                                <div className="table-container">
                                    <table className="stack-sm">
                                        <thead><tr><th>Subject</th><th>Max Marks</th><th>Min Marks</th></tr></thead>
                                        <tbody>
                                            {(detail?.subjects || []).length === 0 ? (
                                                <tr><td colSpan="3">No subjects defined for this class.</td></tr>
                                            ) : detail.subjects.map((s) => (
                                                <tr key={s.id}>
                                                    <td>{s.subjectName}</td>
                                                    <td>{marks(s.maxMarks)}</td>
                                                    <td>{marks(openTest.minMarks)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {tab === "Schedule" && (
                                <div>
                                    <p style={{ color: "#475569", fontSize: 13 }}>Test date: <strong>{fmtDate(scheduleData?.testDate || openTest.testDate)}</strong> · Class timetable below.</p>
                                    <div className="table-container">
                                        <table className="stack-sm">
                                            <thead><tr><th>Day</th><th>Period</th><th>Time</th><th>Subject</th></tr></thead>
                                            <tbody>
                                                {(scheduleData?.slots || []).length === 0 ? (
                                                    <tr><td colSpan="4">No timetable slots for this class.</td></tr>
                                                ) : scheduleData.slots.map((s) => (
                                                    <tr key={`${s.dayOfWeek}-${s.periodNumber}`}>
                                                        <td>{s.dayOfWeek}</td>
                                                        <td>{s.periodNumber}</td>
                                                        <td>{s.startTime || "-"}{s.endTime ? ` – ${s.endTime}` : ""}</td>
                                                        <td>{s.subjectName || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {tab === "Marks" && (
                                <div>
                                    {!marksData ? <p>Loading…</p> : marksData.students.length === 0 ? (
                                        <p>No active students in this class.</p>
                                    ) : (
                                        <>
                                            <div className="table-container">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Student</th>
                                                            {marksData.subjects.map((s) => <th key={s.id}>{s.subjectName} ({marks(openTest.maxMarks)})</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {marksData.students.map((st) => (
                                                            <tr key={st.id}>
                                                                <td>{st.studentName}{st.rollNumber ? ` · ${st.rollNumber}` : ""}</td>
                                                                {marksData.subjects.map((s) => {
                                                                    const key = `${st.id}-${s.id}`;
                                                                    const cell = grid[key] || { marksObtained: "", isAbsent: false };
                                                                    return (
                                                                        <td key={s.id}>
                                                                            <input
                                                                                type="number" min="0" max={openTest.maxMarks} step="0.01"
                                                                                value={cell.marksObtained}
                                                                                disabled={!canEdit || cell.isAbsent}
                                                                                onChange={(e) => setGrid({ ...grid, [key]: { ...cell, marksObtained: e.target.value } })}
                                                                                style={{ width: 90 }}
                                                                            />
                                                                            <label style={{ marginLeft: 6, fontSize: 12 }}>
                                                                                <input type="checkbox" checked={cell.isAbsent} disabled={!canEdit}
                                                                                    onChange={(e) => setGrid({ ...grid, [key]: { ...cell, isAbsent: e.target.checked } })} /> A
                                                                            </label>
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {canEdit && <div style={{ marginTop: 14 }}><button type="button" className="save-btn" disabled={savingMarks} onClick={saveMarks}>{savingMarks ? "Saving..." : "Save Marks"}</button></div>}
                                        </>
                                    )}
                                </div>
                            )}

                            {tab === "Results" && (
                                <div className="table-container">
                                    <table className="stack-sm">
                                        <thead><tr><th>Student</th><th>Total</th><th>Max</th><th>%</th><th>Result</th></tr></thead>
                                        <tbody>
                                            {(resultsData?.results || []).length === 0 ? (
                                                <tr><td colSpan="5">No results yet. Enter marks first.</td></tr>
                                            ) : resultsData.results.map((r) => (
                                                <tr key={r.studentId}>
                                                    <td>{r.studentName}{r.rollNumber ? ` · ${r.rollNumber}` : ""}</td>
                                                    <td>{marks(r.total)}</td>
                                                    <td>{marks(r.maxTotal)}</td>
                                                    <td>{r.percentage}%</td>
                                                    <td><span className={"payment-badge " + (r.status === "pass" ? "mode-default" : "mode-upi")}>{r.status === "pass" ? "Pass" : "Fail"}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {tab === "Delivery" && (
                                <div className="empty-state">
                                    <strong>Result delivery is not used for tests</strong>
                                    <span>Test results are shown here directly. Delivery records: {deliveryData?.sent || 0} sent, {deliveryData?.failed || 0} failed.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content"><Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div><h2>Tests</h2><p>Class-wise tests with date, maximum and minimum marks.</p></div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="cancel-btn" onClick={load}>Refresh</button>
                            {canEdit && <button type="button" className="primary-btn" onClick={openNew}>+ Add Test</button>}
                        </div>
                    </div>

                    <div className="cards" style={{ marginBottom: 18 }}>
                        <div className="dashboard-card"><h3>Total Tests</h3><h1>{tests.length}</h1></div>
                        <div className="dashboard-card"><h3>Classes Covered</h3><h1>{new Set(tests.map((t) => t.className)).size}</h1></div>
                        <div className="dashboard-card"><h3>Average Max Marks</h3><h1>{tests.length ? marks(Math.round(tests.reduce((s, t) => s + Number(t.maxMarks || 0), 0) / tests.length)) : "0"}</h1></div>
                    </div>

                    <div className="payment-filters">
                        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                            <option value="all">All Classes</option>
                            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" className="clear-btn" onClick={() => setFilter("all")}>Clear</button>
                    </div>

                    {loading ? <SkeletonTable rows={4} /> : (
                        <div className="table-container">
                            <table className="compact-table stack-sm">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Class</th>
                                        <th>Test</th>
                                        <th>Max Marks</th>
                                        <th>Min Marks</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.length === 0 ? (
                                        <tr><td colSpan="6">No tests found.</td></tr>
                                    ) : list.map((t) => (
                                        <tr key={t.id}>
                                            <td data-label="Date">{fmtDate(t.testDate)}</td>
                                            <td data-label="Class">{t.className}</td>
                                            <td data-label="Test">{t.title || "-"}</td>
                                            <td data-label="Max Marks">{marks(t.maxMarks)}</td>
                                            <td data-label="Min Marks">{marks(t.minMarks)}</td>
                                            <td data-label="Actions">
                                                <button type="button" className="primary-btn" style={{ marginRight: 8 }} onClick={() => openTestView(t)}>Open</button>
                                                {canEdit && (
                                                    <>
                                                        <button type="button" className="edit-btn" style={{ marginRight: 8 }} onClick={() => openEdit(t)}>Edit</button>
                                                        <button type="button" className="delete-btn" onClick={() => remove(t)}>Delete</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {dialog && (
                <OverlayDialog onClose={() => setDialog(null)} ariaLabel="Test editor">
                    <div className="student-modal" style={{ maxWidth: "540px", maxHeight: "90vh", overflowY: "auto" }}>
                        <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                            <div><h2>{dialog === "new" ? "Add Test" : "Edit Test"}</h2><p>Record the date, maximum and minimum marks.</p></div>
                            <button type="button" className="close-btn" onClick={() => setDialog(null)}>✕</button>
                        </div>
                        <form className="student-form" onSubmit={save} style={{ padding: "20px" }}>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label>Test Name <span style={{ color: "#64748B", fontWeight: 400 }}>(optional)</span></label>
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Unit Test 1" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label>Class *</label>
                                <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} required>
                                    <option value="">Select class</option>
                                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label>Date *</label>
                                <input type="date" value={form.testDate} onChange={(e) => setForm({ ...form, testDate: e.target.value })} required />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                                <div className="form-group"><label>Max Marks *</label><input type="number" min="0" step="0.01" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} required /></div>
                                <div className="form-group"><label>Min Marks</label><input type="number" min="0" step="0.01" value={form.minMarks} onChange={(e) => setForm({ ...form, minMarks: e.target.value })} /></div>
                            </div>
                            <div className="modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                                <button type="button" className="cancel-btn" onClick={() => setDialog(null)}>Cancel</button>
                                <button type="submit" className="save-btn" disabled={saving}>{saving ? "Saving..." : "Save Test"}</button>
                            </div>
                        </form>
                    </div>
                </OverlayDialog>
            )}
        </div>
    );
}
