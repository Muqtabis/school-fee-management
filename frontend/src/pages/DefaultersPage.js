/* Fee Defaulters — students with outstanding balances, grouped & filterable. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../services/notify";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/Skeleton";
import OverlayDialog from "../components/OverlayDialog";
import * as XLSX from "xlsx";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const cleanSheetName = (name) => String(name || "Class").replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Class";

export default function DefaultersPage() {
    const [data, setData] = useState({ defaulters: [], summary: {}, academicYear: "" });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All");
    const [bucket, setBucket] = useState("all");
    const [followFilter, setFollowFilter] = useState("all");
    const [editingFollow, setEditingFollow] = useState(null);
    const [followForm, setFollowForm] = useState({ status: "not_contacted", promiseDate: "", note: "" });
    const [savingFollow, setSavingFollow] = useState(false);

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
        const fu = d.followUp || {};
        const matchesFollow = followFilter === "all"
            ? true
            : followFilter === "due" ? !!fu.due
            : followFilter === "followed" ? fu.status !== "not_contacted"
            : fu.status === followFilter;
        return (classFilter === "All" || d.className === classFilter)
            && (bucket === "all" || d.bucket === bucket)
            && matchesFollow
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


    const openFollow = (d) => {
        const fu = d.followUp || {};
        setEditingFollow(d);
        setFollowForm({
            status: fu.status || "not_contacted",
            promiseDate: fu.promiseDate || "",
            note: fu.note || ""
        });
    };

    const saveFollow = async (e) => {
        e.preventDefault();
        if (!editingFollow) return;
        setSavingFollow(true);
        try {
            await api.put(`/payments/defaulters/${editingFollow.studentId}/followup`, followForm);
            toast("Follow-up saved.");
            setEditingFollow(null);
            await load();
        } catch (err) {
            toast(err.response?.data?.message || "Unable to save follow-up.");
        } finally { setSavingFollow(false); }
    };

    const printReminder = async (d) => {
        const w = window.open("", "_blank", "width=600,height=760");
        if (!w) { toast("Allow popups to print the reminder."); return; }

        // Fetch the student's fee history so we can show each component and
        // exactly how much has been paid toward it.
        let history = null;
        try {
            const res = await api.get(`/payments/history/student/${d.studentId}`);
            history = res.data;
        } catch (e) { /* fall back to totals only */ }

        // Build per-component rows: total, paid, balance.
        const paidBy = {};
        const prevDues = Math.max(0, Number(d.previousDues || 0) - Number(d.previousDuesConcession || 0));
        (history?.payments || []).forEach((pay) => {
            if (pay.status === "reversed") return;
            (pay.lineItems || []).forEach((li) => {
                const name = String(li.componentName || "Fee").trim();
                const key = name.toLowerCase();
                // Normalize the various spellings of tuition / previous dues.
                const norm = key.includes("previous") ? "Previous Dues"
                    : (key.includes("tuition") || key.includes("tution") || key.includes("term")) ? "Tuition Fee"
                    : name;
                paidBy[norm] = (paidBy[norm] || 0) + Number(li.amount || 0);
            });
        });
        const rows = [];
        if (prevDues > 0) rows.push({ name: "Previous Dues", total: prevDues, paid: Number(paidBy["Previous Dues"] || 0) });
        (history?.items || []).forEach((it) => {
            const name = String(it.componentName || "Fee").trim();
            const key = name.toLowerCase();
            const norm = (key.includes("tuition") || key.includes("tution") || key.includes("term")) ? "Tuition Fee" : name;
            const found = rows.find((r) => r.name === norm);
            const total = Number(it.amount || 0);
            if (found) found.total += total;
            else rows.push({ name: norm, total, paid: Number(paidBy[norm] || 0) });
        });
        // Any payment component not in the assessed list (e.g. TC collection).
        Object.keys(paidBy).forEach((name) => {
            if (!rows.find((r) => r.name === name)) rows.push({ name, total: Number(paidBy[name] || 0), paid: Number(paidBy[name] || 0) });
        });
        rows.forEach((r) => { r.balance = Math.max(0, Number((r.total - r.paid).toFixed(2))); });

        const finish = (logoSrc) => {
            const compRows = rows.length ? rows.map((r) => `
                <tr>
                    <td>${r.name}</td>
                    <td class="num">${money(r.total)}</td>
                    <td class="num paid">${money(r.paid)}</td>
                    <td class="num bal">${money(r.balance)}</td>
                </tr>`).join("") : `<tr><td colspan="4" class="empty">No fee components recorded</td></tr>`;
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee Reminder - ${d.studentName}</title>
            <style>
                @page { size: A5 portrait; margin: 8mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 0; font-size: 10px; }
                .head { display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #17365d; padding-bottom: 6px; margin-bottom: 4px; }
                .head img { width: 38px; height: 38px; object-fit: contain; }
                .head h1 { font-family: Georgia, serif; font-size: 15px; color: #17365d; margin: 0; }
                .head .tag { color: #6b7b8c; font-size: 8px; margin-top: 2px; }
                .ref { display: flex; justify-content: space-between; color: #6b7b8c; font-size: 8px; margin: 6px 0 10px; }
                .title { text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #17365d; margin: 0 0 8px; }
                .info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9px; }
                .info strong { color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
                th, td { border: 1px solid #d9e0e6; padding: 4px 6px; font-size: 9px; text-align: left; }
                th { background: #17365d; color: #fff; font-weight: 700; }
                td.num { text-align: right; }
                td.paid { color: #15803d; }
                td.bal { color: #b91c1c; font-weight: 700; }
                tr.total-row td { border-top: 2px solid #17365d; font-weight: 700; background: #f8fafc; }
                td.empty { text-align: center; color: #6b7b8c; }
                .letter { line-height: 1.5; margin: 8px 0; font-size: 9px; }
                .sign { margin-top: 16px; display: flex; justify-content: flex-end; }
                .sign .line { border-top: 1px solid #9ca3af; width: 150px; padding-top: 4px; text-align: center; color: #6b7b8c; font-size: 8px; }
                .foot { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 4px; font-size: 7px; color: #9ca3af; text-align: center; }
            </style></head><body>
            <div class="head">
                ${logoSrc ? `<img src="${logoSrc}" alt="School Logo" />` : ""}
                <div><h1>THE AGE SCHOOL</h1><div class="tag">Institute of Pre, Primary and Secondary Education · Basavakalyan</div></div>
            </div>
            <div class="ref"><span>Ref: FEE/REM/${d.studentId}/${new Date().getFullYear()}</span><span>Date: ${new Date().toLocaleDateString("en-IN")}</span></div>
            <p class="title">Fee Payment Reminder</p>
            <div class="info"><span>Student: <strong>${d.studentName || "-"}</strong></span><span>Class/Roll: <strong>${d.className || "-"} / ${d.rollNumber || "-"}</strong></span><span>Session: <strong>${data.academicYear || "Active Year"}</strong></span></div>
            <table>
                <thead><tr><th>Fee Component</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
                <tbody>
                    ${compRows}
                    <tr class="total-row"><td>TOTAL</td><td class="num">${money(d.totalDemand)}</td><td class="num paid">${money(d.totalPaid)}</td><td class="num bal">${money(d.balance)}</td></tr>
                </tbody>
            </table>
            <p class="letter">Dear Parent/Guardian, an amount of <strong>${money(d.balance)}</strong> is outstanding towards the fees of your ward for the session ${data.academicYear || "the current academic year"}. Kindly pay at the school office at your earliest convenience. Contact: <strong>${d.contact1 || "school office"}</strong>. Thank you.</p>
            <div class="sign"><div class="line">Authorised Signatory<br/>The Age School</div></div>
            <div class="foot">Computer-generated reminder · The Age School fee management system</div>
            </body></html>`);
            w.document.close();
            setTimeout(() => { w.focus(); w.print(); }, 500);
        };

        const img = w.document.createElement("img");
        let done = false;
        const once = (src) => { if (!done) { done = true; finish(src); } };
        img.onload = () => once(img.src);
        img.onerror = () => once("");
        img.src = window.location.origin + "/logo.png";
        setTimeout(() => once(""), 1500);
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
                        <div className="dashboard-card"><h3>Defaulters</h3><h1>{list.length}</h1></div>
                        <div className="dashboard-card"><h3>Total Outstanding</h3><h1>{money(list.reduce((s, d) => s + Number(d.balance || 0), 0))}</h1></div>
                        <div className="dashboard-card"><h3>Fully Unpaid</h3><h1>{list.filter((d) => d.bucket === "unpaid").length}</h1></div>
                        <div className="dashboard-card"><h3>Partial Payment</h3><h1>{list.filter((d) => d.bucket === "partial").length}</h1></div>
                        <div className="dashboard-card"><h3>Followed Up</h3><h1>{list.filter((d) => d.followUp?.status && d.followUp.status !== "not_contacted").length}</h1></div>
                        <div className="dashboard-card"><h3>Due Today</h3><h1>{list.filter((d) => d.followUp?.due).length}</h1></div>
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
                        <select className="filter-select" value={followFilter} onChange={(e) => setFollowFilter(e.target.value)}>
                            <option value="all">All follow-ups</option>
                            <option value="due">Due today</option>
                            <option value="followed">Followed up</option>
                            <option value="not_contacted">Not contacted</option>
                            <option value="called">Called</option>
                            <option value="notice_given">Notice given</option>
                            <option value="promised">Promised</option>
                        </select>
                        <button type="button" className="clear-btn" onClick={() => { setSearch(""); setClassFilter("All"); setBucket("all"); setFollowFilter("all"); }}>Clear</button>
                    </div>

                    {loading ? <SkeletonTable rows={5} /> : (
                        <div className="table-container">
                            <table className="stack-sm">
                                <thead><tr><th>Roll</th><th>Student</th><th>Class</th><th>Contact</th><th>Demand</th><th>Paid</th><th>Balance</th><th>Status</th><th>Follow-up</th><th style={{textAlign:"right"}}>Action</th></tr></thead>
                                <tbody>
                                    {list.length === 0 ? (
                                        <tr><td colSpan="10"><div className="empty-state"><span className="empty-icon">🎉</span><strong>No defaulters here</strong><span>These filters show no students with outstanding fees.</span></div></td></tr>
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
                                            <td data-label="Follow-up">
                                                <span className={"payment-badge " + (d.followUp?.due ? "mode-card" : "mode-default")}>
                                                    {(d.followUp?.status || "not_contacted").replace(/_/g, " ")}
                                                </span>
                                                {d.followUp?.promiseDate && <small style={{ display: "block", color: "#64748B", marginTop: 3 }}>Due {d.followUp.promiseDate}</small>}
                                                {d.followUp?.note && <small style={{ display: "block", color: "#64748B", marginTop: 2 }} title={d.followUp.note}>{d.followUp.note.slice(0, 24)}{d.followUp.note.length > 24 ? "…" : ""}</small>}
                                            </td>
                                            <td data-label="Action" style={{ textAlign: "right" }}>
                                                <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                                                    <button type="button" className="edit-btn" onClick={() => openFollow(d)}>Follow up</button>
                                                    <button type="button" className="receipt-btn" onClick={() => printReminder(d)}>Reminder</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                              {list.length > 0 && (
                                  <tfoot>
                                      <tr style={{ borderTop: "3px solid #17365d", background: "#F8FAFC" }}>
                                          <td colSpan="4"><strong>TOTAL ({list.length} student(s))</strong></td>
                                          <td><strong>{money(list.reduce((s, d) => s + Number(d.totalDemand || 0), 0))}</strong></td>
                                          <td><strong>{money(list.reduce((s, d) => s + Number(d.totalPaid || 0), 0))}</strong></td>
                                          <td><strong className="negative-balance">{money(list.reduce((s, d) => s + Number(d.balance || 0), 0))}</strong></td>
                                          <td colSpan="3"></td>
                                      </tr>
                                  </tfoot>
                              )}
                            </table>
                        </div>
                    )}

            {editingFollow && (
                <OverlayDialog onClose={() => setEditingFollow(null)} ariaLabel="Fee follow-up editor">
                    <div className="student-modal" style={{ maxWidth: "460px", maxHeight: "90vh", overflowY: "auto" }}>
                        <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                            <div>
                                <h2>Follow Up — {editingFollow.studentName}</h2>
                                <p>{editingFollow.className || "-"} · Balance {money(editingFollow.balance)} · {editingFollow.contact1 || "No contact"}</p>
                            </div>
                            <button type="button" className="close-btn" onClick={() => setEditingFollow(null)}>✕</button>
                        </div>
                        <form className="student-form" onSubmit={saveFollow} style={{ padding: "20px" }}>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>Status</label>
                                <select value={followForm.status} onChange={(e) => setFollowForm({ ...followForm, status: e.target.value })}>
                                    <option value="not_contacted">Not contacted</option>
                                    <option value="called">Called</option>
                                    <option value="notice_given">Notice given</option>
                                    <option value="promised">Promise date fixed</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>Promise / follow-up date</label>
                                <input type="date" value={followForm.promiseDate} onChange={(e) => setFollowForm({ ...followForm, promiseDate: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>Note</label>
                                <textarea rows={3} value={followForm.note} onChange={(e) => setFollowForm({ ...followForm, note: e.target.value })} placeholder="e.g. Parent promised to pay by 25th" />
                            </div>
                            <div className="modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                                <button type="button" className="cancel-btn" onClick={() => setEditingFollow(null)}>Cancel</button>
                                <button type="submit" className="save-btn" disabled={savingFollow}>{savingFollow ? "Saving..." : "Save follow-up"}</button>
                            </div>
                        </form>
                    </div>
                </OverlayDialog>
            )}
                </div>
            </div>
        </div>
    );
}
