/* Archived Students — dedicated page with tabs:
   Archived Students | TC Records. Replaces the old archive toggle in StudentsPage. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast, confirmDialog } from "../services/notify";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/Skeleton";
import { StudentDetailModal } from "./StudentsPage";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ArchivedStudentsPage() {
    const [tab, setTab] = useState("archived");
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All");
    const [busyId, setBusyId] = useState(null);
    const [tcRecords, setTcRecords] = useState([]);
    const [tcIssuedIds, setTcIssuedIds] = useState([]);
    const [tcYears, setTcYears] = useState([]);
    const [tcYear, setTcYear] = useState("All");
    const [tcLoading, setTcLoading] = useState(false);
    const [profileStudent, setProfileStudent] = useState(null);

    const loadStudents = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get("/students", { params: { status: "archived" } });
            setStudents(Array.isArray(r.data) ? r.data : []);
            const tc = await api.get("/documents/records").catch(() => ({ data: { records: [] } }));
            setTcIssuedIds((tc.data.records || []).map((x) => String(x.studentId)));
        } catch (e) { toast(e.response?.data?.message || "Unable to load archived students."); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { loadStudents(); }, [loadStudents]);

    const loadTCs = useCallback(async (year = "All") => {
        setTcLoading(true);
        try {
            const r = await api.get("/documents/records", { params: year === "All" ? {} : { academicYear: year } });
            setTcRecords(r.data.records || []);
            setTcYears(r.data.academicYears || []);
        } catch (e) { toast(e.response?.data?.message || "Unable to load TC records."); }
        finally { setTcLoading(false); }
    }, []);
    useEffect(() => { if (tab === "tc") loadTCs(tcYear); }, [tab, tcYear, loadTCs]);

    const classes = useMemo(
        () => ["All", ...[...new Set(students.map((s) => s.className).filter(Boolean))].sort()],
        [students]
    );
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return students.filter((s) =>
            (classFilter === "All" || s.className === classFilter) &&
            (!q || `${s.studentName} ${s.rollNumber} ${s.admissionNumber || ""}`.toLowerCase().includes(q))
        );
    }, [students, search, classFilter]);

    const restore = async (s) => {
        if (!(await confirmDialog({ message: `Restore ${s.studentName}?`, confirmLabel: "Restore" }))) return;
        setBusyId(s.id);
        try {
            const r = await api.post(`/students/${s.id}/restore`, {});
            toast(r.data?.message || "Student restored.");
            loadStudents();
        } catch (e) { toast(e.response?.data?.message || "Unable to restore student."); }
        finally { setBusyId(null); }
    };

    const downloadTC = async (rec) => {
        try {
            const res = await api.get(`/documents/records/${rec.id}/pdf`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url; a.download = `TransferCertificate_${(rec.studentName || "student").replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (e) { toast(e.response?.data?.message || "Unable to download TC."); }
    };

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Archived Students</h2>
                            <p>Restore students and access their transfer certificates</p>
                        </div>
                    </div>

                    <div className="exam-tabbar" style={{ marginTop: 20 }}>
                        <button type="button" className={"exam-tab " + (tab === "archived" ? "exam-tab-active" : "")} onClick={() => setTab("archived")}>
                            Archived Students <span className="exam-badge">{students.length}</span>
                        </button>
                        <button type="button" className={"exam-tab " + (tab === "tc" ? "exam-tab-active" : "")} onClick={() => { setTab("tc"); loadTCs(tcYear); }}>
                            TC Records <span className="exam-badge">{tcRecords.length}</span>
                        </button>
                    </div>

                    {tab === "archived" ? (
                        <div className="settings-card" style={{ marginTop: 14 }}>
                            <div className="payment-filters">
                                <input type="text" className="search-input" placeholder="Search archived students…" value={search} onChange={(e) => setSearch(e.target.value)} />
                                <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                                    {classes.map((c) => <option key={c} value={c}>{c === "All" ? "All Classes" : c}</option>)}
                                </select>
                                <button type="button" className="clear-btn" onClick={() => { setSearch(""); setClassFilter("All"); }}>Clear</button>
                            </div>
                            <div className="tc-count">{filtered.length} archived student(s)</div>
                            {loading ? <SkeletonTable rows={4} /> : (
                                <div className="table-container">
                                    <table className="stack-sm">
                                        <thead><tr><th>Roll No.</th><th>Student</th><th>Class</th><th>Admission No.</th><th>Archived</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan="6"><div className="empty-state"><strong>No archived students</strong><span>Students you archive will appear here.</span></div></td></tr>
                                            ) : filtered.map((s) => (
                                                <tr key={s.id}>
                                                    <td data-label="Roll No.">{s.rollNumber || "-"}</td>
                                                    <td data-label="Student">{s.studentName}</td>
                                                    <td data-label="Class">{s.className || "-"}</td>
                                                    <td data-label="Admission No.">{s.admissionNumber || "-"}</td>
                                                    <td data-label="Archived">{s.archivedAt ? new Date(s.archivedAt).toLocaleDateString("en-IN") : "-"}</td>
                                                    <td data-label="Action" style={{ textAlign: "right" }}>
                                                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                                            <button type="button" className="edit-btn" onClick={() => setProfileStudent(s)}>View Profile</button>
                                                            {tcIssuedIds.includes(String(s.id)) ? (
                                                                <span className="payment-badge mode-default" title="TC issued - cannot be restored">TC issued</span>
                                                            ) : (
                                                            <button type="button" className="primary-btn" disabled={busyId === s.id} onClick={() => restore(s)}>
                                                                {busyId === s.id ? "Restoring…" : "Restore"}
                                                            </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="settings-card" style={{ marginTop: 14 }}>
                            <div className="payment-filters">
                                <select className="filter-select" value={tcYear} onChange={(e) => setTcYear(e.target.value)}>
                                    <option value="All">All Academic Years</option>
                                    {tcYears.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <button type="button" className="clear-btn" onClick={() => loadTCs(tcYear)}>Refresh</button>
                            </div>
                            <div className="table-container" style={{ marginTop: 10 }}>
                                <table className="stack-sm">
                                    <thead><tr><th>TC No.</th><th>Student</th><th>Class</th><th>Academic Year</th><th>Leaving</th><th>Conceded (Written Off)</th><th>Issued</th><th style={{ textAlign: "right" }}>Download</th></tr></thead>
                                    <tbody>
                                        {tcLoading ? (
                                            <tr><td colSpan="8">Loading…</td></tr>
                                        ) : tcRecords.length === 0 ? (
                                            <tr><td colSpan="8"><div className="empty-state"><strong>No TC records</strong><span>No transfer certificates have been issued yet.</span></div></td></tr>
                                        ) : tcRecords.map((r) => (
                                            <tr key={r.id}>
                                                <td data-label="TC No.">TC/{new Date(r.issuedAt).getFullYear()}/{String(r.id).padStart(4, "0")}</td>
                                                <td data-label="Student">{r.studentName || "-"}</td>
                                                <td data-label="Class">{r.className || "-"}</td>
                                                <td data-label="Academic Year">{r.academicYear || "-"}</td>
                                                <td data-label="Leaving">{r.leavingDate || "-"}</td>
                                                <td data-label="Conceded (Written Off)"><strong className="negative-balance">{money(r.remainingAmount)}</strong></td>
                                                <td data-label="Issued">{new Date(r.issuedAt).toLocaleDateString("en-IN")}</td>
                                                <td data-label="Download" style={{ textAlign: "right" }}>
                                                    <button type="button" className="primary-btn" onClick={() => downloadTC(r)}>⬇ Download</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                {profileStudent && (
                    <StudentDetailModal
                        student={profileStudent}
                        initialTab="overview"
                        onClose={() => setProfileStudent(null)}
                    />
                )}
                </div>
            </div>
        </div>
    );
}
