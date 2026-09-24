import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { STATUS_LABEL, MARK_STATUS_OPTIONS } from "../components/exam/examConstants";


// =====================================================
// MARKS ENTRY (teacher / admin)
//
// Improved grid (spec item 8): each subject shows its max
// and pass marks, every cell carries a mark STATUS (present/
// absent/exempted/medical leave/not applicable — item 10),
// invalid marks are flagged inline BEFORE saving (item 9,
// with the backend as the final authority), and a completion
// meter shows how much is left before locking (item 11).
// Teachers only see the subjects they are authorised for.
// =====================================================

function MarksEntryPage() {

    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedExam, setSelectedExam] = useState(null);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [editable, setEditable] = useState(false);
    const [gridLoading, setGridLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // marks[studentId][subjectId] = { value: string, status: string }
    const [marks, setMarks] = useState({});


    const loadExams = async () => {
        try {
            const res = await api.get("/exams");
            setExams(res.data.exams || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load exams.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadExams(); }, []);


    const openExam = async (exam) => {
        setSelectedExam(exam);
        setGridLoading(true);
        setMarks({});
        try {
            const res = await api.get(`/exams/${exam.id}/marks`);
            const { students: st, subjects: sub, marks: existing, editable: canEdit } = res.data;
            setStudents(st || []);
            setSubjects(sub || []);
            setEditable(!!canEdit);

            const grid = {};
            (st || []).forEach((s) => {
                grid[s.id] = {};
                (sub || []).forEach((subj) => {
                    grid[s.id][subj.subjectId] = { value: "", status: "present" };
                });
            });
            (existing || []).forEach((m) => {
                if (!grid[m.studentId]) grid[m.studentId] = {};
                const status = m.markStatus || (m.isAbsent ? "absent" : "present");
                grid[m.studentId][m.subjectId] = {
                    value: status === "present" && m.marksObtained !== null && m.marksObtained !== undefined
                        ? String(m.marksObtained) : "",
                    status
                };
            });
            setMarks(grid);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load marks.");
            setSelectedExam(null);
        } finally {
            setGridLoading(false);
        }
    };

    const closeExam = () => {
        setSelectedExam(null);
        setStudents([]);
        setSubjects([]);
        setMarks({});
    };


    const setCell = (studentId, subjectId, patch) => {
        setMarks((prev) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: { ...prev[studentId]?.[subjectId], ...patch }
            }
        }));
    };

    // Subjects this user may edit (teachers only get their own; admin all).
    const editableSubjects = useMemo(() => subjects.filter((s) => s.canEdit), [subjects]);

    // A cell is invalid when a PRESENT mark is out of [0, max].
    const isCellInvalid = (subj, cell) => {
        if (!cell || cell.status !== "present" || cell.value === "") return false;
        const n = Number(cell.value);
        return !Number.isFinite(n) || n < 0 || n > Number(subj.maxMarks);
    };

    const invalidCount = useMemo(() => {
        let bad = 0;
        students.forEach((s) => {
            editableSubjects.forEach((subj) => {
                if (isCellInvalid(subj, marks[s.id]?.[subj.subjectId])) bad++;
            });
        });
        return bad;
    }, [students, editableSubjects, marks]);

    // Completion over editable cells: a cell counts as done when it has a
    // non-present status (a decision) or a present mark that is filled in.
    const completion = useMemo(() => {
        const total = students.length * editableSubjects.length;
        if (total === 0) return { done: 0, total: 0, pct: 0 };
        let done = 0;
        students.forEach((s) => {
            editableSubjects.forEach((subj) => {
                const cell = marks[s.id]?.[subj.subjectId];
                if (!cell) return;
                if (cell.status !== "present" || cell.value !== "") done++;
            });
        });
        return { done, total, pct: Math.round((done / total) * 100) };
    }, [students, editableSubjects, marks]);


    const buildPayload = () => {
        const out = [];
        students.forEach((s) => {
            editableSubjects.forEach((subj) => {
                const cell = marks[s.id]?.[subj.subjectId];
                if (!cell) return;
                if (cell.status === "present") {
                    if (cell.value === "" || cell.value === null) return; // not entered yet
                    out.push({ studentId: s.id, subjectId: subj.subjectId, markStatus: "present", marksObtained: Number(cell.value) });
                } else {
                    out.push({ studentId: s.id, subjectId: subj.subjectId, markStatus: cell.status });
                }
            });
        });
        return out;
    };

    const saveMarks = async ({ silent = false } = {}) => {
        if (!selectedExam) return false;
        if (invalidCount > 0) {
            alert(`${invalidCount} mark(s) are out of range. Fix the highlighted cells before saving.`);
            return false;
        }
        try {
            setSaving(true);
            await api.put(`/exams/${selectedExam.id}/marks`, { marks: buildPayload() });
            if (!silent) alert("Marks saved.");
            return true;
        } catch (error) {
            // Surface the backend's authoritative rejection message.
            alert(error.response?.data?.message || "Unable to save marks.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const lockMarks = async () => {
        if (!selectedExam) return;
        if (!window.confirm(
            "Submit and lock these marks?\n\nYou will no longer be able to edit them. " +
            "Ask the admin to unlock the exam if you need changes after this."
        )) return;

        if (!(await saveMarks({ silent: true }))) return;
        try {
            setSaving(true);
            await api.post(`/exams/${selectedExam.id}/lock`);
            alert("Marks submitted and locked. The admin can now review and publish.");
            closeExam();
            loadExams();
        } catch (error) {
            const data = error.response?.data;
            if (data?.requiresConfirmation) {
                if (window.confirm(data.message)) {
                    try {
                        await api.post(`/exams/${selectedExam.id}/lock`, { override: true });
                        alert("Marks submitted and locked.");
                        closeExam();
                        loadExams();
                    } catch (e2) {
                        alert(e2.response?.data?.message || "Unable to lock.");
                    }
                }
            } else {
                alert(data?.message || "Unable to lock marks.");
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Marks Entry</h2>
                            <p>Enter marks for your subjects, then submit &amp; lock when you are done.</p>
                        </div>
                    </div>

                    {!selectedExam && (
                        <div className="table-container">
                            <table className="compact-table">
                                <thead>
                                    <tr>
                                        <th>Exam</th>
                                        <th>Class</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="4">Loading...</td></tr>
                                    ) : exams.length === 0 ? (
                                        <tr><td colSpan="4">No exams assigned to your classes yet.</td></tr>
                                    ) : exams.map((exam) => (
                                        <tr key={exam.id}>
                                            <td>{exam.examName}</td>
                                            <td>{exam.className}</td>
                                            <td>{STATUS_LABEL[exam.status] || exam.status}</td>
                                            <td>
                                                <button type="button" onClick={() => openExam(exam)}>
                                                    {exam.status === "open" ? "Enter Marks" : "View Marks"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {selectedExam && (
                        <div className="settings-card">
                            <div className="exam-row-between">
                                <h3 style={{ margin: 0 }}>{selectedExam.examName} — {selectedExam.className}</h3>
                                <button type="button" onClick={closeExam}>Back to list</button>
                            </div>

                            {!editable && (
                                <p style={{ color: "#b45309", marginTop: "12px" }}>
                                    🔒 These marks are locked and cannot be edited.
                                </p>
                            )}

                            {gridLoading ? (
                                <p style={{ marginTop: "15px" }}>Loading grid...</p>
                            ) : students.length === 0 ? (
                                <p style={{ marginTop: "15px" }}>No active students in this class.</p>
                            ) : editableSubjects.length === 0 ? (
                                <p style={{ marginTop: "15px" }}>You have no subjects to enter for this exam.</p>
                            ) : (
                                <>
                                    {editable && (
                                        <div className="exam-completion">
                                            <div className="exam-progress">
                                                <div className="exam-progress-fill" style={{ width: `${completion.pct}%` }} />
                                            </div>
                                            <span>{completion.done}/{completion.total} entered ({completion.pct}%)
                                                {invalidCount > 0 && <strong style={{ color: "#b91c1c" }}> · {invalidCount} out of range</strong>}
                                            </span>
                                        </div>
                                    )}

                                    <div className="table-container exam-marks-grid" style={{ marginTop: "16px" }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Roll</th>
                                                    <th>Student</th>
                                                    {editableSubjects.map((subj) => (
                                                        <th key={subj.subjectId}>
                                                            {subj.subjectName}
                                                            <span style={{ display: "block", color: "#888", fontWeight: "normal", fontSize: "11px" }}>
                                                                max {subj.maxMarks}
                                                                {subj.passMarks !== null && subj.passMarks !== undefined && subj.passMarks !== ""
                                                                    ? ` · pass ${subj.passMarks}` : ""}
                                                            </span>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((s) => (
                                                    <tr key={s.id}>
                                                        <td>{s.rollNumber || "-"}</td>
                                                        <td>{s.studentName}</td>
                                                        {editableSubjects.map((subj) => {
                                                            const cell = marks[s.id]?.[subj.subjectId] || { value: "", status: "present" };
                                                            const invalid = isCellInvalid(subj, cell);
                                                            return (
                                                                <td key={subj.subjectId} data-label={subj.subjectName}>
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                                        <input
                                                                            type="number" min="0" max={subj.maxMarks}
                                                                            value={cell.value}
                                                                            disabled={!editable || cell.status !== "present"}
                                                                            className={invalid ? "exam-cell-invalid" : ""}
                                                                            placeholder={cell.status !== "present" ? "—" : ""}
                                                                            onChange={(e) => setCell(s.id, subj.subjectId, { value: e.target.value })}
                                                                            style={{ width: "72px" }}
                                                                        />
                                                                        <select
                                                                            value={cell.status}
                                                                            disabled={!editable}
                                                                            onChange={(e) => setCell(s.id, subj.subjectId, {
                                                                                status: e.target.value,
                                                                                value: e.target.value === "present" ? cell.value : ""
                                                                            })}
                                                                            style={{ fontSize: "11px" }}
                                                                        >
                                                                            {MARK_STATUS_OPTIONS.map((o) => (
                                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {editable && (
                                        <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                                            <button type="button" className="primary-btn" onClick={() => saveMarks()} disabled={saving || invalidCount > 0}>
                                                {saving ? "Saving..." : "Save Marks"}
                                            </button>
                                            <button type="button" onClick={lockMarks} disabled={saving || invalidCount > 0}>
                                                Submit &amp; Lock
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


export default MarksEntryPage;
