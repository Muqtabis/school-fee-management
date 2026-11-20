import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// Each stat card deep-links to the page where the number is
// actionable, so the dashboard becomes a control panel.
const CARD_ROUTES = {
    "Students": "/students",
    "Teachers": "/teacher-management",
    "Total Fees": "/fees",
    "Fee Collection": "/payments",
    "Pending Fees": "/payments",
    "Fee Concessions": "/fee-concessions",
    "TC Conceded Fee": "/fee-concessions",
    "School Expenses": "/expenses",
    "School Incomes": "/incomes",
    "Net Balance": "/reports",
    "Total Payments": "/payments",
    "Expense Transactions": "/expenses"
};

function DashboardPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Principal and manager get a restricted dashboard: only
    // head-count cards (Students, Teachers). Every money figure
    // — fees, collection, pending, concessions, expenses — is
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
        tcConcededFee: 0,
        tcCollected: 0
    });

    const [recentPayments, setRecentPayments] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    // Configurable dashboard cards (per-user, persisted).
    const [hiddenCards, setHiddenCards] = useState(() => {
        try { return JSON.parse(localStorage.getItem("dashboard-hidden-cards") || "[]"); } catch (e) { return []; }
    });
    const [customizing, setCustomizing] = useState(false);
    const ALL_CARDS = ["Net Balance", "Students", "Teachers", "Total Fees", "Fee Concessions", "TC Conceded Fee", "Fee Collection", "Pending Fees", "School Expenses", "School Incomes", "Total Payments", "Expense Transactions"];
    const toggleCard = (name) => {
        const next = hiddenCards.includes(name) ? hiddenCards.filter((c) => c !== name) : [...hiddenCards, name];
        setHiddenCards(next);
        try { localStorage.setItem("dashboard-hidden-cards", JSON.stringify(next)); } catch (e) { /* optional */ }
    };
    const cardVisible = (name) => !hiddenCards.includes(name);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);

            // One role-guarded call for all summary numbers.
            const paymentSummary = await api.get("/dashboard/summary");

            // TC Conceded Fee = sum of the remaining amounts waived at the
            // time transfer certificates were issued. Fetched on every load
            // so new TCs immediately reflect here. Roles without the TC page
            // grant simply fall back to 0 (card is hidden for them anyway).
            let tcConcededFee = 0;
            try {
                const tcRes = await api.get("/documents/records");
                const recs = Array.isArray(tcRes.data?.records) ? tcRes.data.records : [];
                tcConcededFee = recs.reduce((s, r) => s + Number(r.remainingAmount || 0), 0);
            } catch (e) { /* non-fatal: keep 0 */ }

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
                tcConcededFee: canSeeFinancial ? tcConcededFee : 0,
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

    return (
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
                        <div className="settings-card" style={{ padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {ALL_CARDS.map((c) => (
                                <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minHeight: 36 }}>
                                    <input type="checkbox" checked={cardVisible(c)} onChange={() => toggleCard(c)} /> {c}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* First Row of Cards */}
                    <div className="cards">
                        {canSeeFinancial && cardVisible("Net Balance") && <DashboardCard title="Net Balance" value={money(summary.netBalance)} icon="💵" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Net Balance"])} />}
                        {cardVisible("Students") && <DashboardCard title="Students" value={summary.totalStudents} icon="👨‍🎓" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Students"])} />}
                        {cardVisible("Teachers") && <DashboardCard title="Teachers" value={summary.totalTeachers} icon="🧑‍🏫" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Teachers"])} />}
                        {canSeeFinancial && (
                            <>
                                {/* Cash collected at the TC counter is treated as recovered — it comes off the
                                    net fee demand here, off Pending Fees (already lower via totalCollection),
                                    and is added to Net Balance (totalCollection includes it) server-side. */}
                                {cardVisible("Total Fees") && <DashboardCard title="Total Fees" value={money(Math.max(0, summary.netFee - summary.tcCollected))} icon="📚" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Total Fees"])} />}
                                {cardVisible("Fee Concessions") && <DashboardCard title="Fee Concessions" value={money(summary.totalConcessions)} icon="🏷️" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Fee Concessions"])} />}
                                {cardVisible("TC Conceded Fee") && <DashboardCard title="TC Conceded Fee" value={money(summary.tcConcededFee)} icon="🎓" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["TC Conceded Fee"])} />}
                                {cardVisible("Fee Collection") && <DashboardCard title="Fee Collection" value={money(summary.totalCollection)} icon="💰" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Fee Collection"])} />}
                                {cardVisible("Pending Fees") && <DashboardCard title="Pending Fees" value={money(summary.pendingFees)} icon="⚠️" color="var(--danger)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Pending Fees"])} />}
                            </>
                        )}
                    </div>

                    {/* Second Row of Cards (financial roles only) */}
                    {canSeeFinancial && (
                        <div className="cards" style={{ marginTop: "20px" }}>
                            {cardVisible("School Expenses") && <DashboardCard title="School Expenses" value={money(summary.totalExpenseAmount)} icon="💸" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["School Expenses"])} />}
                            {cardVisible("School Incomes") && <DashboardCard title="School Incomes" value={money(summary.totalIncomeAmount)} icon="📈" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["School Incomes"])} />}
                            {cardVisible("Total Payments") && <DashboardCard title="Total Payments" value={summary.totalPayments} icon="🧾" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Total Payments"])} />}
                            {cardVisible("Expense Transactions") && <DashboardCard title="Expense Transactions" value={summary.totalExpenses} icon="📋" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Expense Transactions"])} />}
                        </div>
                    )}

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
                                <h3>Recent School Expenses</h3>
                                {recentExpenses.length === 0 ? (
                                    <p className="empty-note">No expenses recorded yet.</p>
                                ) : (
                                    <table className="stack-sm">
                                        <thead>
                                            <tr>
                                                <th>Expense</th>
                                                <th>Category</th>
                                                <th>Amount</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentExpenses.map(expense => (
                                                <tr key={expense.id}>
                                                    <td data-label="Expense">{expense.expenseName}</td>
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
    );
}

export default DashboardPage;
