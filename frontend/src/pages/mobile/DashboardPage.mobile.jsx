/* MOBILE Dashboard — app-like card layout. Same API as desktop page. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { MobileCard, MobileRow, MobileList } from "../../components/mobile/MobileUI";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default function DashboardPageMobile() {
    const navigate = useNavigate();
    const [s, setS] = useState({ netBalance: 0, totalCollection: 0, totalIncomeAmount: 0, totalExpenseAmount: 0, totalStudents: 0, totalTeachers: 0, pendingFees: 0 });
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [sum, p] = await Promise.all([
                    api.get("/dashboard/summary"),
                    api.get("/payments", { params: { limit: 5 } })
                ]);
                const d = sum.data || {};
                setS({
                    netBalance: Number(d.netBalance || 0),
                    totalCollection: Number(d.totalCollection || 0),
                    totalIncomeAmount: Number(d.totalIncomeAmount || 0),
                    totalExpenseAmount: Number(d.totalExpenseAmount || 0),
                    totalStudents: Number(d.totalStudents || 0),
                    totalTeachers: Number(d.totalTeachers || 0),
                    pendingFees: Number(d.pendingFees || 0)
                });
                setPayments((p.data || []).filter((x) => x.status !== "reversed").slice(0, 4));
            } catch (e) { /* non-fatal */ }
            finally { setLoading(false); }
        })();
    }, []);

    return (
        <div>
            <h2>Dashboard</h2>
            <p className="m-page-lead">Your school at a glance</p>

            <div className="m-stats" style={{ marginBottom: 14 }}>
                <MobileCard title="Net Balance" value={loading ? "…" : money(s.netBalance)} sub="Fees + incomes − expenses" tone="gold" />
                <MobileCard title="Collection" value={loading ? "…" : money(s.totalCollection)} sub="This academic year" />
                <MobileCard title="Incomes" value={loading ? "…" : money(s.totalIncomeAmount)} sub="Non-fee inflow" tone="good" />
                <MobileCard title="Expenses" value={loading ? "…" : money(s.totalExpenseAmount)} sub="Outflow" tone="danger" />
            </div>

            <h3>Quick actions</h3>
            <div className="m-stats">
                <MobileCard title="Students" value={s.totalStudents} sub="Enrolled" onClick={() => navigate("/students")} />
                <MobileCard title="Collect Fee" value="₹ →" sub="Record payment" onClick={() => navigate("/payments")} />
                <MobileCard title="Attendance" value="✓" sub="Mark attendance" onClick={() => navigate("/student-attendance")} />
                <MobileCard title="Reports" value="▤" sub="View analytics" onClick={() => navigate("/reports")} />
            </div>

            <h3>Recent payments</h3>
            <MobileList empty="No recent payments.">
                {payments.map((p) => (
                    <MobileRow
                        key={p.id}
                        label={p.studentName || "Student"}
                        sub={`${p.paymentDate || ""} · ${p.paymentMode || ""}`}
                        value={money(p.amount)}
                    />
                ))}
            </MobileList>
        </div>
    );
}
