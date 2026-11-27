/* Shared Holiday Calendar dropdown for Staff & Student Attendance pages.
   One declaration list, with scope: staff / students / both. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../services/notify";
import api from "../services/api";

const SCOPES = [
    { value: "both", label: "Staff & Students" },
    { value: "staff", label: "Staff only" },
    { value: "students", label: "Students only" }
];

function monthCursor(v) {
    const [y, m] = String(v || "2026-01-01").split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1);
}

function CalendarGrid({ value, marked = [], selected = [], onPick }) {
    const [cursor, setCursor] = useState(() => monthCursor(value));
    useEffect(() => { setCursor(monthCursor(value)); }, [value]);

    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const firstDay = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const dayCount = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells = [...Array(firstDay).fill(null), ...Array.from({ length: dayCount }, (_, i) => i + 1)];
    const iso = (d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const todayIso = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

    return (
        <div style={{ width: "min(280px, 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <button type="button" className="clear-btn" style={{ padding: "2px 8px" }} onClick={() => setCursor(new Date(y, m - 1, 1))}>‹</button>
                <strong style={{ fontSize: 13 }}>{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
                <button type="button" className="clear-btn" style={{ padding: "2px 8px" }} onClick={() => setCursor(new Date(y, m + 1, 1))}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "#b91c1c" : "#94A3B8" }}>{d}</span>
                ))}
                {cells.map((d, i) => {
                    if (!d) return <span key={`b${i}`} />;
                    const key = iso(d);
                    const isSunday = new Date(Date.UTC(y, m, d)).getUTCDay() === 0;
                    const isHoliday = isSunday || marked.includes(key);
                    const isSelected = selected.includes(key);
                    return (
                        <button key={key} type="button" onClick={() => onPick(key)} title={isHoliday ? `${key} — holiday` : key}
                            style={{
                                height: 32, width: "100%", minWidth: 0, padding: 0, borderRadius: 6, fontSize: 12, cursor: "pointer",
                                border: key === todayIso ? "2px solid #0f172a" : "1px solid transparent",
                                background: isSelected ? "#0f172a" : (isHoliday ? "#F1F5F9" : "transparent"),
                                color: isSelected ? "#fff" : (isHoliday ? "#64748B" : "#334155"),
                                fontWeight: isSelected || isHoliday ? 700 : 400
                            }}>
                            {d}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function HolidayCalendarDropdown({ isAdmin, onChanged }) {
    const [holidays, setHolidays] = useState([]);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [holidayDraftDate, setHolidayDraftDate] = useState(new Date().toISOString().slice(0, 10));
    const [holidayDates, setHolidayDates] = useState([]);
    const [holidayRange, setHolidayRange] = useState({ from: "", to: "" });
    const [holidayForm, setHolidayForm] = useState({ name: "", type: "occasional", scope: "both" });
    const [holidayBusy, setHolidayBusy] = useState(false);

    const loadHolidays = useCallback(async () => {
        try {
            const res = await api.get("/attendance/holidays");
            setHolidays(res.data.holidays || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load holidays.");
        }
    }, []);
    useEffect(() => { loadHolidays(); }, [loadHolidays]);

    const toggleHolidayDate = (key) => {
        setHolidayDates((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key].sort());
    };

    const previewDates = useMemo(() => {
        const set = new Set();
        const add = (d) => {
            if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) set.add(d); // Sundays are pre-coded
        };
        holidayDates.forEach(add);
        if (holidayRange.from && holidayRange.to && holidayRange.from <= holidayRange.to) {
            const start = new Date(`${holidayRange.from}T00:00:00Z`).getTime();
            const end = new Date(`${holidayRange.to}T00:00:00Z`).getTime();
            for (let i = 0; start + i * 86400000 <= end; i++) add(new Date(start + i * 86400000).toISOString().slice(0, 10));
        }
        return [...set].sort();
    }, [holidayDates, holidayRange]);

    const clear = () => {
        setHolidayForm({ name: "", type: "occasional", scope: "both" });
        setHolidayDates([]);
        setHolidayRange({ from: "", to: "" });
        setHolidayDraftDate(new Date().toISOString().slice(0, 10));
    };

    const addHolidays = async (e) => {
        e.preventDefault();
        if (!holidayForm.name.trim()) return toast("Enter a holiday name.");
        if (previewDates.length === 0) return toast("Select at least one non-Sunday date or range.");
        try {
            setHolidayBusy(true);
            const res = await api.post("/attendance/holidays/bulk", {
                name: holidayForm.name.trim(), type: holidayForm.type, scope: holidayForm.scope,
                dates: holidayDates, from: holidayRange.from || null, to: holidayRange.to || null
            });
            toast(res.data.message || "Holidays added.");
            clear();
            await loadHolidays();
            onChanged && onChanged();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to add holidays.");
        } finally {
            setHolidayBusy(false);
        }
    };

    const removeHoliday = async (h) => {
        try {
            const res = await api.delete(`/attendance/holidays/${h.id}`);
            toast(res.data.message || "Holiday removed.");
            await loadHolidays();
            onChanged && onChanged();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to remove holiday.");
        }
    };

    if (!isAdmin) return null;

    return (
        <div style={{ position: "relative", flexShrink: 0 }}>
            <button type="button" onClick={() => setCalendarOpen((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, cursor: "pointer" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>Holiday Calendar</span>
                <span className="att-badge att-holiday">{holidays.length} declared</span>
                <span style={{ color: "#64748B" }}>{calendarOpen ? "▴" : "▾"}</span>
            </button>
            {calendarOpen && (
                <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 30, marginTop: 8, width: "min(92vw, 960px)", maxHeight: "82vh", overflowY: "auto", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 16px 40px rgba(15,23,42,0.18)", padding: 8 }}>
                    <div className="settings-card" style={{ margin: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 17 }}>HOLIDAY CALENDAR</h3>
                                <p style={{ color: "#666", marginTop: 6, fontSize: 13, maxWidth: 760 }}>
                                    Sundays are holidays automatically. Pick dates and/or a range, then choose who it applies to.
                                </p>
                            </div>
                            <span className="att-badge att-holiday">{holidays.length} declared</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 20, marginTop: 18 }}>
                            <form onSubmit={addHolidays} style={{ borderRight: "1px solid #e2e8f0", paddingRight: 20 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Click dates to select</div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <CalendarGrid value={holidayDraftDate} selected={holidayDates} onPick={toggleHolidayDate} />
                                </div>
                                <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", margin: "8px 0 0" }}>
                                    Sundays are pre-coded — shaded and never declared.
                                </p>

                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "18px 0 8px" }}>Continuous range</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                    <label style={{ fontSize: 12 }}>From
                                        <input type="date" value={holidayRange.from} max={holidayRange.to || undefined} onChange={(e) => setHolidayRange({ ...holidayRange, from: e.target.value })} />
                                    </label>
                                    <label style={{ fontSize: 12 }}>To
                                        <input type="date" value={holidayRange.to} min={holidayRange.from || undefined} onChange={(e) => setHolidayRange({ ...holidayRange, to: e.target.value })} />
                                    </label>
                                </div>

                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "18px 0 8px" }}>Holiday details</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                    <label style={{ fontSize: 12 }}>Name
                                        <input type="text" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="e.g. Winter Break" required />
                                    </label>
                                    <label style={{ fontSize: 12 }}>Applies to
                                        <select value={holidayForm.scope} onChange={(e) => setHolidayForm({ ...holidayForm, scope: e.target.value })}>
                                            {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </label>
                                </div>

                                <div style={{ marginTop: 14, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                                        Preview — {previewDates.length} date{previewDates.length === 1 ? "" : "s"}
                                    </div>
                                    {previewDates.length === 0 ? (
                                        <span style={{ fontSize: 12, color: "#94A3B8" }}>Nothing selected yet.</span>
                                    ) : (
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {previewDates.slice(0, 12).map((d) => (
                                                <button key={d} type="button" title={holidayDates.includes(d) ? "Remove date" : "Part of the range"}
                                                    className="att-badge att-holiday"
                                                    onClick={() => holidayDates.includes(d) && setHolidayDates((prev) => prev.filter((x) => x !== d))}
                                                    style={{ cursor: holidayDates.includes(d) ? "pointer" : "default" }}>
                                                    {d}{holidayDates.includes(d) ? " ✕" : ""}
                                                </button>
                                            ))}
                                            {previewDates.length > 12 && <span className="att-badge att-holiday">+{previewDates.length - 12} more</span>}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                                    <button type="submit" className="primary-btn" disabled={holidayBusy || previewDates.length === 0}>
                                        {holidayBusy ? "Saving..." : "Add Holidays"}
                                    </button>
                                    <button type="button" className="clear-btn" onClick={clear}>Clear</button>
                                </div>
                            </form>

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Declared holidays</div>
                                <div className="table-container">
                                    <table className="compact-table stack-sm">
                                        <thead><tr><th>Date</th><th>Name</th><th>Applies to</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {holidays.length === 0 ? (
                                                <tr><td colSpan="4" style={{ textAlign: "center" }}>No occasional holidays added.</td></tr>
                                            ) : holidays.map((h) => (
                                                <tr key={h.id}>
                                                    <td data-label="Date">{h.holidayDate}</td>
                                                    <td data-label="Name">{h.name}</td>
                                                    <td data-label="Applies to"><span className="att-badge att-holiday">{SCOPES.find((s) => s.value === h.scope)?.label || h.scope || "Both"}</span></td>
                                                    <td data-label="Actions"><button type="button" className="delete-btn" onClick={() => removeHoliday(h)}>Remove</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
