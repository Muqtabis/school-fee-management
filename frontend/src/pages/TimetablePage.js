import { toast } from "../services/notify";
import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";

// =====================================================
// TIMETABLE MANAGER (ADMIN)
// Set the weekly class timetable: period rows (with times)
// × days (Mon–Sat). Each cell picks a subject from the
// class's subjects and a teacher. The whole grid is saved
// per class with one button; the server rejects a teacher
// being in two classes at the same day+period.
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

const MAX_ROWS = 12;
const DEFAULT_ROW_COUNT = 8;

const classLabel = (c) => (c.section ? `${c.className} ${c.section}` : c.className);

// One editable row: period number, times, and a cell object per day.
const makeRow = (periodNumber) => ({
    periodNumber,
    startTime: "",
    endTime: "",
    cells: Object.fromEntries(DAYS.map((d) => [d, { subjectId: "", teacherId: "" }]))
});

// Server rows → editable rows (fill any missing day cell).
const toEditableRows = (serverRows) => {
    if (!serverRows || serverRows.length === 0) {
        return Array.from({ length: DEFAULT_ROW_COUNT }, (_, i) => makeRow(i + 1));
    }
    return serverRows.map((r) => ({
        periodNumber: r.periodNumber,
        startTime: r.startTime || "",
        endTime: r.endTime || "",
        cells: Object.fromEntries(
            DAYS.map((d) => {
                const cell = r.cells?.[d];
                return [d, { subjectId: cell?.subjectId || "", teacherId: cell?.teacherId || "" }];
            })
        )
    }));
};

