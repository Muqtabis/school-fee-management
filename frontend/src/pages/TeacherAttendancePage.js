import { toast } from "../services/notify";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

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
    const { user } = useAuth();
    const isHistoryAllowed = user?.role === "admin" || user?.role === "principal";
    // Only admin and principal may lock/unlock a day's attendance.
    const canManageLock = user?.role === "admin" || user?.role === "principal";

    const [activeTab, setActiveTab] = useState("mark");
    const [roleFilter, setRoleFilter] = useState("All");

    const [date, setDate] = useState(today());
    const [rows, setRows] = useState([]);   // [{ teacherId, name, email, role, status, remark, isLocked }]
    const [dateLocked, setDateLocked] = useState(false);
    const [lockBusy, setLockBusy] = useState(false);

    // Filter logic for roles
    const filteredRows = useMemo(() => {
        if (roleFilter === "All") return rows;
        if (roleFilter === "Teachers") return rows.filter(r => r.role === "teacher" || r.role === "supporting_teacher");
        if (roleFilter === "Staff") return rows.filter(r => ["accountant", "principal", "manager", "supporting_staff"].includes(r.role));
        return rows;
    }, [rows, roleFilter]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());
    const [histTeacherId, setHistTeacherId] = useState("");   // "" = all
    const [histRoleFilter, setHistRoleFilter] = useState("All"); // Added for history role filtering
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
            setDateLocked(Boolean(res.data.locked));
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
            await loadDate(date);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to save attendance.");
        } finally {
            setSaving(false);
        }
    };

    // Lock (or unlock) the selected date — same pattern as the page-access lock.
    const toggleLock = async (locked) => {
        try {
            setLockBusy(true);
            const res = await api.post(locked ? "/attendance/lock" : "/attendance/unlock", { date });
            await loadDate(date);
            toast(res.data.message || (locked ? "Attendance locked." : "Attendance unlocked."));
        } catch (error) {
            toast(error.response?.data?.message || "Unable to change the attendance lock.");
        } finally {
            setLockBusy(false);
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

    const filteredHistory = useMemo(() => {
        let filtered = history;
        if (histStatus) {
            filtered = filtered.filter((h) => h.status === histStatus);
        }
        if (histRoleFilter !== "All") {
            filtered = filtered.filter(h => {
                const role = h.role;
                if (histRoleFilter === "Teachers") return role === "teacher" || role === "supporting_teacher";
                if (histRoleFilter === "Staff") return ["accountant", "principal", "manager", "supporting_staff"].includes(role);
                return true;
            });
        }
        return filtered;
    }, [history, histStatus, histRoleFilter]);

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
                        {isHistoryAllowed && (
                            <button
                                type="button"
                                className={`exam-tab ${activeTab === "history" ? "exam-tab-active" : ""}`}
                                onClick={() => setActiveTab("history")}
                            >
                                History
                            </button>
                        )}
                    </div>

                    {activeTab === "mark" && (
                        <div className="settings-card exam-tabpanel">
                            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <label style={{ fontWeight: 600 }}>Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        max={today()}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    {["All", "Teachers", "Staff"].map((f) => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setRoleFilter(f)}
                                            style={{
                                                padding: "6px 12px",
                                                fontSize: "12px",
                                                borderRadius: "6px",
                                                cursor: "pointer",
                                                border: "1px solid #cbd5e1",
                                                backgroundColor: roleFilter === f ? "#0f172a" : "#f8fafc",
                                                color: roleFilter === f ? "#ffffff" : "#475569",
                                                fontWeight: roleFilter === f ? "bold" : "normal"
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {dateLocked && (
                                <p style={{ color: "#b45309", marginTop: "12px" }}>
                                    🔒 Attendance for {date} is locked.
                                    {canManageLock
                                        ? " Unlock to make changes."
                                        : " Only an admin or the principal can unlock it."}
                                </p>
                            )}

                            <div className="table-container" style={{ marginTop: "18px" }}>
                                <table className="compact-table stack-sm">
                                    <thead>
                                        <tr>
                                            <th>Staff</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5">Loading...</td></tr>
                                        ) : filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: "center" }}>
                                                    No staff found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map((r) => (
                                                <tr key={r.teacherId}>
                                                    <td data-label="Staff">{r.name}</td>
                                                    <td data-label="Email">{r.email}</td>
                                                    <td data-label="Role"><span style={{ fontSize: "11px", padding: "2px 6px", background: "#f1f5f9", borderRadius: "4px" }}>{r.role}</span></td>
                                                    <td data-label="Status">
                                                        <select
                                                            value={r.status}
                                                            disabled={dateLocked}
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
                                                            disabled={dateLocked}
                                                            onChange={(e) => setField(r.teacherId, "remark", e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredRows.length > 0 && (
                                <div style={{ marginTop: "18px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                    <button
                                        type="button"
                                        className="primary-btn"
                                        onClick={save}
                                        disabled={saving || dateLocked}
                                    >
                                        {saving ? "Saving..." : "Save Attendance"}
                                    </button>
                                    {!dateLocked && (
                                        <button
                                            type="button"
                                            onClick={() => toggleLock(true)}
                                            disabled={lockBusy || saving}
                                        >
                                            {lockBusy ? "Please wait..." : "Lock"}
                                        </button>
                                    )}
                                    {dateLocked && canManageLock && (
                                        <button
                                            type="button"
                                            onClick={() => toggleLock(false)}
                                            disabled={lockBusy || saving}
                                        >
                                            {lockBusy ? "Please wait..." : "Unlock"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "history" && (
                        <div className="settings-card exam-tabpanel">
                            <div className="attendance-filters">
                                <label>Staff Role
                                    <select value={histRoleFilter} onChange={(e) => setHistRoleFilter(e.target.value)}>
                                        <option value="All">All roles</option>
                                        <option value="Teachers">Teachers</option>
                                        <option value="Staff">Staff</option>
                                    </select>
                                </label>
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
                                <div className="attendance-counts" style={{ marginTop: "15px", display: "flex", flexWrap: "wrap", gap: "15px", padding: "15px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ flex: 1, minWidth: "150px" }}>
                                        <h4 style={{ margin: "0 0 10px 0", color: "#475569" }}>Attendance Summary ({histTeacherId ? teacherOptions.find(t => t.id == histTeacherId)?.name : "All Staff"})</h4>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                            <div className="att-badge att-present">Present: {counts.present}</div>
                                            <div className="att-badge att-absent">Absent: {counts.absent}</div>
                                            <div className="att-badge att-half">Half-day: {counts.half_day}</div>
                                            <div className="att-badge att-leave">Leave: {counts.leave}</div>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: "200px", borderLeft: "1px solid #cbd5e1", paddingLeft: "15px" }}>
                                        <h4 style={{ margin: "0 0 10px 0", color: "#475569" }}>Payroll Calc</h4>
                                        <p style={{ margin: "2px 0", fontSize: "14px" }}>Total Days: {filteredHistory.length}</p>
                                        <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: "bold" }}>
                                            Effective Paid Days: {counts.present + (counts.half_day * 0.5)}
                                        </p>
                                        <small style={{ color: "#64748b" }}>* Present + 0.5 per half-day</small>
                                    </div>
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
