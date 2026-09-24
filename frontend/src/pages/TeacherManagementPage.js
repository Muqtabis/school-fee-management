import { useEffect, useState, useCallback } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


// Month-start and today as YYYY-MM-DD, for the summary default range.
function monthStartIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}


function TeacherManagementPage() {

    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Assignment working state. Class Teacher needs only a class; Subject
    // Teacher also needs a subject (from the selected class's subjects).
    const [assignTeacherId, setAssignTeacherId] = useState("");
    const [assignClassName, setAssignClassName] = useState("");
    const [assignRole, setAssignRole] = useState("subject_teacher");
    const [assignSubjectId, setAssignSubjectId] = useState("");

    // Teacher attendance summary filters (per-teacher present/absent/leave
    // counts, auto-fetched from teacher attendance for the chosen range).
    const [sumFrom, setSumFrom] = useState(monthStartIso());
    const [sumTo, setSumTo] = useState(todayIso());
    const [summary, setSummary] = useState([]);
    const [sumLoading, setSumLoading] = useState(false);


    // =====================================================
    // LOADERS
    // =====================================================

    const loadTeachers = async () => {
        try {
            const res = await api.get("/teachers");
            setTeachers(res.data.teachers || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load teachers.");
        }
    };

    const loadClasses = async () => {
        try {
            const res = await api.get("/classes");
            const names = [...new Set((res.data || []).map((c) => c.className))].sort();
            setClasses(names);
        } catch (error) {
            console.error("Classes load error:", error.response?.data || error.message);
        }
    };

    const loadSubjects = async () => {
        try {
            const res = await api.get("/teachers/subjects");
            setAllSubjects(res.data.subjects || []);
        } catch (error) {
            console.error("Subjects load error:", error.response?.data || error.message);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadTeachers(), loadClasses(), loadSubjects()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    // Subjects of the currently selected class (source for the subject dropdown).
    const classSubjects = allSubjects.filter((s) => s.className === assignClassName);


    // =====================================================
    // ASSIGNMENT (class teacher OR subject teacher)
    // =====================================================

    // Subject-teacher assignment, retrying once with an override if the
    // subject is already held by a different teacher (409 confirmation).
    const postSubjectAssignment = async (override) => {
        await api.post(`/teachers/${assignTeacherId}/subjects`, {
            subjectId: Number(assignSubjectId),
            override
        });
    };

    const submitAssignment = async (e) => {
        e.preventDefault();
        if (!assignTeacherId || !assignClassName) {
            alert("Choose a teacher and a class.");
            return;
        }

        // Class Teacher: class-level assignment only (grants attendance access).
        if (assignRole === "class_teacher") {
            try {
                await api.post(`/teachers/${assignTeacherId}/classes`, {
                    className: assignClassName,
                    role: "class_teacher"
                });
                setAssignClassName("");
                setAssignSubjectId("");
                loadTeachers();
            } catch (error) {
                alert(error.response?.data?.message || "Unable to assign class teacher.");
            }
            return;
        }

        // Subject Teacher: a specific subject in the selected class.
        if (!assignSubjectId) {
            alert("Choose a subject for the subject teacher.");
            return;
        }
        try {
            await postSubjectAssignment(false);
            setAssignSubjectId("");
            loadTeachers();
        } catch (error) {
            const data = error.response?.data;
            if (error.response?.status === 409 && data?.requiresConfirmation) {
                if (window.confirm(data.message || "Reassign this subject to the selected teacher?")) {
                    try {
                        await postSubjectAssignment(true);
                        setAssignSubjectId("");
                        loadTeachers();
                    } catch (err2) {
                        alert(err2.response?.data?.message || "Unable to assign subject.");
                    }
                }
                return;
            }
            alert(data?.message || "Unable to assign subject.");
        }
    };

    const unassignClass = async (teacherId, className) => {
        if (!window.confirm(`Remove class-teacher role for ${className}?`)) return;
        try {
            await api.delete(`/teachers/${teacherId}/classes`, { data: { className } });
            loadTeachers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to remove assignment.");
        }
    };

    const unassignSubject = async (teacherId, subjectId, label) => {
        if (!window.confirm(`Remove ${label} from this teacher?`)) return;
        try {
            await api.delete(`/teachers/${teacherId}/subjects`, { data: { subjectId } });
            loadTeachers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to remove subject assignment.");
        }
    };


    // =====================================================
    // TEACHER ATTENDANCE SUMMARY (per-teacher counts)
    //
    // Auto-fetched from the teacher attendance records for the
    // selected range, so Teacher Management shows how many days
    // each teacher was present / absent / on leave without any
    // duplicate daily-history table (that lives on the Teacher
    // Attendance page).
    // =====================================================

    const loadSummary = useCallback(async () => {
        setSumLoading(true);
        try {
            const params = {};
            if (sumFrom) params.from = sumFrom;
            if (sumTo) params.to = sumTo;
            const res = await api.get("/attendance/summary", { params });
            setSummary(res.data.summary || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load attendance summary.");
        } finally {
            setSumLoading(false);
        }
    }, [sumFrom, sumTo]);

    // Load (and reload) the summary whenever the range changes.
    useEffect(() => {
        loadSummary();
    }, [loadSummary]);


    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Teacher Management</h2>
                            <p>Assign classes to teachers (as subject or class teacher) and review teacher attendance.</p>
                        </div>
                    </div>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            {/* ============================================
                                ASSIGN A CLASS TO A TEACHER
                            ============================================ */}
                            <div className="settings-card">
                                <h3>Assign Teacher</h3>
                                <p style={{ color: "#666", marginTop: "6px" }}>
                                    A <strong>Class Teacher</strong> owns a class and marks its student attendance
                                    (one class teacher per class). A <strong>Subject Teacher</strong> is assigned a
                                    specific subject in a class and may only enter that subject's marks. Being a
                                    class teacher does not grant subject marks access.
                                </p>

                                {teachers.length === 0 ? (
                                    <p style={{ marginTop: "12px", color: "#b45309" }}>
                                        No teachers yet. Create teacher accounts from the Users page first.
                                    </p>
                                ) : (
                                    <form
                                        onSubmit={submitAssignment}
                                        style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}
                                    >
                                        <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)} required>
                                            <option value="">Select teacher</option>
                                            {teachers.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                            ))}
                                        </select>

                                        <select
                                            value={assignRole}
                                            onChange={(e) => { setAssignRole(e.target.value); setAssignSubjectId(""); }}
                                        >
                                            <option value="subject_teacher">Subject Teacher</option>
                                            <option value="class_teacher">Class Teacher</option>
                                        </select>

                                        <select
                                            value={assignClassName}
                                            onChange={(e) => { setAssignClassName(e.target.value); setAssignSubjectId(""); }}
                                            required
                                        >
                                            <option value="">Select class</option>
                                            {classes.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>

                                        {assignRole === "subject_teacher" && (
                                            <select
                                                value={assignSubjectId}
                                                onChange={(e) => setAssignSubjectId(e.target.value)}
                                                disabled={!assignClassName}
                                                required
                                            >
                                                <option value="">
                                                    {assignClassName
                                                        ? (classSubjects.length ? "Select subject" : "No subjects for this class")
                                                        : "Select a class first"}
                                                </option>
                                                {classSubjects.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.subjectName}</option>
                                                ))}
                                            </select>
                                        )}

                                        <button type="submit" className="primary-btn">Assign</button>
                                    </form>
                                )}
                            </div>

                            {/* ============================================
                                TEACHERS + THEIR CLASSES + SUBJECTS
                            ============================================ */}
                            <div className="table-container" style={{ marginTop: "25px" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Teacher</th>
                                            <th>Email</th>
                                            <th>Class Teacher Of</th>
                                            <th>Subject Teacher Of</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachers.length === 0 ? (
                                            <tr><td colSpan="4">No teachers found.</td></tr>
                                        ) : (
                                            teachers.map((t) => {
                                                const classTeacherOf = (t.classes || []).filter((c) => c.role === "class_teacher");
                                                return (
                                                    <tr key={t.id}>
                                                        <td>{t.name}</td>
                                                        <td>{t.email}</td>
                                                        <td>
                                                            {classTeacherOf.length === 0 ? (
                                                                <span style={{ color: "#888" }}>None</span>
                                                            ) : (
                                                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                                    {classTeacherOf.map((c) => (
                                                                        <span
                                                                            key={c.className}
                                                                            title="Class Teacher"
                                                                            style={{
                                                                                display: "inline-flex",
                                                                                alignItems: "center",
                                                                                gap: "6px",
                                                                                padding: "3px 8px",
                                                                                background: "#dcfce7",
                                                                                border: "1px solid #86efac",
                                                                                borderRadius: "12px",
                                                                                fontSize: "13px"
                                                                            }}
                                                                        >
                                                                            {c.className}
                                                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d" }}>★ CT</span>
                                                                            <button
                                                                                type="button"
                                                                                title="Remove"
                                                                                onClick={() => unassignClass(t.id, c.className)}
                                                                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b91c1c", fontWeight: "bold" }}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {(!t.subjects || t.subjects.length === 0) ? (
                                                                <span style={{ color: "#888" }}>None</span>
                                                            ) : (
                                                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                                    {t.subjects.map((s) => (
                                                                        <span
                                                                            key={s.subjectId}
                                                                            title={`Subject Teacher — ${s.className}`}
                                                                            style={{
                                                                                display: "inline-flex",
                                                                                alignItems: "center",
                                                                                gap: "6px",
                                                                                padding: "3px 8px",
                                                                                background: "#eef2ff",
                                                                                border: "1px solid #c7d2fe",
                                                                                borderRadius: "12px",
                                                                                fontSize: "13px"
                                                                            }}
                                                                        >
                                                                            {s.className} · {s.subjectName}
                                                                            <button
                                                                                type="button"
                                                                                title="Remove"
                                                                                onClick={() => unassignSubject(t.id, s.subjectId, `${s.className} · ${s.subjectName}`)}
                                                                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b91c1c", fontWeight: "bold" }}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p style={{ color: "#888", fontSize: "13px", marginTop: "8px" }}>
                                ★ CT = Class Teacher (attendance access). Subject teachers may enter marks only for
                                their assigned subject. Subjects for each class are managed on the Class Management page.
                            </p>

                            {/* ============================================
                                TEACHER ATTENDANCE SUMMARY (per teacher)
                            ============================================ */}
                            <div className="settings-card" style={{ marginTop: "25px" }}>
                                <h3>Teacher Attendance Summary</h3>
                                <p style={{ color: "#666", marginTop: "6px" }}>
                                    Days present, absent, half-day and on leave for each teacher, pulled
                                    automatically from the marked attendance. Daily marking and the full
                                    day-by-day history live on the Teacher Attendance page.
                                </p>

                                <div style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap", alignItems: "center" }}>
                                    <label style={{ fontSize: "13px", color: "#555" }}>
                                        From <input type="date" value={sumFrom} max={sumTo || undefined} onChange={(e) => setSumFrom(e.target.value)} />
                                    </label>
                                    <label style={{ fontSize: "13px", color: "#555" }}>
                                        To <input type="date" value={sumTo} min={sumFrom || undefined} onChange={(e) => setSumTo(e.target.value)} />
                                    </label>
                                    <button type="button" className="primary-btn" onClick={loadSummary} disabled={sumLoading}>
                                        {sumLoading ? "Loading..." : "Refresh"}
                                    </button>
                                </div>

                                <div className="table-container" style={{ marginTop: "18px" }}>
                                    <table className="attendance-summary-table">
                                        <thead>
                                            <tr>
                                                <th>Teacher</th>
                                                <th>Email</th>
                                                <th>Present</th>
                                                <th>Absent</th>
                                                <th>Half-day</th>
                                                <th>Leave</th>
                                                <th>Days Marked</th>
                                                <th>Present %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sumLoading ? (
                                                <tr><td colSpan="8" style={{ textAlign: "center" }}>Loading...</td></tr>
                                            ) : summary.length === 0 ? (
                                                <tr><td colSpan="8" style={{ textAlign: "center" }}>No teachers found.</td></tr>
                                            ) : (
                                                summary.map((s) => {
                                                    const present = Number(s.present) || 0;
                                                    const half = Number(s.half_day) || 0;
                                                    const marked = Number(s.markedDays) || 0;
                                                    // Half-days count as half a present day toward the rate.
                                                    const pct = marked > 0
                                                        ? Math.round(((present + half * 0.5) / marked) * 100)
                                                        : null;
                                                    return (
                                                        <tr key={s.teacherId}>
                                                            <td>{s.name}</td>
                                                            <td>{s.email}</td>
                                                            <td><span className="att-badge att-present">{present}</span></td>
                                                            <td><span className="att-badge att-absent">{Number(s.absent) || 0}</span></td>
                                                            <td><span className="att-badge att-half">{half}</span></td>
                                                            <td><span className="att-badge att-leave">{Number(s.leave) || 0}</span></td>
                                                            <td>{marked}</td>
                                                            <td>{pct === null ? <span style={{ color: "#888" }}>—</span> : `${pct}%`}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


export default TeacherManagementPage;
