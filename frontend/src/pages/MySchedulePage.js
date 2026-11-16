import { toast } from "../services/notify";
import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";

// =====================================================
// MY SCHEDULE
// Every staff member's own weekly timetable (from the class
// timetable admin sets in the Timetable page), plus the full
// read-only grids of the classes where this user is the
// CLASS TEACHER. Server side the data is always scoped to
// the logged-in user's own id.
// =====================================================

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday"
};

// JS getDay(): Sun=0 .. Sat=6 → our day keys (Sun has no school slot).
const todayKey = () => {
    const dow = new Date().getDay();
    return dow === 0 ? null : DAYS[dow - 1];
};

const minutesOf = (hhmm) => {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};

function MySchedulePage() {
    const [slots, setSlots] = useState([]);
    const [myClasses, setMyClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedClass, setSelectedClass] = useState("");
    const [classGrid, setClassGrid] = useState(null);   // { className, days, rows }
    const [gridLoading, setGridLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [scheduleRes, classesRes] = await Promise.all([
                    api.get("/timetable/my/schedule"),
                    api.get("/timetable/my/classes")
                ]);
                setSlots(scheduleRes.data.slots || []);
                setMyClasses(classesRes.data.classes || []);
            } catch (error) {
                toast(error.response?.data?.message || "Unable to load your schedule.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const openClassTimetable = async (className) => {
        setSelectedClass(className);
        setGridLoading(true);
        try {
            const res = await api.get(`/timetable/${encodeURIComponent(className)}`);
            setClassGrid(res.data);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load this class timetable.");
            setClassGrid(null);
        } finally {
            setGridLoading(false);
        }
    };

    // ---- today's slots with a Now / Next marker ----
    const tk = todayKey();
    const todaySlots = slots
        .filter((s) => s.dayOfWeek === tk)
        .slice()
        .sort((a, b) => String(a.startTime || "99:99").localeCompare(String(b.startTime || "99:99")));

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let nextMarked = false;
    const slotTag = (s) => {
        const start = minutesOf(s.startTime);
        const end = minutesOf(s.endTime);
        if (start != null && end != null && nowMinutes >= start && nowMinutes < end) return "Now";
        if (start != null && nowMinutes < start && !nextMarked) {
            nextMarked = true;
            return "Next";
        }
        return "";
    };

    const timeText = (s) =>
        s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime || "time not set";

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>My Schedule</h2>
                            <p>Your weekly class timings{tk ? ` — today is ${DAY_FULL[tk]}` : " (Sunday: no school slots)"}.</p>
                        </div>
                    </div>

                    {/* TODAY */}
                    <div className="page-header" style={{ marginTop: "10px" }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Today{tk ? ` (${DAY_FULL[tk]})` : ""}</h3>
                        </div>
                    </div>
                    <div className="table-container" style={{ marginBottom: "26px" }}>
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Period</th>
                                    <th>Class</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5">Loading...</td></tr>
                                ) : !tk || todaySlots.length === 0 ? (
                                    <tr><td colSpan="5">No classes scheduled for today.</td></tr>
                                ) : (
                                    todaySlots.map((s, i) => {
                                        const tag = slotTag(s);
                                        return (
                                            <tr key={`${s.dayOfWeek}-${s.periodNumber}-${i}`}>
                                                <td data-label="Time"><strong>{timeText(s)}</strong></td>
                                                <td data-label="Period">{s.periodNumber}</td>
                                                <td data-label="Class">{s.className}</td>
                                                <td data-label="Subject">{s.subjectName || "Free period"}</td>
                                                <td data-label="Status">
                                                    {tag ? (
                                                        <span
                                                            style={{
                                                                padding: "3px 10px",
                                                                borderRadius: "12px",
                                                                background: tag === "Now" ? "#16a34a" : "#eef2ff",
                                                                color: tag === "Now" ? "#fff" : "#1d4ed8",
                                                                fontSize: "12px",
                                                                fontWeight: "700"
                                                            }}
                                                        >
                                                            {tag}
                                                        </span>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* FULL WEEK */}
                    <div className="page-header">
                        <div>
                            <h3 style={{ margin: 0 }}>Full Week</h3>
                        </div>
                    </div>
                    {loading ? (
                        <p>Loading...</p>
                    ) : slots.length === 0 ? (
                        <p style={{ color: "#6b7280" }}>
                            Nothing assigned to you yet. Your class timings appear here once the admin sets the timetable.
                        </p>
                    ) : (
                        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "26px" }}>
                            {DAYS.map((day) => {
                                const daySlots = slots.filter((s) => s.dayOfWeek === day);
                                return (
                                    <div
                                        key={day}
                                        style={{
                                            flex: "1 1 220px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "10px",
                                            padding: "12px 14px",
                                            background: day === tk ? "#f0f9ff" : "#fff"
                                        }}
                                    >
                                        <strong>{DAY_FULL[day]}</strong>
                                        {daySlots.length === 0 ? (
                                            <p style={{ color: "#9ca3af", margin: "8px 0 0", fontSize: "13px" }}>No classes</p>
                                        ) : (
                                            daySlots.map((s, i) => (
                                                <div key={i} style={{ margin: "8px 0 0", fontSize: "14px" }}>
                                                    <div style={{ fontWeight: 600 }}>{timeText(s)}</div>
                                                    <div>
                                                        {s.className} · {s.subjectName || "Free period"}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* MY CLASS TIMETABLES (class teachers) */}
                    <div className="page-header">
                        <div>
                            <h3 style={{ margin: 0 }}>My Class Timetables</h3>
                            <p>Full weekly timetable of the classes you are the class teacher of.</p>
                        </div>
                    </div>

                    {myClasses.length === 0 ? (
                        <p style={{ color: "#6b7280" }}>
                            You are not set as a class teacher yet. The classes you lead will be listed here.
                        </p>
                    ) : (
                        <>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                                {myClasses.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => openClassTimetable(c)}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: "8px",
                                            border: selectedClass === c ? "2px solid #1d4ed8" : "1px solid #d1d5db",
                                            background: selectedClass === c ? "#eef2ff" : "#fff",
                                            fontWeight: selectedClass === c ? "700" : "500",
                                            cursor: "pointer"
                                        }}
                                    >
                                        🏫 {c}
                                    </button>
                                ))}
                            </div>

                            {gridLoading && <p>Loading timetable...</p>}

                            {!gridLoading && classGrid && (
                                <div className="table-container" style={{ overflowX: "auto" }}>
                                    <table className="stack-sm" style={{ minWidth: "640px" }}>
                                        <thead>
                                            <tr>
                                                <th>Period</th>
                                                <th>Time</th>
                                                {(classGrid.days || DAYS).map((d) => (
                                                    <th key={d}>{DAY_FULL[d] || d}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(classGrid.rows || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={8}>No timetable set for this class yet.</td>
                                                </tr>
                                            ) : (
                                                classGrid.rows.map((row) => (
                                                    <tr key={row.periodNumber}>
                                                        <td data-label="Period"><strong>{row.periodNumber}</strong></td>
                                                        <td data-label="Time">{row.startTime || "-"}{row.endTime ? ` – ${row.endTime}` : ""}</td>
                                                        {(classGrid.days || DAYS).map((d) => {
                                                            const cell = row.cells?.[d];
                                                            return (
                                                                <td data-label={DAY_FULL[d] || d} key={d}>
                                                                    <div style={{ fontWeight: 600 }}>{cell?.subjectName || "Free"}</div>
                                                                    {cell?.teacherName ? (
                                                                        <div style={{ fontSize: "12px", color: "#6b7280" }}>{cell.teacherName}</div>
                                                                    ) : null}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}


export default MySchedulePage;