function TimetablePage() {
    const [classes, setClasses] = useState([]);
    const [className, setClassName] = useState("");

    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/timetable/classes");
                setClasses(res.data.classes || []);
            } catch (error) {
                toast(error.response?.data?.message || "Unable to load classes.");
            }
        })();
    }, []);

    const loadClass = async (name) => {
        setClassName(name);
        setRows([]);
        setSubjects([]);
        setTeachers([]);
        if (!name) return;
        setLoading(true);
        try {
            const [metaRes, gridRes] = await Promise.all([
                api.get(`/timetable/meta?className=${encodeURIComponent(name)}`),
                api.get(`/timetable/${encodeURIComponent(name)}`)
            ]);
            setSubjects(metaRes.data.subjects || []);
            setTeachers(metaRes.data.teachers || []);
            setRows(toEditableRows(gridRes.data.rows));
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load this class timetable.");
        } finally {
            setLoading(false);
        }
    };

    const updateCell = (rowIndex, day, field, value) => {
        setRows((prev) =>
            prev.map((row, i) =>
                i === rowIndex
                    ? { ...row, cells: { ...row.cells, [day]: { ...row.cells[day], [field]: value } } }
                    : row
            )
        );
    };

    const updateRow = (rowIndex, field, value) => {
        setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [field]: value } : row)));
    };

    const addRow = () => {
        setRows((prev) => {
            if (prev.length >= MAX_ROWS) return prev;
            const next = Math.max(0, ...prev.map((r) => Number(r.periodNumber) || 0)) + 1;
            return [...prev, makeRow(next)];
        });
    };

    const removeLastRow = () => {
        setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    };

    const saveTimetable = async () => {
        setSaving(true);
        try {
            // Always send all six day cells per row so a break row
            // (times only, no subject) survives the reload too.
            const payloadRows = rows.map((row) => ({
                periodNumber: Number(row.periodNumber),
                startTime: row.startTime || "",
                endTime: row.endTime || "",
                cells: DAYS.map((d) => ({
                    day: d,
                    subjectId: row.cells[d].subjectId === "" ? null : Number(row.cells[d].subjectId),
                    teacherId: row.cells[d].teacherId === "" ? null : Number(row.cells[d].teacherId)
                }))
            }));

            await api.put(`/timetable/${encodeURIComponent(className)}`, { rows: payloadRows });
            toast("Timetable saved.");
            await loadClass(className);   // reload the truth from the server
        } catch (error) {
            toast(error.response?.data?.message || "Unable to save the timetable.");
        } finally {
            setSaving(false);
        }
    };

    const cellSelectStyle = {
        width: "100%",
        padding: "4px 6px",
        fontSize: "13px",
        border: "1px solid #d1d5db",
        borderRadius: "6px",
        background: "#fff"
    };

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Timetable</h2>
                            <p>Set the weekly periods, timings, subjects, and teachers for each class.</p>
                        </div>
                    </div>

                    {/* Class picker + row controls */}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "18px" }}>
                        <select
                            value={className}
                            onChange={(e) => loadClass(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db",
                                fontWeight: "600",
                                minWidth: "200px"
                            }}
                        >
                            <option value="">🏫 Select a class…</option>
                            {classes.map((c) => (
                                <option key={c.className} value={c.className}>
                                    {classLabel(c)}
                                </option>
                            ))}
                        </select>

                        {className && !loading && (
                            <>
                                <button
                                    onClick={addRow}
                                    disabled={rows.length >= MAX_ROWS}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #d1d5db",
                                        background: "#fff",
                                        cursor: rows.length >= MAX_ROWS ? "not-allowed" : "pointer"
                                    }}
                                >
                                    ＋ Add period
                                </button>
                                <button
                                    onClick={removeLastRow}
                                    disabled={rows.length <= 1}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #d1d5db",
                                        background: "#fff",
                                        cursor: rows.length <= 1 ? "not-allowed" : "pointer"
                                    }}
                                >
                                    － Remove last
                                </button>
                                <button
                                    onClick={saveTimetable}
                                    disabled={saving}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: saving ? "#93c5fd" : "#1d4ed8",
                                        color: "#fff",
                                        fontWeight: "700",
                                        cursor: saving ? "wait" : "pointer"
                                    }}
                                >
                                    {saving ? "Saving…" : "💾 Save Timetable"}
                                </button>
                            </>
                        )}
                    </div>

                    {!className && (
                        <p style={{ color: "#6b7280" }}>
                            Pick a class above to build its weekly timetable.
                        </p>
                    )}

                    {className && loading && <p>Loading timetable...</p>}

                    {className && !loading && (
                        <>
                            <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "10px" }}>
                                Tip: leave a cell's subject as "— Free —" for breaks or unassigned periods. A teacher cannot
                                be in two classes at the same time — the server checks that on save.
                            </p>

                            <div className="table-container" style={{ overflowX: "auto" }}>
                                <table className="stack-sm" style={{ minWidth: "980px" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: "70px" }}>Period</th>
                                            <th style={{ width: "150px" }}>Time</th>
                                            {DAYS.map((d) => (
                                                <th key={d}>{DAY_FULL[d]}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                <td data-label="Period">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="15"
                                                        value={row.periodNumber}
                                                        onChange={(e) => updateRow(rowIndex, "periodNumber", e.target.value)}
                                                        style={{ ...cellSelectStyle, fontWeight: "700" }}
                                                    />
                                                </td>
                                                <td data-label="Time">
                                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                        <input
                                                            type="time"
                                                            value={row.startTime}
                                                            onChange={(e) => updateRow(rowIndex, "startTime", e.target.value)}
                                                            style={cellSelectStyle}
                                                        />
                                                        <span>–</span>
                                                        <input
                                                            type="time"
                                                            value={row.endTime}
                                                            onChange={(e) => updateRow(rowIndex, "endTime", e.target.value)}
                                                            style={cellSelectStyle}
                                                        />
                                                    </div>
                                                </td>
                                                {DAYS.map((d) => (
                                                    <td data-label={DAY_FULL[d]} key={d}>
                                                        <select
                                                            value={row.cells[d].subjectId}
                                                            onChange={(e) => updateCell(rowIndex, d, "subjectId", e.target.value)}
                                                            style={{ ...cellSelectStyle, marginBottom: "4px" }}
                                                        >
                                                            <option value="">— Free —</option>
                                                            {subjects.map((s) => (
                                                                <option key={s.id} value={s.id}>{s.subjectName}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={row.cells[d].teacherId}
                                                            onChange={(e) => updateCell(rowIndex, d, "teacherId", e.target.value)}
                                                            style={cellSelectStyle}
                                                        >
                                                            <option value="">— Teacher —</option>
                                                            {teachers.map((t) => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                ))}
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


export default TimetablePage;
