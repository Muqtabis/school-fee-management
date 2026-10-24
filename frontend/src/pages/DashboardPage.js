import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";
import api from "../services/api";

// Each stat card deep-links to the page where the number is
// actionable, so the dashboard becomes a control panel.
const CARD_ROUTES = {
    "Students": "/students",
    "Teachers": "/teacher-management",
    "Total Fees": "/fees",
    "Fee Collection": "/payments",
    "Pending Fees": "/payments",
    "School Expenses": "/expenses",
    "Net Balance": "/reports",
    "Total Payments": "/payments",
    "Expense Transactions": "/expenses"
};

function DashboardPage() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({
        academicYear: "",
        totalStudents: 0,
        totalTeachers: 0,
        totalPayments: 0,
        totalFee: 0,
        totalCollection: 0,
        pendingFees: 0,
        totalExpenses: 0,
        totalExpenseAmount: 0,
        netBalance: 0
    });

    const [recentPayments, setRecentPayments] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const [paymentSummary, expenseSummary, payments, expenses] = await Promise.all([
                api.get("/payments/summary"),
                api.get("/expenses/summary"),
                // Only pull a small recent slice, not the whole tables. Ask for a
                // few extra payments so reversed rows can be filtered out client-side.
                api.get("/payments", { params: { limit: 20 } }),
                api.get("/expenses", { params: { limit: 5 } })
            ]);

            const totalCollection = Number(paymentSummary.data.totalCollection) || 0;
            const totalExpenseAmount = Number(expenseSummary.data.totalExpenseAmount) || 0;

            setSummary({
                academicYear: paymentSummary.data.academicYear?.name || "",
                totalStudents: Number(paymentSummary.data.totalStudents || 0),
                totalTeachers: Number(paymentSummary.data.totalTeachers || 0),
                totalPayments: Number(paymentSummary.data.totalPayments || 0),
                totalFee: Number(paymentSummary.data.totalFee || 0),
                totalCollection,
                pendingFees: Number(paymentSummary.data.pendingFees || 0),
                totalExpenses: Number(expenseSummary.data.totalExpenses || 0),
                totalExpenseAmount,
                netBalance: totalCollection - totalExpenseAmount
            });

            setRecentPayments(
                Array.isArray(payments.data)
                    ? payments.data.filter(p => p.status !== "reversed").slice(0, 5)
                    : []
            );

            setRecentExpenses(
                Array.isArray(expenses.data)
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

    if (loading) {
        return (
            <div className="dashboard">
                <Sidebar />
                <div className="main-content">
                    <Navbar />
                    <div className="page-content">
                        <div className="p-skeleton p-skeleton-line short" />
                        <div className="cards" style={{ marginTop: "18px" }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-skeleton p-skeleton-card" />
                            ))}
                        </div>
                        <div className="cards" style={{ marginTop: "20px" }}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="p-skeleton p-skeleton-card" />
                            ))}
                        </div>
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

                    {/* First Row of Cards */}
                    <div className="cards">
                        <DashboardCard title="Students" value={summary.totalStudents} icon="👨‍🎓" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Students"])} />
                        <DashboardCard title="Teachers" value={summary.totalTeachers} icon="🧑‍🏫" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Teachers"])} />
                        <DashboardCard title="Total Fees" value={money(summary.totalFee)} icon="📚" color="var(--navy)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Total Fees"])} />
                        <DashboardCard title="Fee Collection" value={money(summary.totalCollection)} icon="💰" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Fee Collection"])} />
                        <DashboardCard title="Pending Fees" value={money(summary.pendingFees)} icon="⚠️" color="var(--danger)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Pending Fees"])} />
                    </div>

                    {/* Second Row of Cards */}
                    <div className="cards" style={{ marginTop: "20px" }}>
                        <DashboardCard title="School Expenses" value={money(summary.totalExpenseAmount)} icon="💸" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["School Expenses"])} />
                        <DashboardCard title="Net Balance" value={money(summary.netBalance)} icon="💵" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Net Balance"])} />
                        <DashboardCard title="Total Payments" value={summary.totalPayments} icon="🧾" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Total Payments"])} />
                        <DashboardCard title="Expense Transactions" value={summary.totalExpenses} icon="📋" color="var(--p-slate)" chipColor="var(--gold-light)" onClick={() => navigate(CARD_ROUTES["Expense Transactions"])} />
                    </div>

                    {/* Tables Section */}
                    <div className="dashboard-grid" style={{ marginTop: "24px" }}>
                        
                        {/* Recent Payments Table */}
                        <div className="dashboard-table">
                            <h3>Recent Payments</h3>
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
                                    {recentPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: "center" }}>No Payments Found</td>
                                        </tr>
                                    ) : (
                                        recentPayments.map(payment => (
                                            <tr key={payment.id}>
                                                <td data-label="Student">{payment.studentName}</td>
                                                <td data-label="Amount">{money(payment.amount)}</td>
                                                <td data-label="Date">{payment.paymentDate}</td>
                                                <td data-label="Mode">{payment.paymentMode}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Recent Expenses Table */}
                        <div className="dashboard-table" style={{ marginTop: "20px" }}>
                            <h3>Recent School Expenses</h3>
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
                                    {recentExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: "center" }}>No Expenses Found</td>
                                        </tr>
                                    ) : (
                                        recentExpenses.map(expense => (
                                            <tr key={expense.id}>
                                                <td data-label="Expense">{expense.expenseName}</td>
                                                <td data-label="Category">{expense.category}</td>
                                                <td data-label="Amount">{money(expense.amount)}</td>
                                                <td data-label="Date">{expense.expenseDate}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
}

export default DashboardPage;