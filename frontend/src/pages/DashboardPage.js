import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";
import OverlayDialog from "../components/OverlayDialog";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// Each stat card deep-links to the page where the number is
// actionable, so the dashboard becomes a control panel.
const CARD_ROUTES = {
    "Students": "/students",
    "Staff": "/teacher-management",
    "Total Fees": "/fees",
    "Fee Collected": "/payments",
    "Pending Fees": "/payments",
    "Concession": "/fee-concessions",
    "School Payment": "/expenses",
    "School Receipt": "/incomes",
    "Net Balance": "/reports",
    "Collection": "/payments",
    "Payment Transaction": "/expenses"
};

// Default card order. Users can reorder from the Customize panel; any new
// cards added later are appended automatically to saved orders.
const ALL_CARDS = ["Net Balance", "Students", "Staff", "Total Fees", "Concession", "Fee Collected", "Pending Fees", "School Payment", "School Receipt", "Collection", "Payment Transaction"];

function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Principal and manager get a restricted dashboard: only
    // head-count cards (Students, Teachers). Every money figure
    // — fees, collection, pending, concessions, payments — is
    // hidden (and zeroed server-side too).
    const isRestrictedRole =
        user?.role === "principal" || user?.role === "manager";
    const canSeeFinancial = !isRestrictedRole;

    const [summary, setSummary] = useState({
        academicYear: "",
        totalStudents: 0,
        totalTeachers: 0,
        totalPayments: 0,
        totalFee: 0,
        totalConcessions: 0,
        netFee: 0,
        totalCollection: 0,
        pendingFees: 0,
        totalExpenses: 0,
        totalExpenseAmount: 0,
        totalIncomes: 0,
        totalIncomeAmount: 0,
        netBalance: 0,
        tcCollected: 0,
        staffBreakdown: []
    });

    const [staffDialog, setStaffDialog] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const [staffLoading, setStaffLoading] = useState(false);
    const [classStrength, setClassStrength] = useState([]);
    const [activeCount, setActiveCount] = useState(0);
    const [notices, setNotices] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    // Configurable dashboard cards (per-user, persisted).
    const [hiddenCards, setHiddenCards] = useState(() => {
        try { return JSON.parse(localStorage.getItem("dashboard-hidden-cards") || "[]"); } catch (e) { return []; }
    });
    const [customizing, setCustomizing] = useState(false);
    // Per-user card priority order (persisted in this browser, like show/hide).
    const [cardOrder, setCardOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem("dashboard-card-order") || "[]");
            const valid = Array.isArray(saved) ? saved.filter((c) => ALL_CARDS.includes(c)) : [];
            return [...valid, ...ALL_CARDS.filter((c) => !valid.includes(c))];
        } catch (e) { return [...ALL_CARDS]; }
    });
    const toggleCard = (name) => {
        const next = hiddenCards.includes(name) ? hiddenCards.filter((c) => c !== name) : [...hiddenCards, name];
        setHiddenCards(next);
        try { localStorage.setItem("dashboard-hidden-cards", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const cardVisible = (name) => !hiddenCards.includes(name);

    const saveOrder = (next) => {
        setCardOrder(next);
        try { localStorage.setItem("dashboard-card-order", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const moveCard = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= cardOrder.length) return;
        const next = [...cardOrder];
        [next[index], next[target]] = [next[target], next[index]];
        saveOrder(next);
    };
    const resetOrder = () => saveOrder([...ALL_CARDS]);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);

            // One role-guarded call for all summary numbers.
            const paymentSummary = await api.get("/dashboard/summary");

            // Class-wise strength for the two panels below (non-fatal).
            try {
                const cs = await api.get("/students/counts");
                setClassStrength(Array.isArray(cs.data?.byClass) ? cs.data.byClass : []);
                setActiveCount(Number(cs.data?.counts?.active || 0));
            } catch (e) { setClassStrength([]); setActiveCount(0); }

            // Latest school notices (non-fatal).
            try {
                const nres = await api.get("/notices");
                setNotices(Array.isArray(nres.data) ? nres.data.slice(0, 3) : []);
            } catch (e) { setNotices([]); }

            // Recent lists only exist for roles allowed to see
            // financial data; restricted roles skip these calls
            // (they would 403 behind the page guards anyway).
            const [payments, expenses] = canSeeFinancial
                ? await Promise.all([
                      // Only pull a small recent slice, not the whole
                      // tables. A few extra payments so reversed rows
                      // can be filtered out client-side.
                      api.get("/payments", { params: { limit: 20 } }),
                      api.get("/expenses", { params: { limit: 5 } })
                  ])
                : [{ data: [] }, { data: [] }];

            setSummary({
                academicYear: paymentSummary.data.academicYear?.name || "",
                totalStudents: Number(paymentSummary.data.totalStudents || 0),
                totalTeachers: Number(paymentSummary.data.totalTeachers || 0),
                totalPayments: Number(paymentSummary.data.totalPayments || 0),
                totalFee: Number(paymentSummary.data.totalFee || 0),
                totalConcessions: Number(paymentSummary.data.totalConcessions || 0),
                netFee: Number(paymentSummary.data.netFee || 0),
                totalCollection: Number(paymentSummary.data.totalCollection || 0),
                pendingFees: Number(paymentSummary.data.pendingFees || 0),
                totalExpenses: Number(paymentSummary.data.totalExpenses || 0),
                totalExpenseAmount: Number(paymentSummary.data.totalExpenseAmount || 0),
                totalIncomes: Number(paymentSummary.data.totalIncomes || 0),
                totalIncomeAmount: Number(paymentSummary.data.totalIncomeAmount || 0),
                netBalance: Number(paymentSummary.data.netBalance || 0),
                staffBreakdown: Array.isArray(paymentSummary.data.staffBreakdown) ? paymentSummary.data.staffBreakdown : [],
                tcCollected: Number(paymentSummary.data.tcCollected || 0)
            });

            // Recent activity feed (read-only, role-filtered server-side).
            try {
                const act = await api.get("/dashboard/activity");
                setActivity(Array.isArray(act.data) ? act.data : []);
            } catch (e) { /* non-fatal */ }

            setRecentPayments(
                canSeeFinancial && Array.isArray(payments.data)
                    ? payments.data.filter(p => p.status !== "reversed").slice(0, 5)
                    : []
            );

            setRecentExpenses(
                canSeeFinancial && Array.isArray(expenses.data)
                    ? expenses.data.filter(e => e.status !== "reversed").slice(0, 5)
                    : []
            );
        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const openStaff = async () => {
        setStaffDialog(true);
        setStaffLoading(true);
        try {
            const r = await api.get("/dashboard/staff");
            setStaffList(Array.isArray(r.data?.staff) ? r.data.staff : []);
        } catch (e) { setStaffList([]); }
        finally { setStaffLoading(false); }
    };
    const roleLabel = (role) => ({
        admin: "Admin", principal: "Principal", manager: "Manager",
        accountant: "Accountant", teacher: "Teacher", supporting_teacher: "Support Teacher"
    }[role] || role);

    const classRank = (name) => {
        const s = String(name || "").toLowerCase();
        if (s.startsWith("lkg")) return 0;
        if (s.startsWith("ukg")) return 1;
        return 10 + (parseInt(String(name).match(/\d+/)?.[0] || "999", 10) || 999);
    };
    const sortedByClass = useMemo(
        () => [...classStrength].sort((a, b) => classRank(a.className) - classRank(b.className) || String(a.className).localeCompare(String(b.className), undefined, { numeric: true })),
        [classStrength]
    );
    const boysTotal = sortedByClass.reduce((s, r) => s + Number(r.boys || 0), 0);
    const girlsTotal = sortedByClass.reduce((s, r) => s + Number(r.girls || 0), 0);

    const money = value => `₹ ${Number(value || 0).toLocaleString("en-IN")}`;

    // "2026-11-02" -> "02 Nov 2026" — plain string math, no Date
    // parsing, so no timezone ever shifts the shown day.
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateFmt = value => {
        const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(value || "");
    };

    if (loading) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content">
                    <Navbar />
                    <div className="page-content">
                        <div className="p-skeleton p-skeleton-line short" />
                        <div className="cards" style={{ marginTop: "18px" }}>
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="p-skeleton p-skeleton-card" />
                            ))}
                        </div>
                        {canSeeFinancial && (
                            <div className="cards" style={{ marginTop: "20px" }}>
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-skeleton p-skeleton-card" />
                                ))}
                            </div>
                        )}
                        <div className="dashboard-grid" style={{ marginTop: "24px" }}>
                            <div className="p-skeleton p-skeleton-table" />
                            <div className="p-skeleton p-skeleton-table" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Values, icons and colours in one place so the Customize panel can
    // render the cards in whatever priority order the user chooses.
    const cardMeta = {
        "Net Balance": { value: money(summary.netBalance), icon: "💵", color: "var(--p-slate)", financial: true },
        "Students": { value: summary.totalStudents, icon: "👨‍🎓", color: "var(--navy)", financial: false },
        "Staff": { value: summary.totalTeachers, color: "var(--navy)", financial: false, onClick: openStaff },
        // Net demand after concession: equals Fee Collection + Pending Fees.
        "Total Fees": { value: money(summary.netFee), icon: "📚", color: "var(--navy)", financial: true },
        "Concession": { value: money(summary.totalConcessions), icon: "🏷️", color: "var(--p-slate)", financial: true },
        "Fee Collected": { value: money(summary.totalCollection), icon: "💰", color: "var(--p-slate)", financial: true },
        "Pending Fees": { value: money(summary.pendingFees), icon: "⚠️", color: "var(--danger)", financial: true },
        "School Payment": { value: money(summary.totalExpenseAmount), icon: "💸", color: "var(--p-slate)", financial: true },
        "School Receipt": { value: money(summary.totalIncomeAmount), icon: "📈", color: "var(--p-slate)", financial: true },
        "Collection": { value: summary.totalPayments, icon: "🧾", color: "var(--p-slate)", financial: true },
        "Payment Transaction": { value: summary.totalExpenses, icon: "📋", color: "var(--p-slate)", financial: true }
    };

    return (
        <>
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    
                    {/* Header */}
                    <div className="page-header">
                        <div>
                            <h2>Dashboard</h2>
                            <p>
                                Active Academic Year: <strong>{summary.academicYear || "-"}</strong>
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                        <button type="button" className="clear-btn" onClick={() => setCustomizing((v) => !v)}>{customizing ? "Done" : "⚙ Customize cards"}</button>
                    </div>
                    {customizing && (
                        <div className="settings-card" style={{ padding: 14, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                                Tick a card to show it. Use ↑ / ↓ to set the order it appears on your dashboard. Your layout is saved automatically.
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                                {cardOrder.map((c, i) => (
                                    <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
                                        <input type="checkbox" checked={cardVisible(c)} onChange={() => toggleCard(c)} aria-label={`Show ${c}`} />
                                        <span style={{ fontSize: 12, flex: 1, minWidth: 0 }}>{c}</span>
                                        <button type="button" className="clear-btn" style={{ padding: "4px 10px" }} onClick={() => moveCard(i, -1)} disabled={i === 0} aria-label={`Move ${c} up`}>↑</button>
                                        <button type="button" className="clear-btn" style={{ padding: "4px 10px" }} onClick={() => moveCard(i, 1)} disabled={i === cardOrder.length - 1} aria-label={`Move ${c} down`}>↓</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="clear-btn" style={{ marginTop: 10 }} onClick={resetOrder}>Reset to default order</button>
                        </div>
                    )}

                    {/* Cards render in the user's chosen priority order.
                        TC-collected cash comes off Total Fees here (and off Pending Fees
                        via totalCollection), and is in Net Balance server-side. */}
                    <div className="cards">
                        {cardOrder
                            .filter((name) => cardVisible(name) && (!cardMeta[name]?.financial || canSeeFinancial))
                            .map((name) => {
                                const c = cardMeta[name];
                                if (!c) return null;
                                return (
                                    <DashboardCard key={name} title={name} value={c.value} icon={c.icon}
                                        color={c.color} chipColor="var(--gold-light)"
                                        onClick={c.onClick || (() => navigate(CARD_ROUTES[name]))} />
                                );
                            })}
                    </div>

                    {/* Class strength table + gender chart */}
                    <div className="students-top-row">
                        <div className="settings-card strength-card">
                            <div style={{ marginBottom: 10 }}>
                                <strong style={{ fontSize: 14 }}>Class-wise Student Strength</strong>
                                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                    <span className="strength-chip">Classes: {sortedByClass.length}</span>
                                    <span className="strength-chip" style={{ color: "#1D4ED8" }}>Boys: {boysTotal}</span>
                                    <span className="strength-chip" style={{ color: "#BE185D" }}>Girls: {girlsTotal}</span>
                                    <span className="strength-chip">On roll: {activeCount}</span>
                                </div>
                            </div>
                            <div className="table-container">
                                <table className="stack-sm strength-table">
                                    <thead><tr><th>Class</th><th className="num">Boys</th><th className="num">Girls</th><th className="num">Total</th></tr></thead>
                                    <tbody>
                                        {sortedByClass.length === 0 ? (
                                            <tr><td colSpan="4"><div className="empty-state"><strong>No class data</strong><span>Add students to see class strength.</span></div></td></tr>
                                        ) : sortedByClass.map((r) => (
                                            <tr key={r.className}>
                                                <td data-label="Class"><strong>{r.className}</strong></td>
                                                <td data-label="Boys" className="num boys">{r.boys || 0}</td>
                                                <td data-label="Girls" className="num girls">{r.girls || 0}</td>
                                                <td data-label="Total" className="num"><strong>{Number(r.boys || 0) + Number(r.girls || 0)}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td data-label="Class"><strong>TOTAL</strong></td>
                                            <td data-label="Boys" className="num"><strong>{boysTotal}</strong></td>
                                            <td data-label="Girls" className="num"><strong>{girlsTotal}</strong></td>
                                            <td data-label="Total" className="num"><strong>{boysTotal + girlsTotal}</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <small style={{ display: "block", marginTop: 8, fontSize: 11, color: "#64748B" }}>
                                Active students only. {activeCount - boysTotal - girlsTotal} student(s) have no gender recorded and are not counted in Boys/Girls.
                            </small>
                        </div>

                        <div className="students-side-col">
                            <div className="settings-card gender-chart-card">
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                                    <strong style={{ fontSize: 14 }}>Class-wise Gender Chart</strong>
                                    <span className="strength-chip" style={{ color: "#1D4ED8" }}>■ Boys {boysTotal}</span>
                                    <span className="strength-chip" style={{ color: "#BE185D" }}>■ Girls {girlsTotal}</span>
                                </div>
                                <div className="gender-chart-v">
                                    {sortedByClass.map((r) => {
                                        const b = Number(r.boys || 0), g = Number(r.girls || 0);
                                        const scale = Math.max(b, g, 1);
                                        return (
                                            <div className="gender-chart-col" key={r.className} title={`${r.className} — Boys ${b}, Girls ${g}`}>
                                                <div className="gender-chart-col-values">
                                                    <span className="v boys">{b}</span><span className="v girls">{g}</span>
                                                </div>
                                                <div className="gender-chart-col-bars">
                                                    <span className="grid-line" />
                                                    <span className="vbar boys" style={{ "--pct": (b / scale * 100) + "%" }} />
                                                    <span className="vbar girls" style={{ "--pct": (g / scale * 100) + "%" }} />
                                                </div>
                                                <span className="gender-chart-col-label">{r.className}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tables Section (financial roles only) */}
                    {canSeeFinancial && (
                        <div className="dashboard-grid" style={{ marginTop: "24px" }}>
                            
                            {/* Recent Payments Table */}
                            <div className="dashboard-table">
                                <h3>Recent Payments</h3>
                                {recentPayments.length === 0 ? (
                                    <p className="empty-note">No payments recorded yet.</p>
                                ) : (
                                    <table className="stack-sm">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Amount</th>
                                                <th>Date</th>
                                                <th>Mode</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentPayments.map(payment => (
                                                <tr key={payment.id}>
                                                    <td data-label="Student">{payment.studentName}</td>
                                                    <td data-label="Amount">{money(payment.amount)}</td>
                                                    <td data-label="Date">{dateFmt(payment.paymentDate)}</td>
                                                    <td data-label="Mode">{payment.paymentMode}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Recent Expenses Table */}
                            <div className="dashboard-table">
                                <h3>Recent School Payments</h3>
                                {recentExpenses.length === 0 ? (
                                    <p className="empty-note">No payments recorded yet.</p>
                                ) : (
                                    <table className="stack-sm">
                                        <thead>
                                            <tr>
                                                <th>Payment</th>
                                                <th>Category</th>
                                                <th>Amount</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentExpenses.map(expense => (
                                                <tr key={expense.id}>
                                                    <td data-label="Payment">{expense.expenseName}</td>
                                                    <td data-label="Category">{expense.category}</td>
                                                    <td data-label="Amount">{money(expense.amount)}</td>
                                                    <td data-label="Date">{dateFmt(expense.expenseDate)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                        </div>
                    )}

                    {/* Latest school notices */}
                    {notices.length > 0 && (
                        <div className="dashboard-table" style={{ marginTop: "24px" }}>
                            <h3>📢 Latest Notices</h3>
                            {notices.map((n) => (
                                <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid #E2E8F0" }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <strong style={{ fontSize: 13 }}>{n.pinned ? "📌 " : ""}{n.title}</strong>
                                        <span className="payment-badge mode-default">{n.audience}</span>
                                    </div>
                                    <p style={{ margin: "5px 0 0", fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>{n.body}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent activity feed (audit log) */}
                    <div className="dashboard-table" style={{ marginTop: "24px" }}>
                        <h3>Recent Activity</h3>
                        {activity.length === 0 ? (
                            <p className="empty-note">No activity recorded yet.</p>
                        ) : (
                            <table className="stack-sm">
                                <tbody>
                                    {activity.map((a) => (
                                        <tr key={a.id}>
                                            <td data-label="Action"><span className="payment-badge mode-default">{a.action.replace(/_/g, " ")}</span></td>
                                            <td data-label="By">{a.userName || "System"}</td>
                                            <td data-label="When">{dateFmt(a.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                </div>
            </div>
        </div>

        {staffDialog && (
            <OverlayDialog onClose={() => setStaffDialog(false)} ariaLabel="Staff members">
                <div className="student-modal" style={{ maxWidth: "560px", maxHeight: "88vh", overflowY: "auto" }}>
                    <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                        <div>
                            <h2>Staff Members ({staffList.length})</h2>
                            <p>All staff accounts and their roles</p>
                        </div>
                        <button type="button" className="close-btn" onClick={() => setStaffDialog(false)}>✕</button>
                    </div>
                    <div style={{ padding: "20px" }}>
                        {summary.staffBreakdown.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                                {summary.staffBreakdown.map((r) => (
                                    <span key={r.role} className="payment-badge mode-default" style={{ fontSize: 11 }}>
                                        {roleLabel(r.role)} {r.total}
                                    </span>
                                ))}
                            </div>
                        )}
                        {staffLoading ? <p className="empty-note">Loading…</p> : staffList.length === 0 ? (
                            <p className="empty-note">No staff found.</p>
                        ) : (
                            <div className="table-container">
                                <table className="stack-sm">
                                    <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                                    <tbody>
                                        {staffList.map((s) => (
                                            <tr key={s.id}>
                                                <td data-label="Name"><strong>{s.name || "-"}</strong></td>
                                                <td data-label="Email">{s.email || "-"}</td>
                                                <td data-label="Role"><span className="payment-badge mode-default">{roleLabel(s.role)}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div className="modal-actions" style={{ padding: "12px 20px" }}>
                        <button type="button" className="cancel-btn" onClick={() => setStaffDialog(false)}>Close</button>
                    </div>
                </div>
            </OverlayDialog>
        )}
        </>
    );
}

export default DashboardPage;
