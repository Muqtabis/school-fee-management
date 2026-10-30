import { toast } from "../services/notify";
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


function TeacherAttendancePage() {

    const [activeTab, setActiveTab] = useState("mark");

    const [date, setDate] = useState(today());
    const [rows, setRows] = useState([]);   // [{ teacherId, name, email, status, remark }]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());
    const [histTeacherId, setHistTeacherId] = useState("");   // "" = all
    const [histStatus, setHistStatus] = useState("");         // "" = all statuses
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);


    const loadDate = useCallback(async (forDate) => {
        try {
            setLoading(true);
            const res = await api.get("/attendance", { params: { date: forDate } });
            const seeded = (res.data.records || []).map((r) => ({
                ...r,
                status: r.status || "present",
                remark: r.remark || ""
            }));
            setRows(seeded);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load attendance.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDate(date);
    }, [date, loadDate]);

    const teacherOptions = useMemo(
        () => rows.map((r) => ({ id: r.teacherId, name: r.name })),
        [rows]
    );


    const setField = (teacherId, field, value) => {
        setRows((prev) =>
            prev.map((r) => (r.teacherId === teacherId ? { ...r, [field]: value } : r))
        );
    };

    const save = async () => {
        try {
            setSaving(true);
            const records = rows.map((r) => ({
                teacherId: r.teacherId,
                status: r.status,
                remark: r.remark
            }));
            const res = await api.put("/attendance", { date, records });
            toast(res.data.message || "Attendance saved.");
        } catch (error) {
            toast(error.response?.data?.message || "Unable to save attendance.");
        } finally {
            setSaving(false);
        }
    };


    const loadHistory = async () => {
        try {
            setHistoryLoading(true);
            const params = { from, to };
            if (histTeacherId) params.teacherId = histTeacherId;
            const res = await api.get("/attendance/report", { params });
            setHistory(res.data.records || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load history.");
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


    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Staff Attendance</h2>
                            <p>Mark daily attendance for all staff — teachers, accountant, manager and every other user — and search past records.</p>
                        </div>
                    </div>

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

                    {activeTab === "mark" && (
                        <div className="settings-card exam-tabpanel">
                            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                <label style={{ fontWeight: 600 }}>Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    max={today()}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>

                            <div className="table-container" style={{ marginTop: "18px" }}>
                                <table className="compact-table stack-sm">
                                    <thead>
                                        <tr>
                                            <th>Staff</th>
                                            <th>Email</th>
                                            <th>Status</th>
                                            <th>Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="4">Loading...</td></tr>
                                        ) : rows.length === 0 ? (
                                            <tr>
                                                <td colSpan="4">
                                                    No staff found. Create user accounts from the Users page first.
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map((r) => (
                                                <tr key={r.teacherId}>
                                                    <td data-label="Staff">{r.name}</td>
                                                    <td data-label="Email">{r.email}</td>
                                                    <td data-label="Status">
                                                        <select
                                                            value={r.status}
                                                            onChange={(e) => setField(r.teacherId, "status", e.target.value)}
                                                        >
                                                            {STATUS_OPTIONS.map((o) => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                                ))}
                                                        </select>
                                                    </td>
                                                    <td data-label="Remark">
                                                        <input
                                                            type="text"
                                                            value={r.remark}
                                                            placeholder="Optional"
                                                            onChange={(e) => setField(r.teacherId, "remark", e.target.value)}
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
                                    <button
                                        type="button"
                                        className="primary-btn"
                                        onClick={save}
                                        disabled={saving}
                                    >
                                        {saving ? "Saving..." : "Save Attendance"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "history" && (
                        <div className="settings-card exam-tabpanel">
                            <div className="attendance-filters">
                                <label>Staff
                                    <select value={histTeacherId} onChange={(e) => setHistTeacherId(e.target.value)}>
                                        <option value="">All staff</option>
                                        {teacherOptions.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
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
                                <table className="compact-table stack-sm">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Staff</th>
                                            <th>Status</th>
                                            <th>Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: "center" }}>No records. Set filters and click Search.</td></tr>
                                        ) : (
                                            filteredHistory.map((h) => (
                                                <tr key={h.id}>
                                                    <td data-label="Date">{h.attendanceDate}</td>
                                                    <td data-label="Staff">{h.teacherName}</td>
                                                    <td data-label="Status"><span className={`att-badge ${STATUS_CLASS[h.status] || ""}`}>{STATUS_LABEL[h.status] || h.status}</span></td>
                                                    <td data-label="Remark">{h.remark || "-"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}


export default TeacherAttendancePage;
