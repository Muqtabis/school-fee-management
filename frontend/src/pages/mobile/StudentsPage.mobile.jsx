/* MOBILE Students — searchable card list; tap a card for details. */
import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileRow, MobileList, MobileCard, MobileSheet } from "../../components/mobile/MobileUI";

export default function StudentsPageMobile() {
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All");
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/students")
            .then((r) => setStudents(Array.isArray(r.data) ? r.data : []))
            .catch((e) => toast(e.response?.data?.message || "Unable to load students."))
            .finally(() => setLoading(false));
    }, []);

    const classes = useMemo(
        () => ["All", ...[...new Set(students.map((s) => s.className).filter(Boolean))].sort()],
        [students]
    );
    const list = students.filter((s) => {
        const mc = classFilter === "All" || s.className === classFilter;
        const q = search.toLowerCase();
        const ms = !q || `${s.studentName} ${s.rollNumber} ${s.admissionNumber || ""}`.toLowerCase().includes(q);
        return mc && ms;
    });

    return (
        <div>
            <h2>Students</h2>
            <p className="m-page-lead">{students.length} enrolled · tap a student for details</p>

            <input
                className="m-search"
                type="search"
                placeholder="Search name, roll or admission no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="m-chips">
                {classes.map((c) => (
                    <button
                        type="button"
                        key={c}
                        className={"m-chip" + (classFilter === c ? " m-chip-active" : "")}
                        onClick={() => setClassFilter(c)}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="m-empty">Loading…</div>
            ) : (
                <MobileList empty={search || classFilter !== "All" ? "No matching students." : "No students yet."}>
                    {list.map((s) => (
                        <button type="button" className="m-row" key={s.id} onClick={() => setSelected(s)} style={{ width: "100%", textAlign: "left" }}>
                            <div className="m-row-main">
                                <strong>{s.studentName}</strong>
                                <small>{s.className} · Roll {s.rollNumber || "—"}</small>
                            </div>
                            <div className="m-row-side">
                                <span className={"m-badge " + (s.status === "archived" ? "m-badge-off" : "")}>
                                    {s.status === "archived" ? "Archived" : "Active"}
                                </span>
                            </div>
                        </button>
                    ))}
                </MobileList>
            )}

            <MobileSheet open={!!selected} onClose={() => setSelected(null)} title="Student details">
                {selected && (
                    <div className="m-list">
                        <MobileCard title={selected.studentName} value={`Roll ${selected.rollNumber || "—"}`} sub={`${selected.className || ""} · ${selected.admissionNumber || ""}`} />
                        <MobileRow label="Father" value={selected.fatherName || "—"} />
                        <MobileRow label="Mother" value={selected.motherName || "—"} />
                        <MobileRow label="Contact" value={selected.contact1 || "—"} />
                        <MobileRow label="Status" value={selected.status || "active"} />
                    </div>
                )}
            </MobileSheet>
        </div>
    );
}
