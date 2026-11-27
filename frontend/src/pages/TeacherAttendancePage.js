import { toast } from "../services/notify";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";
import HolidayCalendarDropdown from "../components/HolidayCalendarDropdown";


const STATUS_OPTIONS = [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "half_day", label: "Half-day" },
    { value: "leave", label: "Leave" },
    { value: "holiday", label: "Holiday" }
];

// Marking dropdown includes a blank "not marked yet" default. Anyone
// taking attendance picks Present / Absent / Half-day / Leave explicitly.
const MARK_OPTIONS = [{ value: "", label: "— Select —" }, ...STATUS_OPTIONS];

const STATUS_LABEL = STATUS_OPTIONS.reduce((acc, o) => {
    acc[o.value] = o.label;
    return acc;
}, {});

const STATUS_CLASS = {
    present: "att-present",
    absent: "att-absent",
    half_day: "att-half",
    leave: "att-leave",
    holiday: "att-holiday"
};

// Calendar day colours mirror the history status badges.
const DAY_COLORS = {
    present: { background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC" },
    absent: { background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5" },
    half_day: { background: "#FEF9C3", color: "#A16207", border: "1px solid #FDE047" },
    leave: { background: "#E0E7FF", color: "#4338CA", border: "1px solid #C7D2FE" },
    holiday: { background: "#F1F5F9", color: "#475569", border: "1px solid #CBD5E1" }
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
    // Only admin may correct attendance for a past date from History.
    const isAdmin = user?.role === "admin";

    const [activeTab, setActiveTab] = useState("mark");
    const [roleFilter, setRoleFilter] = useState("All");

    const [date, setDate] = useState(today());
    const [rows, setRows] = useState([]);   // [{ teacherId, name, email, role, status, remark, isLocked }]
    const [dateLocked, setDateLocked] = useState(false);
    const [dateHoliday, setDateHoliday] = useState(null);
    const [lockBusy, setLockBusy] = useState(false);
    const [holidayBusy, setHolidayBusy] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

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
    const [summary, setSummary] = useState([]);
    const [summaryLoading, setSummaryLoading] = useState(false);


    const loadDate = useCallback(async (forDate) => {
        try {
            setLoading(true);
            const res = await api.get("/attendance", { params: { date: forDate } });
            const seeded = (res.data.records || []).map((r) => ({
                ...r,
                status: r.status || "",
                remark: r.remark || ""
            }));
            setRows(seeded);
            setDateLocked(Boolean(res.data.locked));
            setDateHoliday(res.data.holiday || null);
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


    const markHolidayForDate = async () => {
        try {
            setHolidayBusy(true);
            const res = await api.post("/attendance/holiday", { date });
            toast(res.data.message || "Date marked as holiday.");
            await loadDate(date);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to mark holiday.");
        } finally {
            setHolidayBusy(false);
        }
    };

    const loadHistory = async () => {
        try {
            setHistoryLoading(true);
            setSummaryLoading(true);
            const params = { from, to };
            if (histTeacherId) params.teacherId = histTeacherId;
            const [report, stats] = await Promise.all([
                api.get("/attendance/report", { params }),
                api.get("/attendance/summary", { params: { from, to } })
            ]);
            setHistory(report.data.records || []);
            setSummary(stats.data.summary || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load history.");
        } finally {
            setHistoryLoading(false);
            setSummaryLoading(false);
        }
    };

    // Load the default range as soon as History is opened.
    useEffect(() => {
        if (activeTab === "history" && history.length === 0 && !historyLoading) loadHistory();
    }, [activeTab]);

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

    // Same per-staff summary shown on the Teacher Management page.
    const visibleSummary = useMemo(() => {
        let list = summary;
        if (histTeacherId) list = list.filter((s) => s.teacherId === Number(histTeacherId));
        if (histRoleFilter === "Teachers") list = list.filter((s) => s.role === "teacher" || s.role === "supporting_teacher");
        if (histRoleFilter === "Staff") list = list.filter((s) => ["accountant", "principal", "manager", "supporting_staff"].includes(s.role));
        return list;
    }, [summary, histTeacherId, histRoleFilter]);

    // Admin can correct a past date directly from a history row.
    const editHistoryDate = (attendanceDate) => {
        setDate(attendanceDate);
        setActiveTab("mark");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };


    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header" style={{ alignItems: "flex-start" }}>
                        <div>
                            <h2>Staff Attendance</h2>
                            <p style={{ maxWidth: 680 }}>Mark daily attendance for all staff — teachers, accountant, manager and every other user — and search past records.</p>
                        </div>
                        <HolidayCalendarDropdown isAdmin={isAdmin} onChanged={() => loadDate(date)} />
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

                            {dateHoliday?.isHoliday && (
                                <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569" }}>
                                    <strong>Holiday — {dateHoliday.name}</strong> ({dateHoliday.type === "weekly" ? "weekly" : "occasional"}). Attendance is not required for this date.
                                </div>
                            )}

                            {isAdmin && !dateHoliday?.isHoliday && !dateLocked && (
                                <div style={{ marginTop: "12px" }}>
                                    <button type="button" className="cancel-btn" onClick={markHolidayForDate} disabled={holidayBusy}>
                                        {holidayBusy ? "Please wait..." : "Mark as Holiday"}
                                    </button>
                                </div>
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
                                                            disabled={dateLocked || dateHoliday?.isHoliday}
                                                            onChange={(e) => setField(r.teacherId, "status", e.target.value)}
                                                        >
                                                            {MARK_OPTIONS.map((o) => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td data-label="Remark">
                                                        <input
                                                            type="text"
                                                            value={r.remark}
                                                            placeholder="Optional"
                                                            disabled={dateLocked || dateHoliday?.isHoliday}
                                                            onChange={(e) => setField(r.teacherId, "remark", e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredRows.length > 0 && !dateHoliday?.isHoliday && (
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

                            {(history.length > 0 || summary.length > 0) && (
                                <div className="settings-card" style={{ marginTop: "15px" }}>
                                    <h4 style={{ margin: "0 0 6px 0", color: "#475569" }}>Staff Attendance Summary</h4>
                                    <p style={{ color: "#666", marginTop: 0, fontSize: "13px" }}>
                                        Days present, absent, half-day and on leave for each staff member in the selected range.
                                    </p>
                                    <div className="table-container" style={{ marginTop: "14px" }}>
                                        <table className="attendance-summary-table stack-sm">
                                            <thead>
                                                <tr>
                                                    <th>Teacher</th>
                                                    <th>Email</th>
                                                    <th>Present</th>
                                                    <th>Absent</th>
                                                    <th>Half-day</th>
                                                    <th>Leave</th>
                                                    <th>Holidays</th>
                                                    <th>Days Marked</th>
                                                    <th>Present %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {summaryLoading ? (
                                                    <tr><td colSpan="9" style={{ textAlign: "center" }}>Loading...</td></tr>
                                                ) : visibleSummary.length === 0 ? (
                                                    <tr><td colSpan="9" style={{ textAlign: "center" }}>No staff found.</td></tr>
                                                ) : visibleSummary.map((s) => {
                                                    const present = Number(s.present) || 0;
                                                    const half = Number(s.half_day) || 0;
                                                    const marked = Number(s.markedDays) || 0;
                                                    const pct = marked > 0 ? Math.round(((present + half * 0.5) / marked) * 100) : null;
                                                    return (
                                                        <tr key={s.teacherId}>
                                                            <td data-label="Teacher">{s.name}</td>
                                                            <td data-label="Email">{s.email}</td>
                                                            <td data-label="Present"><span className="att-badge att-present">{present}</span></td>
                                                            <td data-label="Absent"><span className="att-badge att-absent">{Number(s.absent) || 0}</span></td>
                                                            <td data-label="Half-day"><span className="att-badge att-half">{half}</span></td>
                                                            <td data-label="Leave"><span className="att-badge att-leave">{Number(s.leave) || 0}</span></td>
                                                            <td data-label="Holidays"><span className="att-badge att-holiday">{Number(s.holiday) || 0}</span></td>
                                                            <td data-label="Days Marked">{marked}</td>
                                                            <td data-label="Present %">{pct === null ? <span style={{ color: "#888" }}>—</span> : `${pct}%`}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
                                            {isAdmin && <th>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.length === 0 ? (
                                            <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center" }}>No records. Set filters and click Search.</td></tr>
                                        ) : (
                                            filteredHistory.map((h) => (
                                                <tr key={h.id}>
                                                    <td data-label="Date">
                                                        <span className="att-badge" style={DAY_COLORS[h.status] || undefined}>{h.attendanceDate}</span>
                                                    </td>
                                                    <td data-label="Staff">{h.teacherName}</td>
                                                    <td data-label="Status"><span className={`att-badge ${STATUS_CLASS[h.status] || ""}`}>{STATUS_LABEL[h.status] || h.status}</span></td>
                                                    <td data-label="Remark">{h.remark || "-"}</td>
                                                    {isAdmin && (
                                                        <td data-label="Actions">
                                                            <button type="button" className="edit-btn" onClick={() => editHistoryDate(h.attendanceDate)}>
                                                                Edit Attendance
                                                            </button>
                                                        </td>
                                                    )}
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
