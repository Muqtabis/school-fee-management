/* MOBILE Payments — completed/reversed/requests tabs, card list,
   collect-fee via bottom sheet. Same API + role logic as desktop. */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { toast } from "../../services/notify";
import { MobileSegmented, MobileRow, MobileList, MobileCard, MobileSheet, MobileFab } from "../../components/mobile/MobileUI";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentsPageMobile() {
    const { user } = useAuth();
    const isApprover = user?.role === "admin" || user?.role === "principal";
    const [tab, setTab] = useState("completed");
    const [payments, setPayments] = useState([]);
    const [requests, setRequests] = useState([]);
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sheet, setSheet] = useState(false);
    const [form, setForm] = useState({ studentId: "", amount: "", paymentMode: "Cash", paymentDate: today(), remarks: "" });
    const [reasonFor, setReasonFor] = useState(null);
    const [reason, setReason] = useState("");

    const load = useCallback(async () => {
        try {
            const [p, st, cl] = await Promise.all([
                api.get("/payments"),
                api.get("/students"),
                api.get("/classes")
            ]);
            setPayments(Array.isArray(p.data) ? p.data : []);
            setStudents(Array.isArray(st.data) ? st.data : []);
            setClasses(Array.isArray(cl.data) ? cl.data : []);
            if (isApprover) {
                const r = await api.get("/payments/reverse-requests").catch(() => ({ data: [] }));
                setRequests(Array.isArray(r.data) ? r.data : []);
            }
        } catch (e) { toast(e.response?.data?.message || "Unable to load payments."); }
        finally { setLoading(false); }
    }, [isApprover]);
    useEffect(() => { load(); }, [load]);

    const completed = payments.filter((p) => p.status !== "reversed");
    const reversed = payments.filter((p) => p.status === "reversed");

    const openCollect = () => {
        setForm({ studentId: "", amount: "", paymentMode: "Cash", paymentDate: today(), remarks: "" });
        setSheet(true);
    };
    const collect = async (e) => {
        e.preventDefault();
        try {
            await api.post("/payments", {
                studentId: Number(form.studentId),
                amount: Number(form.amount),
                paymentMode: form.paymentMode,
                paymentDate: form.paymentDate,
                remarks: form.remarks
            });
            toast("Payment recorded.");
            setSheet(false);
            load();
        } catch (err) { toast(err.response?.data?.message || "Unable to save payment."); }
    };
    const reverse = async () => {
        if (!reason.trim()) return toast("Enter a reason.");
        try {
            const r = await api.post(`/payments/${reasonFor.id}/reverse`, { reason });
            toast(r.data?.message || "Request submitted.");
            setReasonFor(null); setReason(""); load();
        } catch (err) { toast(err.response?.data?.message || "Unable to submit."); }
    };
    const review = async (id, action) => {
        try {
            const r = await api.post(`/payments/reverse-requests/${id}/${action}`, {});
            toast(r.data?.message || "Updated."); load();
        } catch (err) { toast(err.response?.data?.message || "Unable to review."); }
    };

    return (
        <div>
            <h2>Payments</h2>
            <p className="m-page-lead">Fee collections and reversals</p>

            <MobileSegmented
                value={tab}
                onChange={setTab}
                options={[
                    { value: "completed", label: `Completed (${completed.length})` },
                    ...(isApprover ? [{ value: "reversed", label: `Reversed (${reversed.length})` }, { value: "requests", label: `Requests (${requests.length})` }] : [])
                ]}
            />

            {loading ? <div className="m-empty">Loading…</div> : (
                <>
                    {tab === "completed" && (
                        <MobileList empty="No completed payments.">
                            {completed.map((p) => (
                                <MobileRow key={p.id}
                                    label={p.studentName || "Student"}
                                    sub={`${p.paymentDate || ""} · ${p.paymentMode || ""}`}
                                    value={money(p.amount)}
                                    action={<button className="m-link" type="button" onClick={() => { setReasonFor(p); setReason(""); }}>Reverse</button>}
                                />
                            ))}
                        </MobileList>
                    )}
                    {tab === "reversed" && isApprover && (
                        <MobileList empty="No reversed payments.">
                            {reversed.map((p) => (
                                <MobileCard key={p.id} title={`${p.studentName || "Student"} · ${p.paymentDate || ""}`} value={money(p.amount)} sub={`Reason: ${p.voidReason || "—"}`} tone="danger" />
                            ))}
                        </MobileList>
                    )}
                    {tab === "requests" && isApprover && (
                        <MobileList empty="No pending requests.">
                            {requests.map((r) => (
                                <MobileCard key={r.id} title={r.studentName || "Student"} value={money(r.amount)} sub={`${r.requestedByName || ""}: ${r.reason || ""}`}>
                                    <div className="m-sheet-actions" style={{ marginTop: 10 }}>
                                        <button className="m-btn m-btn-primary" type="button" onClick={() => review(r.id, "approve")}>Approve</button>
                                        <button className="m-btn m-btn-ghost" type="button" onClick={() => review(r.id, "reject")}>Reject</button>
                                    </div>
                                </MobileCard>
                            ))}
                        </MobileList>
                    )}
                </>
            )}

            <MobileFab onClick={openCollect} />

            <MobileSheet open={sheet} onClose={() => setSheet(false)} title="Collect fee">
                <form onSubmit={collect}>
                    <label>Student
                        <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
                            <option value="">Select student</option>
                            {students.map((s) => <option key={s.id} value={s.id}>{s.rollNumber ? `Roll ${s.rollNumber} - ` : ""}{s.studentName}</option>)}
                        </select>
                    </label>
                    <label>Amount (₹)
                        <input type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </label>
                    <label>Payment mode
                        <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                            <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                        </select>
                    </label>
                    <label>Date
                        <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required />
                    </label>
                    <label>Remarks
                        <textarea rows="2" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                    </label>
                    <div className="m-sheet-actions">
                        <button className="m-btn m-btn-primary" type="submit">Save payment</button>
                        <button className="m-btn m-btn-ghost" type="button" onClick={() => setSheet(false)}>Cancel</button>
                    </div>
                </form>
            </MobileSheet>

            <MobileSheet open={!!reasonFor} onClose={() => setReasonFor(null)} title="Reverse payment">
                {reasonFor && (
                    <>
                        <p style={{ fontSize: 13, color: "#607080", marginBottom: 10 }}>
                            {reasonFor.studentName || "Student"} · {money(reasonFor.amount)}
                        </p>
                        <label>Reason
                            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being reversed?" />
                        </label>
                        <div className="m-sheet-actions">
                            <button className="m-btn m-btn-primary" type="button" onClick={reverse}>{isApprover ? "Reverse now" : "Send request"}</button>
                            <button className="m-btn m-btn-ghost" type="button" onClick={() => setReasonFor(null)}>Cancel</button>
                        </div>
                    </>
                )}
            </MobileSheet>
        </div>
    );
}
