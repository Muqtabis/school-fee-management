import { useEffect, useState, useCallback, useMemo } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


const STATUS_OPTIONS = [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "half_day", label: "Half-day" },
    { value: "leave", label: "Leave" }
];

const STATUS_LABEL = STATUS_OPTIONS.reduce((acc, o) => {
    acc[o.value] = o.label;
    return acc;
}, {});

const STATUS_CLASS = {
    present: "att-present",
    absent: "att-absent",
    half_day: "att-half",
    leave: "att-leave"
};

function today() {
    return new Date().toISOString().slice(0, 10);
}
function monthStart() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}


// =====================================================
// STUDENT ATTENDANCE
//
// A class teacher (or admin) picks one of their classes and
// a date, then marks each student (Mark tab). The History tab
// searches past records by student, status and date range with
// a summary counts strip. The backend enforces class-teacher
// ownership on every call.
// =====================================================

function StudentAttendancePage() {

    const [activeTab, setActiveTab] = useState("mark");

    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [date, setDate] = useState(today());

    const [rows, setRows] = useState([]);   // [{ studentId, studentName, rollNumber, status, remark }]
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [classesLoaded, setClassesLoaded] = useState(false);

    // History filters.
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());
    const [histStudentId, setHistStudentId] = useState("");   // "" = all
    const [histStatus, setHistStatus] = useState("");         // "" = all
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);


    // =====================================================
    // LOAD THE CLASSES I CAN MARK
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/student-attendance/my-classes");
                const list = res.data.classes || [];
                setClasses(list);
                if (list.length > 0) setSelectedClass(list[0]);
            } catch (error) {
                alert(error.response?.data?.message || "Unable to load your classes.");
            } finally {
                setClassesLoaded(true);
            }
        })();
    }, []);


    // =====================================================
    // LOAD ROSTER FOR CLASS + DATE (mark tab)
    // =====================================================

    const loadRoster = useCallback(async (className, forDate) => {
        if (!className) { setRows([]); return; }
        try {
            setLoading(true);
            const res = await api.get("/student-attendance", { params: { className, date: forDate } });
            const seeded = (res.data.records || []).map((r) => ({
                ...r,
                status: r.status || "present",
                remark: r.remark || ""
            }));
            setRows(seeded);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load attendance.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedClass) loadRoster(selectedClass, date);
    }, [selectedClass, date, loadRoster]);

    // Reset the history student filter when the class changes (its students differ).
    useEffect(() => {
        setHistStudentId("");
        setHistory([]);
    }, [selectedClass]);

    // Student list for the history filter comes from the roster.
    const studentOptions = useMemo(
        () => rows.map((r) => ({ id: r.studentId, name: r.studentName, roll: r.rollNumber })),
        [rows]
    );


    // =====================================================
    // GRID EDITS + SAVE (mark tab)
    // =====================================================

    const setField = (studentId, field, value) => {
        setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r)));
    };

    const markAll = (status) => {
        setRows((prev) => prev.map((r) => ({ ...r, status })));
    };

    const save = async () => {
        if (!selectedClass) return;
        try {
            setSaving(true);
            const records = rows.map((r) => ({ studentId: r.studentId, status: r.status, remark: r.remark }));
            const res = await api.put("/student-attendance", { className: selectedClass, date, records });
            alert(res.data.message || "Attendance saved.");
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save attendance.");
        } finally {
            setSaving(false);
        }
    };


    // =====================================================
    // HISTORY (history tab)
    // =====================================================

    const loadHistory = async () => {
        if (!selectedClass) { alert("Choose a class first."); return; }
        try {
            setHistoryLoading(true);
            const params = { className: selectedClass, from, to };
            if (histStudentId) params.studentId = histStudentId;
            const res = await api.get("/student-attendance/report", { params });
            setHistory(res.data.records || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load history.");
        } finally {
            setHistoryLoading(false);
        }
    };

    const filteredHistory = useMemo(
        () => (histStatus ? history.filter((h) => h.status === histStatus) : history),
        [history, histStatus]
    );

    const counts = useMemo(() => {
        const c = { present: 0, absent: 0, half_day: 0, leave: 0 };
        filteredHistory.forEach((h) => { if (c[h.status] !== undefined) c[h.status]++; });
        return c;
    }, [filteredHistory]);


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
                            <h2>Student Attendance</h2>
                            <p>Mark daily attendance for your class and search past records. Only your class-teacher classes appear here.</p>
                        </div>
                    </div>

                    {classesLoaded && classes.length === 0 ? (
                        <div className="settings-card">
                            <p style={{ color: "#b45309" }}>
                                You are not set as the class teacher of any class yet. Ask an admin to assign you
                                as Class Teacher on the Teacher Management page.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Class picker (shared by both tabs) */}
                            <div className="settings-card" style={{ paddingBottom: "14px" }}>
                                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                    <label style={{ fontWeight: 600 }}>Class</label>
                                    <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                                        {classes.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="exam-tabbar">
                                <button
                                    type="button"
                                    className={`exam-tab ${activeTab === "mark" ? "exam-tab-active" : ""}`}
                                    onClick={() => setActiveTab("mark")}
                                >
                                    Mark Attendance
                                </button>
                                <button
                                    type="button"
                                    className={`exam-tab ${activeTab === "history" ? "exam-tab-active" : ""}`}
                                    onClick={() => setActiveTab("history")}
                                >
                                    History
                                </button>
                            </div>

                            {/* ============================================
                                MARK ATTENDANCE
                            ============================================ */}
                            {activeTab === "mark" && (
                                <div className="settings-card exam-tabpanel">
                                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                        <label style={{ fontWeight: 600 }}>Date</label>
                                        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />

                                        {rows.length > 0 && (
                                            <div style={{ display: "flex", gap: "8px", marginLeft: "auto", flexWrap: "wrap" }}>
                                                <button type="button" onClick={() => markAll("present")}>All Present</button>
                                                <button type="button" onClick={() => markAll("absent")}>All Absent</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="table-container" style={{ marginTop: "18px" }}>
                                        <table className="compact-table">
                                            <thead>
                                                <tr>
                                                    <th>Roll No.</th>
                                                    <th>Student</th>
                                                    <th>Status</th>
                                                    <th>Remark</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr><td colSpan="4">Loading...</td></tr>
                                                ) : rows.length === 0 ? (
                                                    <tr><td colSpan="4" style={{ textAlign: "center" }}>No active students in this class.</td></tr>
                                                ) : (
                                                    rows.map((r) => (
                                                        <tr key={r.studentId}>
                                                            <td>{r.rollNumber || "-"}</td>
                                                            <td>{r.studentName}</td>
                                                            <td>
                                                                <select value={r.status} onChange={(e) => setField(r.studentId, "status", e.target.value)}>
                                                                    {STATUS_OPTIONS.map((o) => (
                                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={r.remark}
                                                                    placeholder="Optional"
                                                                    onChange={(e) => setField(r.studentId, "remark", e.target.value)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {rows.length > 0 && (
                                        <div style={{ marginTop: "18px" }}>
                                            <button type="button" className="primary-btn" onClick={save} disabled={saving}>
                                                {saving ? "Saving..." : "Save Attendance"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ============================================
                                HISTORY
                            ============================================ */}
                            {activeTab === "history" && (
                                <div className="settings-card exam-tabpanel">
                                    <div className="attendance-filters">
                                        <label>Student
                                            <select value={histStudentId} onChange={(e) => setHistStudentId(e.target.value)}>
                                                <option value="">All students</option>
                                                {studentOptions.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.roll ? `${s.roll} — ` : ""}{s.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>Status
                                            <select value={histStatus} onChange={(e) => setHistStatus(e.target.value)}>
                                                <option value="">All statuses</option>
                                                {STATUS_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>From
                                            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                                        </label>
                                        <label>To
                                            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                                        </label>
                                        <button type="button" className="primary-btn" onClick={loadHistory} disabled={historyLoading}>
                                            {historyLoading ? "Loading..." : "Search"}
                                        </button>
                                    </div>

                                    {history.length > 0 && (
                                        <div className="attendance-counts">
                                            <span className="att-badge att-present">Present {counts.present}</span>
                                            <span className="att-badge att-absent">Absent {counts.absent}</span>
                                            <span className="att-badge att-half">Half-day {counts.half_day}</span>
                                            <span className="att-badge att-leave">Leave {counts.leave}</span>
                                            <span className="att-count-total">Total {filteredHistory.length}</span>
                                        </div>
                                    )}

                                    <div className="table-container" style={{ marginTop: "18px" }}>
                                        <table className="compact-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Roll No.</th>
                                                    <th>Student</th>
                                                    <th>Status</th>
                                                    <th>Remark</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredHistory.length === 0 ? (
                                                    <tr><td colSpan="5" style={{ textAlign: "center" }}>No records. Set filters and click Search.</td></tr>
                                                ) : (
                                                    filteredHistory.map((h) => (
                                                        <tr key={h.id}>
                                                            <td>{h.attendanceDate}</td>
                                                            <td>{h.rollNumber || "-"}</td>
                                                            <td>{h.studentName}</td>
                                                            <td><span className={`att-badge ${STATUS_CLASS[h.status] || ""}`}>{STATUS_LABEL[h.status] || h.status}</span></td>
                                                            <td>{h.remark || "-"}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


export default StudentAttendancePage;
