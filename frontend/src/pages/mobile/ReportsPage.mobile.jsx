/* MOBILE Reports — sectioned stat cards + simple mode bars. */
import { useEffect, useState } from "react";
import api from "../../services/api";
import { MobileCard, MobileRow, MobileList } from "../../components/mobile/MobileUI";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default function ReportsPageMobile() {
    const [s, setS] = useState({ collection: 0, income: 0, expense: 0, net: 0 });
    const [modes, setModes] = useState([]);
    const [incomes, setIncomes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [p, e, i, sum] = await Promise.all([
                    api.get("/payments").catch(() => ({ data: [] })),
                    api.get("/expenses").catch(() => ({ data: [] })),
                    api.get("/incomes").catch(() => ({ data: [] })),
                    api.get("/payments/report-summary").catch(() => ({ data: {} }))
                ]);
                const pays = (Array.isArray(p.data) ? p.data : []).filter((x) => x.status !== "reversed");
                const col = pays.reduce((a, x) => a + Number(x.amount || 0), 0);
                const exp = (Array.isArray(e.data) ? e.data : []).filter((x) => x.status !== "reversed").reduce((a, x) => a + Number(x.amount || 0), 0);
                const inc = (Array.isArray(i.data) ? i.data : []).filter((x) => x.status !== "reversed").reduce((a, x) => a + Number(x.amount || 0), 0);
                setS({ collection: col, income: inc, expense: exp, net: col + inc - exp });
                const mm = {};
                pays.forEach((x) => { const k = x.paymentMode || "Cash"; mm[k] = (mm[k] || 0) + Number(x.amount || 0); });
                setModes(Object.entries(mm).map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount));
                setIncomes(Array.isArray(i.data) ? i.data.filter((x) => x.status !== "reversed").slice(0, 5) : []);
            } catch (err) { /* non-fatal */ }
            finally { setLoading(false); }
        })();
    }, []);

    const max = Math.max(s.collection, s.income, s.expense, 1);

    return (
        <div>
            <h2>Reports</h2>
            <p className="m-page-lead">Financial overview</p>

            <h3>Balance</h3>
            <MobileCard title="Net Balance" value={loading ? "…" : money(s.net)} sub="Fees + incomes − expenses" tone="gold" />

            <h3>Fees</h3>
            <div className="m-stats">
                <MobileCard title="Collected" value={loading ? "…" : money(s.collection)} sub="Fee receipts" />
                {modes.slice(0, 4).map((m) => (
                    <MobileCard key={m.mode} title={`${m.mode} collection`} value={money(m.amount)} sub={`${Math.round((m.amount / (s.collection || 1)) * 100)}% of fees`} />
                ))}
            </div>

            <h3>Incomes</h3>
            <MobileCard title="Total Income" value={loading ? "…" : money(s.income)} sub="Donations, grants, events" tone="good" />
            <MobileList empty="No income records.">
                {incomes.map((i) => <MobileRow key={i.id} label={i.incomeName || "Income"} sub={`${i.incomeDate || ""} · ${i.category || ""}`} value={money(i.amount)} />)}
            </MobileList>

            <h3>Expenses</h3>
            <MobileCard title="Total Expenses" value={loading ? "…" : money(s.expense)} sub="Operational outflow" tone="danger" />

            <h3>Cash flow</h3>
            <div className="m-list">
                {[
                    { l: "Fee Collection", v: s.collection, c: "#2f6b4f" },
                    { l: "Incomes", v: s.income, c: "#a9824b" },
                    { l: "Expenses", v: s.expense, c: "#a33a3a" }
                ].map((b) => (
                    <div key={b.l}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span>{b.l}</span><strong>{money(b.v)}</strong>
                        </div>
                        <div style={{ height: 12, borderRadius: 6, background: "#e9edf1", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(b.v / max) * 100}%`, background: b.c }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
