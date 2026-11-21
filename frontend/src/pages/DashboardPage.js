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

// Default card order. Users can reorder from the Customize panel; any new
// cards added later are appended automatically to saved orders.
const ALL_CARDS = ["Net Balance", "Students", "Teachers", "Total Fees", "Fee Concessions", "TC Conceded Fee", "Fee Collection", "Pending Fees", "School Expenses", "School Incomes", "Total Payments", "Expense Transactions"];

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

    // Values, icons and colours in one place so the Customize panel can
    // render the cards in whatever priority order the user chooses.
    const cardMeta = {
        "Net Balance": { value: money(summary.netBalance), icon: "💵", color: "var(--p-slate)", financial: true },
        "Students": { value: summary.totalStudents, icon: "👨‍🎓", color: "var(--navy)", financial: false },
        "Teachers": { value: summary.totalTeachers, icon: "🧑‍🏫", color: "var(--navy)", financial: false },
        "Total Fees": { value: money(Math.max(0, summary.netFee - summary.tcCollected)), icon: "📚", color: "var(--navy)", financial: true },
        "Fee Concessions": { value: money(summary.totalConcessions), icon: "🏷️", color: "var(--p-slate)", financial: true },
        "TC Conceded Fee": { value: money(summary.tcConcededFee), icon: "🎓", color: "var(--p-slate)", financial: true },
        "Fee Collection": { value: money(summary.totalCollection), icon: "💰", color: "var(--p-slate)", financial: true },
        "Pending Fees": { value: money(summary.pendingFees), icon: "⚠️", color: "var(--danger)", financial: true },
        "School Expenses": { value: money(summary.totalExpenseAmount), icon: "💸", color: "var(--p-slate)", financial: true },
        "School Incomes": { value: money(summary.totalIncomeAmount), icon: "📈", color: "var(--p-slate)", financial: true },
        "Total Payments": { value: summary.totalPayments, icon: "🧾", color: "var(--p-slate)", financial: true },
        "Expense Transactions": { value: summary.totalExpenses, icon: "📋", color: "var(--p-slate)", financial: true }
    };

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
                                        onClick={() => navigate(CARD_ROUTES[name])} />
                                );
                            })}
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
