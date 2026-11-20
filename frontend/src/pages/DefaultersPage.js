/* Fee Defaulters — students with outstanding balances, grouped & filterable. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../services/notify";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/Skeleton";
import * as XLSX from "xlsx";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const cleanSheetName = (name) => String(name || "Class").replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Class";

export default function DefaultersPage() {
    const [data, setData] = useState({ defaulters: [], summary: {}, academicYear: "" });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All");
    const [bucket, setBucket] = useState("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get("/payments/defaulters");
            setData({ defaulters: r.data.defaulters || [], summary: r.data.summary || {}, academicYear: r.data.academicYear || "" });
        } catch (e) { toast(e.response?.data?.message || "Unable to load defaulters."); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const classes = useMemo(
        () => ["All", ...[...new Set(data.defaulters.map((d) => d.className).filter(Boolean))].sort()],
        [data.defaulters]
    );
    const list = data.defaulters.filter((d) => {
        const q = search.toLowerCase();
        return (classFilter === "All" || d.className === classFilter)
            && (bucket === "all" || d.bucket === bucket)
            && (!q || `${d.studentName} ${d.rollNumber} ${d.admissionNumber || ""}`.toLowerCase().includes(q));
    });

    const exportExcel = () => {
        const rows = list.length ? list : data.defaulters;
        if (!rows.length) return toast("No defaulters to export.");
        const wb = XLSX.utils.book_new();

        // Overview sheet
        const overview = [
            { Metric: "Academic Year", Value: data.academicYear || "-" },
            { Metric: "Total Defaulters", Value: rows.length },
            { Metric: "Total Outstanding (Rs.)", Value: rows.reduce((s, d) => s + Number(d.balance || 0), 0) },
            { Metric: "Fully Unpaid", Value: rows.filter((d) => d.bucket === "unpaid").length },
            { Metric: "Partial Payment", Value: rows.filter((d) => d.bucket === "partial").length },
            { Metric: "Generated On", Value: new Date().toLocaleDateString("en-IN") }
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), "Overview");

        // One sheet per class
        const byClass = {};
        rows.forEach((d) => {
            const cls = cleanSheetName(d.className || "Unassigned");
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push({
                "Roll No": d.rollNumber || "-",
                "Admission No": d.admissionNumber || "-",
                "Student Name": d.studentName || "-",
                "Class": d.className || "-",
                "Contact": d.contact1 || "-",
                "Total Demand (Rs.)": Number(d.totalDemand || 0),
                "Total Paid (Rs.)": Number(d.totalPaid || 0),
                "Balance (Rs.)": Number(d.balance || 0),
                "Status": d.bucket
            });
        });
        Object.entries(byClass).forEach(([cls, classRows]) => {
            const ws = XLSX.utils.json_to_sheet(classRows);
            XLSX.utils.book_append_sheet(wb, ws, cls);
        });

        const fileName = `Fee_Defaulters_${(data.academicYear || "year").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast(`Exported ${rows.length} defaulter(s) across ${Object.keys(byClass).length} class sheet(s).`);
    };

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Fee Defaulters</h2>
                            <p>Outstanding fee balances · {data.academicYear || "Active year"}</p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="cancel-btn" onClick={load}>Refresh</button>
                            <button type="button" className="primary-btn" onClick={exportExcel}>⬇ Export Excel</button>
                        </div>
                    </div>

                    <div className="cards" style={{ marginBottom: 18 }}>
                        <div className="dashboard-card"><h3>Defaulters</h3><h1>{data.summary.count || 0}</h1></div>
                        <div className="dashboard-card"><h3>Total Outstanding</h3><h1>{money(data.summary.totalOutstanding)}</h1></div>
                        <div className="dashboard-card"><h3>Fully Unpaid</h3><h1>{data.summary.unpaid || 0}</h1></div>
                        <div className="dashboard-card"><h3>Partial Payment</h3><h1>{data.summary.partial || 0}</h1></div>
                    </div>

                    <div className="payment-filters">
                        <input type="text" className="search-input" placeholder="Search student, roll or admission no." value={search} onChange={(e) => setSearch(e.target.value)} />
                        <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                            {classes.map((c) => <option key={c} value={c}>{c === "All" ? "All Classes" : c}</option>)}
                        </select>
                        <select className="filter-select" value={bucket} onChange={(e) => setBucket(e.target.value)}>
                            <option value="all">All statuses</option>
                            <option value="unpaid">Fully unpaid</option>
                            <option value="partial">Partial payment</option>
                        </select>
                    </div>

                    {loading ? <SkeletonTable rows={5} /> : (
                        <div className="table-container">
                            <table className="stack-sm">
                                <thead><tr><th>Roll</th><th>Student</th><th>Class</th><th>Contact</th><th>Demand</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                                <tbody>
                                    {list.length === 0 ? (
                                        <tr><td colSpan="8"><div className="empty-state"><span className="empty-icon">🎉</span><strong>No defaulters here</strong><span>These filters show no students with outstanding fees.</span></div></td></tr>
                                    ) : list.map((d) => (
                                        <tr key={d.studentId}>
                                            <td data-label="Roll">{d.rollNumber || "-"}</td>
                                            <td data-label="Student">{d.studentName}</td>
                                            <td data-label="Class">{d.className || "-"}</td>
                                            <td data-label="Contact">{d.contact1 || "-"}</td>
                                            <td data-label="Demand">{money(d.totalDemand)}</td>
                                            <td data-label="Paid">{money(d.totalPaid)}</td>
                                            <td data-label="Balance"><strong className="negative-balance">{money(d.balance)}</strong></td>
                                            <td data-label="Status"><span className="payment-badge mode-default">{d.bucket}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
