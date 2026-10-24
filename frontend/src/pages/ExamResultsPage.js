import { toast } from "../services/notify";
import { useCallback, useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";
import ExamDetail from "../components/exam/ExamDetail";
import GradingScalesManager from "../components/exam/GradingScalesManager";
import { ASSESSMENT_SLOTS, assessmentSlot, examTypeLabel, examCategoryLabel, STATUS_LABEL } from "../components/exam/examConstants";


// =====================================================
// EXAM & RESULTS (admin)
//
// Lists exams as DEFINITIONS (one exam spanning one or more
// classes) and opens each into a tabbed detail view. Also
// hosts exam creation and the grading-scale manager
// (spec items 1, 15, 25).
// =====================================================

function ExamResultsPage() {

    const [definitions, setDefinitions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [years, setYears] = useState([]);
    const [scales, setScales] = useState([]);
    const [loading, setLoading] = useState(true);

    const [openDef, setOpenDef] = useState(null); // opened definition -> detail view
    const [showGrading, setShowGrading] = useState(false);

    // Create-exam form. A single "slot" captures assessment type + term in the
    // card's own FA/SA language; it maps to examCategory/term/examType on submit.
    const [form, setForm] = useState({
        examName: "", slot: "t1_sa",
        weightage: "", academicYearId: "", startDate: "", endDate: "", gradingScaleId: ""
    });
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [creating, setCreating] = useState(false);


    const loadDefinitions = useCallback(async () => {
        try {
            const res = await api.get("/exams/definitions");
            setDefinitions(res.data.definitions || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load exams.");
        }
    }, []);

    const loadLookups = useCallback(async () => {
        // Classes for the picker; academic years + grading scales for the form.
        try {
            const res = await api.get("/classes");
            setClasses([...new Set((res.data || []).map((c) => c.className))].sort());
        } catch (e) { /* non-fatal */ }
        try {
            const res = await api.get("/fees/academic-years");
            setYears(Array.isArray(res.data) ? res.data : []);
        } catch (e) { /* optional */ }
        try {
            const res = await api.get("/exams/grading-scales");
            setScales(res.data.scales || []);
        } catch (e) { /* optional */ }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadDefinitions(), loadLookups()]);
            setLoading(false);
        })();
    }, [loadDefinitions, loadLookups]);


    const toggleClass = (name) => {
        setSelectedClasses((prev) =>
            prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
        );
    };

    const createExam = async (e) => {
        e.preventDefault();
        if (!form.examName.trim() || selectedClasses.length === 0) {
            toast("Enter an exam name and select at least one class.");
            return;
        }
        try {
            setCreating(true);
            const slot = assessmentSlot(form.slot);
            const res = await api.post("/exams", {
                examName: form.examName.trim(),
                examType: slot.examType,
                examCategory: slot.examCategory,
                term: slot.term,
                weightage: form.weightage === "" ? null : Number(form.weightage),
                academicYearId: form.academicYearId || null,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
                gradingScaleId: form.gradingScaleId || null,
                classNames: selectedClasses
            });
            const skipped = res.data.skipped || [];
            let msg = res.data.message || "Exam created.";
            if (skipped.length) msg += "\n\nSkipped:\n" + skipped.map((s) => `• ${s.className}: ${s.reason}`).join("\n");
            toast(msg);
            setForm({
                examName: "", slot: "t1_sa",
                weightage: "", academicYearId: "", startDate: "", endDate: "", gradingScaleId: ""
            });
            setSelectedClasses([]);
            loadDefinitions();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to create exam.");
        } finally {
            setCreating(false);
        }
    };


    // ---- Detail view ----
    if (openDef) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content">
                    <Navbar />
                    <div className="page-content">
                        <ExamDetail
                            definition={openDef}
                            onBack={() => { setOpenDef(null); loadDefinitions(); }}
                            onChanged={loadDefinitions}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ---- List view ----
    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Exam &amp; Results</h2>
                            <p>Create an exam across one or more classes, then open it to configure subjects, review results and deliver report cards.</p>
                        </div>
                        <button type="button" onClick={() => setShowGrading((v) => !v)}>
                            {showGrading ? "Hide Grading Scales" : "Grading Scales"}
                        </button>
                    </div>

                    {showGrading && <GradingScalesManager />}

                    <div className="settings-card" style={{ marginTop: "25px" }}>
                        <h3>Create Exam</h3>
                        <p style={{ color: "#666", marginTop: "6px" }}>
                            One exam is created per selected class, each with its own subjects, marks and results.
                            Classes without subjects are skipped.
                        </p>

                        <form onSubmit={createExam} style={{ marginTop: "16px" }}>
                            <div className="exam-form-grid">
                                <label>Exam name
                                    <input
                                        value={form.examName}
                                        onChange={(e) => setForm({ ...form, examName: e.target.value })}
                                        placeholder="e.g. Term 1, 2026"
                                        required
                                    />
                                </label>
                                <label>Assessment
                                    <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}>
                                        {ASSESSMENT_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </label>
                                <label>Weightage
                                    <input
                                        type="number" min="0" step="1"
                                        value={form.weightage}
                                        onChange={(e) => setForm({ ...form, weightage: e.target.value })}
                                        placeholder={assessmentSlot(form.slot).examCategory === "unit_test" ? "default 15" : assessmentSlot(form.slot).examCategory === "term" ? "default 20" : "n/a"}
                                        disabled={assessmentSlot(form.slot).examCategory === "final"}
                                    />
                                </label>
                                <label>Academic year
                                    <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
                                        <option value="">— None —</option>
                                        {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                                    </select>
                                </label>
                                <label>Grading scale
                                    <select value={form.gradingScaleId} onChange={(e) => setForm({ ...form, gradingScaleId: e.target.value })}>
                                        <option value="">Default</option>
                                        {scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </label>
                                <label>Start date
                                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                                </label>
                                <label>End date
                                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                                </label>
                            </div>

                            <p style={{ fontSize: "12px", color: "#777", margin: "4px 0 0" }}>
                                The <strong>Assessment</strong> you pick is exactly how it appears on the progress card.
                                Formative (FA) exams feed a term; the term's <strong>Summative (SA)</strong> card aggregates its FAs + SA,
                                and <strong>Final</strong> combines Term I + II. Create FA1 before FA2 (numbering follows creation order).
                                Weightage is optional — defaults 15 (FA) / 20 (SA) apply.
                            </p>

                            <div style={{ margin: "14px 0" }}>
                                <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px" }}>Classes</div>
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    {classes.length === 0 ? (
                                        <span style={{ color: "#b45309" }}>No classes found. Create classes first.</span>
                                    ) : classes.map((c) => (
                                        <label key={c} className={"exam-chip" + (selectedClasses.includes(c) ? " exam-chip-active" : "")}>
                                            <input
                                                type="checkbox"
                                                checked={selectedClasses.includes(c)}
                                                onChange={() => toggleClass(c)}
                                                style={{ marginRight: "6px" }}
                                            />
                                            {c}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="primary-btn" disabled={creating}>
                                {creating ? "Creating..." : `Create Exam${selectedClasses.length > 1 ? ` (${selectedClasses.length} classes)` : ""}`}
                            </button>
                        </form>
                    </div>

                    <div className="table-container" style={{ marginTop: "25px" }}>
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Exam</th>
                                    <th>Type</th>
                                    <th>Category</th>
                                    <th>Academic Year</th>
                                    <th>Classes</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7">Loading...</td></tr>
                                ) : definitions.length === 0 ? (
                                    <tr><td colSpan="7">No exams yet.</td></tr>
                                ) : definitions.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.name}</td>
                                        <td>{examTypeLabel(d.examType)}</td>
                                        <td>{examCategoryLabel(d.examCategory)}</td>
                                        <td>{d.academicYear || "—"}</td>
                                        <td>{d.classCount} ({(d.classes || []).map((c) => c.className).join(", ")})</td>
                                        <td>
                                            {(d.statuses || []).map((s) => (
                                                <span key={s} className={"exam-badge exam-badge-" + s} style={{ marginRight: "4px" }}>
                                                    {STATUS_LABEL[s] || s}
                                                </span>
                                            ))}
                                        </td>
                                        <td>
                                            <button type="button" className="primary-btn" onClick={() => setOpenDef(d)}>
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default ExamResultsPage;
