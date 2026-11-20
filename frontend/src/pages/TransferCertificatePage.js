/* Transfer Certificate — filters, student picker, profile + fee details,
   certificate form (only after selection), and quick fee concession. */
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { toast } from "../services/notify";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/Skeleton";
import { printTcReceipt } from "../utils/receipt";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default function TransferCertificatePage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState("");
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("All");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [reason, setReason] = useState("Transfer to another school");
    const [leavingDate, setLeavingDate] = useState(new Date().toISOString().slice(0, 10));
    const [conduct, setConduct] = useState("Good");
    const [downloading, setDownloading] = useState(false);
    const [feeSummary, setFeeSummary] = useState(null);
    const [feeLoading, setFeeLoading] = useState(false);
    const [amountCollected, setAmountCollected] = useState("");
    const [paymentMode, setPaymentMode] = useState("Cash");
    const [lastReceipt, setLastReceipt] = useState(null); // { tc, amount } snapshot for reprint
    const [tab, setTab] = useState("issue");
    const [tcRecords, setTcRecords] = useState([]);
    const [tcYears, setTcYears] = useState([]);
    const [yearFilter, setYearFilter] = useState("All");
    const [overall, setOverall] = useState(null);
    const [issuing, setIssuing] = useState(false);

    // Overall balance (includes previous year), TC-specific — other pages untouched.
    useEffect(() => {
        if (!selected) { setOverall(null); return; }
        api.get(`/documents/balance/${selected}`)
            .then((r) => setOverall(r.data))
            .catch(() => setOverall(null));
    }, [selected]);

    const loadTCs = useCallback(async (year = "All") => {
        try {
            const r = await api.get("/documents/records", { params: year === "All" ? {} : { academicYear: year } });
            setTcRecords(r.data.records || []);
            setTcYears(r.data.academicYears || []);
        } catch (e) { toast(e.response?.data?.message || "Unable to load TC records."); }
    }, []);
    useEffect(() => { if (tab === "records") loadTCs(yearFilter); }, [tab, yearFilter, loadTCs]);

    useEffect(() => {
        api.get("/students")
            .then((r) => setStudents(Array.isArray(r.data) ? r.data.filter((s) => s.status !== "archived") : []))
            .catch((e) => toast(e.response?.data?.message || "Unable to load students."))
            .finally(() => setLoading(false));
    }, []);

    const classes = useMemo(
        () => ["All", ...[...new Set(students.map((s) => s.className).filter(Boolean))].sort()],
        [students]
    );
    const categories = useMemo(
        () => ["All", ...[...new Set(students.map((s) => s.studentCategory).filter(Boolean))].sort()],
        [students]
    );
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return students.filter((s) =>
            (classFilter === "All" || s.className === classFilter) &&
            (categoryFilter === "All" || s.studentCategory === categoryFilter) &&
            (!q || `${s.studentName} ${s.rollNumber} ${s.admissionNumber || ""} ${s.fatherName || ""}`.toLowerCase().includes(q))
        );
    }, [students, search, classFilter, categoryFilter]);
    const current = students.find((s) => String(s.id) === String(selected)) || null;

    // Load fee details whenever a student is selected.
    useEffect(() => {
        if (!selected) { setFeeSummary(null); return; }
        setFeeLoading(true);
        api.get(`/payments/history/student/${selected}`)
            .then((r) => setFeeSummary(r.data))
            .catch(() => setFeeSummary(null))
            .finally(() => setFeeLoading(false));
    }, [selected]);

    const selectStudent = useCallback((s) => {
        // Toggle: clicking the selected student again deselects them.
        if (String(selected) === String(s.id)) {
            setSelected("");
            return;
        }
        setSelected(s.id);
    }, [selected]);

    const download = useCallback(async () => {
        if (!selected) return toast("Select a student first.");
        setDownloading(true);
        try {
            const res = await api.get(`/documents/${selected}/pdf`, {
                params: { reason, leavingDate, conduct },
                responseType: "blob"
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `TransferCertificate_${(current?.studentName || "student").replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast("Transfer certificate downloaded.");
        } catch (e) {
            toast(e.response?.data?.message || "Unable to generate certificate.");
        } finally { setDownloading(false); }
    }, [selected, reason, leavingDate, conduct, current]);

    // TC Out — record + archive (no auto-download). Download from TC Records.
    const issueTC = async () => {
        if (!selected) return toast("Select a student first.");
        setIssuing(true);
        try {
            const collectedAmount = Number(amountCollected || 0);
            const r = await api.post(`/documents/issue/${selected}`, {
                reason, leavingDate, conduct,
                amountCollected: collectedAmount,
                paymentMode
            });
            toast(r.data?.message || "TC issued and student archived.");

            // TC settlement receipt: only overall outstanding, amount paid now
            // and the conceded balance (not every fee component). Snapshot it
            // before clearing selection state so the fallback can reprint.
            if (r.data?.paymentId) {
                const tcSnapshot = {
                    id: r.data.tcId,
                    paymentId: r.data.paymentId,
                    studentName: current?.studentName || "",
                    className: current?.className || "",
                    rollNumber: current?.rollNumber || "",
                    admissionNumber: current?.admissionNumber || "",
                    fatherName: current?.fatherName || "",
                    academicYear: overall?.academicYear || "",
                    balance: overall?.balance || 0,
                    amountCollected: collectedAmount,
                    remainingAmount: Math.max(0, Number(overall?.balance || 0) - collectedAmount),
                    issuedAt: new Date().toISOString()
                };
                setLastReceipt({ tc: tcSnapshot, amount: collectedAmount });
                printTcReceipt(tcSnapshot);
            } else {
                setLastReceipt(null);
            }

            setSelected("");
            setFeeSummary(null);
            setOverall(null);
            setAmountCollected("");
            setPaymentMode("Cash");
            setTab("records");
            loadTCs("All");
        } catch (e) {
            toast(e.response?.data?.message || "Unable to issue TC.");
        } finally { setIssuing(false); }
    };

    const downloadRecord = async (rec) => {
        try {
            const res = await api.get(`/documents/records/${rec.id}/pdf`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `TransferCertificate_${(rec.studentName || "student").replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) { toast(e.response?.data?.message || "Unable to download TC."); }
    };

    // Shared details block: shown inline after the selected row on mobile,
    // and in the right column on desktop (CSS toggles visibility).
    const detailsBlock = current ? (
        <>
                                    <div className="tc-selected-card">
                                        <strong>{current.studentName}</strong>
                                        <span className="tc-chip">{current.className || "-"}</span>
                                        <span className="tc-chip">Roll {current.rollNumber || "-"}</span>
                                        <div className="tc-selected-sub">
                                            Father: {current.fatherName || "-"} · Mother: {current.motherName || "-"} · Contact: {current.contact1 || "-"}
                                        </div>
                                    </div>
                                    <h3 className="tc-section-title">Profile details</h3>
                                    <div className="tc-detail-grid">
                                        <div><span>Admission No.</span><strong>{current.admissionNumber || "-"}</strong></div>
                                        <div><span>SATS No.</span><strong>{current.satsNumber || "-"}</strong></div>
                                        <div><span>Date of Birth</span><strong>{current.dob || "-"}</strong></div>
                                        <div><span>Gender</span><strong>{current.gender || "-"}</strong></div>
                                        <div><span>Category</span><strong>{current.studentCategory || "general"}</strong></div>
                                        <div><span>Status</span><strong>{current.status || "active"}</strong></div>
                                        <div className="tc-full"><span>Address</span><strong>{current.address || "-"}</strong></div>
                                    </div>
                                    <h3 className="tc-section-title">Overall balance (all years)</h3>
                                    {overall ? (
                                        <>
                                            <div className="tc-fee-grid">
                                                <div><span>Previous dues</span><strong>{money(overall.previousDues)}</strong></div>
                                                <div><span>Current fees</span><strong>{money(overall.items)}</strong></div>
                                                <div><span>Concession</span><strong className="positive-balance">- {money(overall.concession)}</strong></div>
                                                <div><span>Paid</span><strong className="positive-balance">- {money(overall.paid)}</strong></div>
                                            </div>
                                            <div className="tc-overall-balance">
                                                <span>Overall outstanding</span>
                                                <strong className={Number(overall.balance) > 0 ? "negative-balance" : "positive-balance"}>{money(overall.balance)}</strong>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="tc-hint">Loading overall balance…</div>
                                    )}

                                    <h3 className="tc-section-title">Fee details (this year)</h3>
                                    {feeLoading ? (
                                        <div className="skel-card"><div className="skel skel-line tall" /><div className="skel skel-line" /></div>
                                    ) : feeSummary ? (
                                        <>
                                            <div className="tc-fee-grid">
                                                <div><span>Total Demand</span><strong>{money(feeSummary.totalFee)}</strong></div>
                                                <div><span>Paid</span><strong className="positive-balance">{money(feeSummary.totalPaid)}</strong></div>
                                                <div><span>Balance</span><strong className={Number(feeSummary.balance) > 0 ? "negative-balance" : "positive-balance"}>{money(feeSummary.balance)}</strong></div>
                                                <div><span>Receipts</span><strong>{(feeSummary.payments || []).length}</strong></div>
                                            </div>
                                            {(feeSummary.items || []).length > 0 && (
                                                <div className="tc-fee-items">
                                                    {(feeSummary.items || []).map((it, idx) => (
                                                        <div key={idx}><span>{it.componentName || "Fee"}</span><strong>{money(it.amount)}</strong></div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="tc-hint">No fee account found for the active academic year.</div>
                                    )}
                                                                        <div className="tc-amount-collect">
                                        <label>Amount collecting now (₹)
                                            <input type="number" min="0" step="1" value={amountCollected} onChange={(e) => setAmountCollected(e.target.value)} placeholder="0" />
                                        </label>
                                        <label>Payment mode
                                            <select className="filter-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                                <option>Cash</option>
                                                <option>UPI</option>
                                                <option>Card</option>
                                                <option>Bank Transfer</option>
                                                <option>Cheque</option>
                                            </select>
                                        </label>
                                        {overall && (
                                            <div className="tc-amount-remaining">
                                                Remaining after collection: <strong className={Number(overall.balance) - Number(amountCollected || 0) > 0 ? "negative-balance" : "positive-balance"}>{money(Math.max(0, Number(overall.balance) - Number(amountCollected || 0)))}</strong>
                                            </div>
                                        )}
                                    </div>
<h3 className="tc-section-title">Certificate details</h3>
                                    <div className="exam-form-grid">
                                        <label>Reason for leaving
                                            <input value={reason} onChange={(e) => setReason(e.target.value)} />
                                        </label>
                                        <label>Date of leaving
                                            <input type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
                                        </label>
                                        <label>Conduct / Character
                                            <select value={conduct} onChange={(e) => setConduct(e.target.value)}>
                                                <option>Good</option><option>Very Good</option><option>Excellent</option><option>Satisfactory</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="tc-actions">
                                        <button type="button" className="primary-btn" onClick={issueTC} disabled={issuing}>
                                            {issuing ? "Issuing…" : "📤 TC Out (issue & archive)"}
                                        </button>
                                    </div>

        </>
    ) : null;

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Transfer Certificate</h2>
                            <p>Documents · Search a student, review their profile &amp; fees, then generate a TC</p>
                        </div>
                    </div>

                    <div className="exam-tabbar" style={{ marginTop: 20 }}>
                        <button type="button" className={"exam-tab " + (tab === "issue" ? "exam-tab-active" : "")} onClick={() => setTab("issue")}>Issue TC</button>
                        <button type="button" className={"exam-tab " + (tab === "records" ? "exam-tab-active" : "")} onClick={() => { setTab("records"); loadTCs(yearFilter); }}>TC Records</button>
                    </div>

                    {tab === "records" ? (
                        <>
                        {lastReceipt && (
                            <div className="settings-card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }}>
                                <span style={{ marginRight: "auto" }}>✅ TC issued — collection <strong>{money(lastReceipt.amount)}</strong> recorded.</span>
                                <button type="button" className="primary-btn" onClick={() => printTcReceipt(lastReceipt.tc)}>🧾 Print TC Receipt</button>
                                <button type="button" className="clear-btn" onClick={() => setLastReceipt(null)}>Dismiss</button>
                            </div>
                        )}
                        <div className="settings-card" style={{ marginTop: 14 }}>
                            <div className="payment-filters">
                                <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                                    <option value="All">All Academic Years</option>
                                    {tcYears.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <button type="button" className="clear-btn" onClick={() => loadTCs(yearFilter)}>Refresh</button>
                            </div>
                            <div className="table-container" style={{ marginTop: 10 }}>
                                <table className="stack-sm">
                                    <thead><tr><th>TC No.</th><th>Student</th><th>Class</th><th>Academic Year</th><th>Leaving</th><th>Balance</th><th>Issued</th><th style={{textAlign:"right"}}>Fee Receipt</th><th style={{textAlign:"right"}}>Download</th></tr></thead>
                                    <tbody>
                                        {tcRecords.length === 0 ? (
                                            <tr><td colSpan="9"><div className="empty-state"><strong>No TC records</strong><span>Issue a TC to see it here.</span></div></td></tr>
                                        ) : tcRecords.map((r) => (
                                            <tr key={r.id}>
                                                <td data-label="TC No.">TC/{new Date(r.issuedAt).getFullYear()}/{String(r.id).padStart(4,"0")}</td>
                                                <td data-label="Student">{r.studentName || "-"}</td>
                                                <td data-label="Class">{r.className || "-"}</td>
                                                <td data-label="Academic Year">{r.academicYear || "-"}</td>
                                                <td data-label="Leaving">{r.leavingDate || "-"}</td>
                                                <td data-label="Balance">{money(r.balance)}</td>
                                                <td data-label="Issued">{new Date(r.issuedAt).toLocaleDateString("en-IN")}</td>
                                                <td data-label="Fee Receipt" style={{textAlign:"right"}}>
                                                    {r.paymentId ? (
                                                        <button type="button" className="receipt-btn" onClick={() => printTcReceipt(r)}>🧾 Receipt</button>
                                                    ) : <span style={{ color: "#94A3B8" }}>—</span>}
                                                </td>
                                                <td data-label="Download" style={{textAlign:"right"}}>
                                                    <button type="button" className="primary-btn" onClick={() => downloadRecord(r)}>⬇ Download</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </>
                    ) : (
                    <div className={current ? "tc-layout" : "tc-layout tc-layout-single"}>
                        {/* LEFT: search + filters + student list (no internal scroll) */}
                        <section className="settings-card tc-panel">
                            <h3>Find a student</h3>
                            <div className="tc-filters">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search by name, roll, admission no. or father…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class">
                                    <option value="All">All Classes</option>
                                    {classes.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
                                    <option value="All">All Categories</option>
                                    {categories.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" className="clear-btn" onClick={() => { setSearch(""); setClassFilter("All"); setCategoryFilter("All"); }}>Clear</button>
                            </div>
                            <div className="tc-count">{filtered.length} student(s) found</div>

                            {loading ? <SkeletonTable rows={3} /> : (
                                <div className="table-container">
                                    <table className="stack-sm">
                                        <thead>
                                            <tr>
                                                <th>Roll No.</th><th>Student</th><th>Class</th><th>Admission No.</th><th style={{ textAlign: "right" }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan="5"><div className="empty-state"><strong>No students found</strong><span>Try a different search or filter.</span></div></td></tr>
                                            ) : filtered.map((s) => (
                                                <Fragment key={s.id}>
                                                    <tr className={String(s.id) === String(selected) ? "tc-selected" : ""}>
                                                        <td data-label="Roll No.">{s.rollNumber || "-"}</td>
                                                        <td data-label="Student"><strong>{s.studentName}</strong></td>
                                                        <td data-label="Class">{s.className || "-"}</td>
                                                        <td data-label="Admission No.">{s.admissionNumber || "-"}</td>
                                                        <td data-label="Action" style={{ textAlign: "right" }}>
                                                            <button type="button" className={String(s.id) === String(selected) ? "cancel-btn" : "primary-btn"} onClick={() => selectStudent(s)}>
                                                                {String(s.id) === String(selected) ? "Deselect" : "Select"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {String(s.id) === String(selected) && (
                                                        <tr className="tc-inline-details-row">
                                                            <td colSpan="5"><div className="tc-details-inline">{detailsBlock}</div></td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {/* RIGHT: details — only after selection, certificate form directly below the card */}
                        <section className="settings-card tc-panel">
                            {current && (
                                <div className="tc-details-desktop">{detailsBlock}</div>
                            )}
                        </section>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
