import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


// =====================================================
// RESULTS OVERVIEW  (admin class-wise gradebook)
//
// Academic Year -> Exam -> Class -> students x subjects.
// Read-only admin view over the whole school's marks,
// unrestricted by teacher assignments (spec item 13).
// Reuses the existing admin endpoints: /exams/definitions
// (the exam list) and /exams/:examId/results (the grid).
// =====================================================

const STATUS_BADGE = {
    pass: { label: "Pass", color: "#15803d", bg: "#dcfce7" },
    fail: { label: "Fail", color: "#b91c1c", bg: "#fee2e2" },
    absent: { label: "Absent", color: "#92400e", bg: "#fef3c7" }
};

// How a single subject cell reads for a student.
function cellText(sr) {
    if (!sr) return "-";
    if (sr.markStatus && sr.markStatus !== "present") {
        const map = { absent: "AB", exempted: "EX", medical_leave: "ML", not_applicable: "N/A" };
        return map[sr.markStatus] || sr.markStatus;
    }
    if (sr.marksObtained === null || sr.marksObtained === undefined) return "-";
    return `${sr.marksObtained}/${sr.maxMarks}`;
}


function ResultsOverviewPage() {

    const [definitions, setDefinitions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [year, setYear] = useState("");
    const [definitionId, setDefinitionId] = useState("");
    const [examId, setExamId] = useState("");

    const [grid, setGrid] = useState(null); // { exam, subjects, results, analytics, published }
    const [gridLoading, setGridLoading] = useState(false);


    // =====================================================
    // LOAD EXAM LIST
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/exams/definitions");
                setDefinitions(res.data.definitions || []);
            } catch (error) {
                alert(error.response?.data?.message || "Unable to load exams.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Distinct academic years for the first dropdown.
    const years = useMemo(() => {
        const set = new Set(definitions.map((d) => d.academicYear).filter(Boolean));
        return [...set].sort();
    }, [definitions]);

    // Exams within the chosen year (or all when no year filter).
    const examsInYear = useMemo(
        () => definitions.filter((d) => !year || d.academicYear === year),
        [definitions, year]
    );

    // The selected definition and its child per-class exams.
    const selectedDef = definitions.find((d) => String(d.id) === String(definitionId));
    const classes = selectedDef ? (selectedDef.classes || []) : [];


    // =====================================================
    // LOAD THE GRID FOR A CLASS (child exam)
    // =====================================================

    const loadGrid = async (childExamId) => {
        setExamId(childExamId);
        setGrid(null);
        if (!childExamId) return;
        setGridLoading(true);
        try {
            const res = await api.get(`/exams/${childExamId}/results`);
            setGrid(res.data);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load results.");
        } finally {
            setGridLoading(false);
        }
    };

    // Reset the downstream selections when an upstream one changes.
    const onYearChange = (v) => { setYear(v); setDefinitionId(""); setExamId(""); setGrid(null); };
    const onDefChange = (v) => { setDefinitionId(v); setExamId(""); setGrid(null); };


    // =====================================================
    // UI
    // =====================================================

    const subjects = grid?.subjects || [];
    const results = grid?.results || [];

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Results Overview</h2>
                            <p>View any class's marks for any exam. Admin-only, read-only.</p>
                        </div>
                    </div>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            {/* FILTERS */}
                            <div className="settings-card">
                                <div className="overview-filters">
                                    <select value={year} onChange={(e) => onYearChange(e.target.value)}>
                                        <option value="">All academic years</option>
                                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                    </select>

                                    <select value={definitionId} onChange={(e) => onDefChange(e.target.value)}>
                                        <option value="">Select exam</option>
                                        {examsInYear.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}{d.academicYear ? ` — ${d.academicYear}` : ""}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={examId}
                                        onChange={(e) => loadGrid(e.target.value)}
                                        disabled={!definitionId}
                                    >
                                        <option value="">
                                            {definitionId ? "Select class" : "Select an exam first"}
                                        </option>
                                        {classes.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.className} ({c.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* GRID */}
                            {gridLoading ? (
                                <p style={{ marginTop: "20px" }}>Loading results...</p>
                            ) : grid ? (
                                <ResultsGrid
                                    exam={grid.exam}
                                    subjects={subjects}
                                    results={results}
                                    analytics={grid.analytics}
                                    published={grid.published}
                                />
                            ) : (
                                <p style={{ marginTop: "20px", color: "#666" }}>
                                    Choose an exam and a class to see the marks grid.
                                </p>
                            )}
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


// The students x subjects table plus a small analytics strip.
function ResultsGrid({ exam, subjects, results, analytics, published }) {
    if (!results.length) {
        return <p style={{ marginTop: "20px", color: "#666" }}>No active students in this class.</p>;
    }

    return (
        <>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "20px" }}>
                <h3 style={{ margin: 0 }}>{exam?.className} — {exam?.examName}</h3>
                <span
                    style={{
                        fontSize: "12px", padding: "2px 10px", borderRadius: "12px",
                        background: published ? "#dcfce7" : "#e5e7eb",
                        color: published ? "#15803d" : "#374151"
                    }}
                >
                    {published ? "Published" : `Status: ${exam?.status || "—"}`}
                </span>
            </div>

            {analytics && (
                <div className="overview-stats">
                    <div className="stat-pill"><span>Students</span><strong>{analytics.totalStudents}</strong></div>
                    <div className="stat-pill"><span>Pass</span><strong>{analytics.pass}</strong></div>
                    <div className="stat-pill"><span>Fail</span><strong>{analytics.fail}</strong></div>
                    <div className="stat-pill"><span>Absent</span><strong>{analytics.absent}</strong></div>
                    <div className="stat-pill"><span>Average %</span><strong>{analytics.averagePercent}</strong></div>
                </div>
            )}

            <div className="table-container" style={{ marginTop: "16px" }}>
                <table>
                    <thead>
                        <tr>
                            <th>Roll</th>
                            <th>Student</th>
                            {subjects.map((s) => (
                                <th key={s.subjectId}>{s.subjectName}<br /><small>/{s.maxMarks}</small></th>
                            ))}
                            <th>Total</th>
                            <th>%</th>
                            <th>Grade</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r) => {
                            const bySub = new Map((r.subjectResults || []).map((sr) => [sr.subjectId, sr]));
                            const badge = STATUS_BADGE[r.overallStatus] || { label: r.overallStatus, color: "#374151", bg: "#e5e7eb" };
                            return (
                                <tr key={r.studentId}>
                                    <td>{r.rollNumber}</td>
                                    <td>{r.studentName}</td>
                                    {subjects.map((s) => (
                                        <td key={s.subjectId}>{cellText(bySub.get(s.subjectId))}</td>
                                    ))}
                                    <td>{r.totalObtained}/{r.totalMax}</td>
                                    <td>{r.percentage}</td>
                                    <td>{r.grade || "-"}</td>
                                    <td>
                                        <span style={{ fontSize: "12px", padding: "2px 10px", borderRadius: "12px", background: badge.bg, color: badge.color }}>
                                            {badge.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}


export default ResultsOverviewPage;
