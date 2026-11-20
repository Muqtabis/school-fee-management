/* MOBILE Attendance — big 4-button status picker per person, bottom sheet free.
   Used for both staff (mode="staff") and student (mode="student") attendance. */
import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileSegmented, MobileRow, MobileList, MobileCard } from "../../components/mobile/MobileUI";

const STATUSES = [
    { v: "present", l: "Present", c: "#2f6b4f" },
    { v: "absent", l: "Absent", c: "#a33a3a" },
    { v: "half_day", l: "Half-day", c: "#98651f" },
    { v: "leave", l: "Leave", c: "#496b86" }
];
const today = () => new Date().toISOString().slice(0, 10);

export default function AttendancePageMobile({ mode = "student" }) {
    const isStaff = mode === "staff";
    const base = isStaff ? "/attendance" : "/student-attendance";
    const [tab, setTab] = useState("mark");
    const [date, setDate] = useState(today());
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [rows, setRows] = useState([]);
    const [locked, setLocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (isStaff) {
                const r = await api.get(base, { params: { date } });
                setRows((r.data.records || []).map((x) => ({
                    id: x.teacherId, name: x.name || x.teacherName, status: x.status || "", remark: x.remark || ""
                })));
                setLocked(Boolean(r.data.locked));
            } else {
                const r = await api.get(base, { params: { date, className: selectedClass } });
                setRows((r.data.records || r.data.students || []).map((x) => ({
                    id: x.studentId, name: x.studentName, sub: x.rollNumber ? `Roll ${x.rollNumber}` : "", status: x.status || "", remark: x.remark || ""
                })));
                setLocked(Boolean(r.data.locked));
            }
        } catch (e) { toast(e.response?.data?.message || "Unable to load attendance."); }
        finally { setLoading(false); }
    }, [base, date, isStaff, selectedClass]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (isStaff) return;
        api.get("/student-attendance/my-classes").then((r) => {
            const list = (r.data.classes || []).filter(Boolean);
            setClasses(list);
            if (list.length && !selectedClass) setSelectedClass(list[0]);
        }).catch(() => {});
    }, [isStaff, selectedClass]);

    const setStatus = (id, status) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    const save = async () => {
        const marked = rows.filter((r) => r.status);
        if (!marked.length) return toast("Mark at least one person first.");
        setSaving(true);
        try {
            const payload = marked.map((r) => isStaff
                ? { teacherId: r.id, status: r.status, remark: r.remark }
                : { studentId: r.id, status: r.status, remark: r.remark });
            const r = await api.put(base, isStaff ? { date, records: payload } : { date, className: selectedClass, records: payload });
            toast(r.data?.message || "Attendance saved.");
            load();
        } catch (e) { toast(e.response?.data?.message || "Unable to save attendance."); }
        finally { setSaving(false); }
    };

    const loadHistory = async () => {
        try {
            const r = await api.get(`${base}/report`, { params: { from: date, to: date } });
            setHistory(r.data.records || []);
        } catch (e) { toast(e.response?.data?.message || "Unable to load history."); }
    };
    useEffect(() => { if (tab === "history") loadHistory(); }, [tab, date]);

    const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});

    return (
        <div>
            <h2>{isStaff ? "Staff Attendance" : "Student Attendance"}</h2>
            <MobileSegmented
                value={tab}
                onChange={setTab}
                options={[{ value: "mark", label: "Mark" }, { value: "history", label: "History" }]}
            />

            {tab === "mark" ? (
                <>
                    <div className="m-stats" style={{ marginBottom: 12 }}>
                        {STATUSES.map((s) => <MobileCard key={s.v} title={s.l} value={counts[s.v] || 0} tone={s.v === "absent" ? "danger" : s.v === "present" ? "good" : ""} />)}
                    </div>
                    <label className="m-search" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
                        <span style={{ fontSize: 12, color: "#607080" }}>Date</span>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, minHeight: 40, border: 0, background: "transparent", fontSize: 16 }} />
                    </label>
                    {!isStaff && (
                        <div className="m-chips">
                            {classes.map((c) => (
                                <button type="button" key={c} className={"m-chip" + (selectedClass === c ? " m-chip-active" : "")} onClick={() => setSelectedClass(c)}>{c}</button>
                            ))}
                        </div>
                    )}
                    {locked && <p className="m-page-lead">🔒 This date is locked — contact an admin to change it.</p>}
                    {loading ? <div className="m-empty">Loading…</div> : (
                        <MobileList empty="No people to mark.">
                            {rows.map((r) => (
                                <div key={r.id} className="m-card" style={{ padding: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                                        <div className="m-row-main">
                                            <strong>{r.name || "—"}</strong>
                                            {r.sub && <small>{r.sub}</small>}
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                                        {STATUSES.map((s) => (
                                            <button
                                                type="button"
                                                key={s.v}
                                                disabled={locked}
                                                onClick={() => setStatus(r.id, s.v)}
                                                style={{
                                                    minHeight: 44,
                                                    border: "1px solid " + (r.status === s.v ? s.c : "#d9e0e6"),
                                                    borderRadius: 10,
                                                    background: r.status === s.v ? s.c : "var(--surface, #fff)",
                                                    color: r.status === s.v ? "#fff" : "var(--text, #263238)",
                                                    fontSize: 12, fontWeight: 700
                                                }}
                                            >
                                                {s.l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </MobileList>
                    )}
                    <div className="m-sheet-actions" style={{ position: "sticky", bottom: 0, padding: "10px 0", background: "var(--background, #f5f7f9)" }}>
                        <button type="button" className="m-btn m-btn-primary" disabled={saving || locked} onClick={save}>{saving ? "Saving…" : "Save attendance"}</button>
                    </div>
                </>
            ) : (
                <MobileList empty="No records for this date.">
                    {history.map((h, idx) => (
                        <MobileRow key={idx} label={h.name || h.studentName || h.teacherName || "—"} sub={h.attendanceDate || date} value={h.status || "—"} />
                    ))}
                </MobileList>
            )}
        </div>
    );
}
