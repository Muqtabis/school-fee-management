import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


// =====================================================
// ATTENDANCE OVERVIEW  (admin class-wise summary)
//
// Class -> date range -> per-student present/absent/% .
// Read-only admin view over any class, unrestricted by
// class-teacher assignments (spec item 14). Reuses the
// existing admin report endpoint /student-attendance/report
// (admin bypasses the class-teacher ownership check) and
// aggregates the raw day rows on the client.
// =====================================================

function today() {
    return new Date().toISOString().slice(0, 10);
}
function monthStart() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Present counts as a full day, half-day as a half. Absent and
// leave do not count toward the attended fraction.
function attendedFraction(row) {
    return row.present + row.half_day * 0.5;
}
function pct(row) {
    if (!row.total) return "-";
    return `${Math.round((attendedFraction(row) / row.total) * 1000) / 10}%`;
}


function AttendanceOverviewPage() {

    const [classes, setClasses] = useState([]);
    const [className, setClassName] = useState("");
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());

    const [records, setRecords] = useState(null); // raw day rows, or null before first load
    const [loading, setLoading] = useState(false);


    // =====================================================
    // LOAD CLASS LIST
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/classes");
                const names = [...new Set((res.data || []).map((c) => c.className))].sort();
                setClasses(names);
            } catch (error) {
                alert(error.response?.data?.message || "Unable to load classes.");
            }
        })();
    }, []);


    // =====================================================
    // LOAD THE REPORT
    // =====================================================

    const load = async () => {
        if (!className) { alert("Choose a class first."); return; }
        setLoading(true);
        setRecords(null);
        try {
            const res = await api.get("/student-attendance/report", {
                params: { className, from, to }
            });
            setRecords(res.data.records || []);
        } catch (error) {
            alert(error.response?.data?.message || "Unable to load attendance.");
        } finally {
            setLoading(false);
        }
    };


    // =====================================================
    // AGGREGATE RAW DAY ROWS -> PER-STUDENT SUMMARY
    // =====================================================

    const summary = useMemo(() => {
        if (!records) return [];
        const byStudent = new Map();
        for (const r of records) {
            let s = byStudent.get(r.studentId);
            if (!s) {
                s = {
                    studentId: r.studentId,
                    studentName: r.studentName,
                    rollNumber: r.rollNumber,
                    present: 0, absent: 0, half_day: 0, leave: 0, total: 0
                };
                byStudent.set(r.studentId, s);
            }
            if (s[r.status] !== undefined) s[r.status] += 1;
            s.total += 1;
        }
        return [...byStudent.values()].sort(
            (a, b) => String(a.rollNumber || "").localeCompare(String(b.rollNumber || ""), undefined, { numeric: true })
        );
    }, [records]);

    // Class-level average of the per-student attendance percentages.
    const classAverage = useMemo(() => {
        const withDays = summary.filter((s) => s.total > 0);
        if (!withDays.length) return "-";
        const avg = withDays.reduce((acc, s) => acc + attendedFraction(s) / s.total, 0) / withDays.length;
        return `${Math.round(avg * 1000) / 10}%`;
    }, [summary]);


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
                            <h2>Attendance Overview</h2>
                            <p>Summarise any class's attendance over a date range. Admin-only, read-only.</p>
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="settings-card">
                        <div className="overview-filters">
                            <select value={className} onChange={(e) => setClassName(e.target.value)}>
                                <option value="">Select class</option>
                                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <label>From</label>
                            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                            <label>To</label>
                            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />

                            <button type="button" className="primary-btn" onClick={load} disabled={loading}>
                                {loading ? "Loading..." : "Load"}
                            </button>
                        </div>
                    </div>

                    {/* SUMMARY */}
                    {records === null ? (
                        <p style={{ marginTop: "20px", color: "#666" }}>
                            Choose a class and date range, then press Load.
                        </p>
                    ) : summary.length === 0 ? (
                        <p style={{ marginTop: "20px", color: "#666" }}>
                            No attendance records in this range.
                        </p>
                    ) : (
                        <>
                            <div className="overview-stats">
                                <div className="stat-pill"><span>Students</span><strong>{summary.length}</strong></div>
                                <div className="stat-pill"><span>Class Average</span><strong>{classAverage}</strong></div>
                                <div className="stat-pill"><span>From</span><strong>{from}</strong></div>
                                <div className="stat-pill"><span>To</span><strong>{to}</strong></div>
                            </div>

                            <div className="table-container" style={{ marginTop: "16px" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Roll</th>
                                            <th>Student</th>
                                            <th>Present</th>
                                            <th>Absent</th>
                                            <th>Half-day</th>
                                            <th>Leave</th>
                                            <th>Days</th>
                                            <th>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.map((s) => (
                                            <tr key={s.studentId}>
                                                <td>{s.rollNumber || "-"}</td>
                                                <td>{s.studentName}</td>
                                                <td>{s.present}</td>
                                                <td>{s.absent}</td>
                                                <td>{s.half_day}</td>
                                                <td>{s.leave}</td>
                                                <td>{s.total}</td>
                                                <td>{pct(s)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


export default AttendanceOverviewPage;
