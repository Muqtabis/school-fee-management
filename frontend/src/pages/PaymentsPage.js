import { toast } from "../services/notify";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PaymentForm from "../components/PaymentForm";
import PromptDialog from "../components/PromptDialog";
import SummaryTable from "../components/SummaryTable";
import api from "../services/api";

function PaymentsPage() {
    const { user } = useAuth();
    const isApprover = user?.role === "admin" || user?.role === "principal";
    const [payments, setPayments] = useState([]);
    const [classes, setClasses] = useState([]); // NEW: Dynamic classes state
    const [showForm, setShowForm] = useState(false);
    const [filters, setFilters] = useState({
        search: "",
        className: "All",
        paymentMode: "All",
        dateFrom: "",
        dateTo: ""
    });
    const [activeYear, setActiveYear] = useState("");
    const [paymentTab, setPaymentTab] = useState("completed");

    const completedPayments = useMemo(
        () => payments.filter((p) => p.status !== "reversed"),
        [payments]
    );
    const reversedPayments = useMemo(
        () => payments.filter((p) => p.status === "reversed"),
        [payments]
    );

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        await Promise.all([
            fetchPayments(),
            fetchActiveYear(),
            fetchClasses(), // Fetching dynamic classes concurrently
            fetchReverseRequests()
        ]);
    };

    const fetchActiveYear = async () => {
        try {
            const res = await api.get("/fees/academic-years");
            const active = res.data.find(year => year.status === "active");
            setActiveYear(active?.name || "");
        } catch (error) {
            console.error(error);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get("/classes");
            setClasses(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to fetch classes:", error);
        }
    };

    const fetchPayments = async (customFilters = filters) => {
        try {
            const params = {};
            if (customFilters.search) params.search = customFilters.search;
            if (customFilters.className !== "All") params.className = customFilters.className;
            if (customFilters.paymentMode !== "All") params.paymentMode = customFilters.paymentMode;
            if (customFilters.dateFrom) params.dateFrom = customFilters.dateFrom;
            if (customFilters.dateTo) params.dateTo = customFilters.dateTo;

            const res = await api.get("/payments", { params });
            setPayments(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to fetch payments:", error);
        }
    };

    const handleFilterChange = (e) => {
        const newFilters = { ...filters, [e.target.name]: e.target.value };
        setFilters(newFilters);
        fetchPayments(newFilters);
    };

    const clearFilters = () => {
        const cleared = {
            search: "",
            className: "All",
            paymentMode: "All",
            dateFrom: "",
            dateTo: ""
        };
        setFilters(cleared);
        fetchPayments(cleared);
    };

    const addPayment = () => {
        setShowForm(true);
    };

    // Reverse flow: centered PromptDialog replaces the old
    // window.prompt + window.confirm pair.
    const [reverseTarget, setReverseTarget] = useState(null);
    const [reasonTarget, setReasonTarget] = useState(null);
    const [savingReason, setSavingReason] = useState(false);
    const [reversing, setReversing] = useState(false);
    const [editPayment, setEditPayment] = useState(null);
    const [reverseRequests, setReverseRequests] = useState([]);
    const [editRequests, setEditRequests] = useState([]);

    const fetchEditRequests = async () => {
        if (!isApprover) return;
        try {
            const res = await api.get("/payments/edit-requests");
            setEditRequests(Array.isArray(res.data) ? res.data : []);
        } catch (error) { console.error("Unable to load edit requests:", error); }
    };

    const reviewEditRequest = async (id, action) => {
        try {
            const res = await api.post(`/payments/edit-requests/${id}/${action}`, {});
            toast(res.data?.message || "Request updated.");
            fetchPayments();
            fetchEditRequests();
        } catch (error) { toast(error.response?.data?.message || "Unable to review request."); }
    };

    const fetchReverseRequests = async () => {
        if (!isApprover) return;
        try {
            const res = await api.get("/payments/reverse-requests");
            setReverseRequests(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Unable to load reverse requests:", error);
        }
    };

    const reversePayment = (payment) => {
        if (payment.status === "reversed") return;
        setReverseTarget(payment);
    };

    // Edit opens the existing PaymentForm modal in edit mode (prefilled).
    const openEditPayment = (payment) => {
        setEditPayment(payment);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditPayment(null);
        fetchPayments();
    };

    const confirmReverse = async (reason) => {
        if (!reverseTarget) return;
        setReversing(true);
        try {
            const res = await api.post(`/payments/${reverseTarget.id}/reverse`, { reason });
            toast(res.data?.message || (isApprover ? "Payment reversed successfully." : "Reverse request submitted for admin approval."));
            setReverseTarget(null);
            fetchPayments();
            fetchReverseRequests();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to reverse payment.");
        } finally {
            setReversing(false);
        }
    };

    const saveReason = async (reason) => {
        if (!reasonTarget) return;
        if (reason.length < 10 || /^(.)\1+$/.test(reason)) {
            toast("Please enter a clear reason (at least 10 characters).");
            return;
        }
        setSavingReason(true);
        try {
            const res = await api.put(`/payments/${reasonTarget.id}/void-reason`, { reason });
            toast(res.data?.message || "Reason updated.");
            setReasonTarget(null);
            fetchPayments();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to update reason.");
        } finally {
            setSavingReason(false);
        }
    };

    const reviewRequest = async (id, action) => {
        try {
            const res = await api.post(`/payments/reverse-requests/${id}/${action}`, {});
            toast(res.data?.message || "Request updated.");
            fetchPayments();
            fetchReverseRequests();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to review request.");
        }
    };

    return (
        <div className="dashboard p-cta-page">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>Payments</h2>
                            <p>Fee collection for <strong>{activeYear || "Active Academic Year"}</strong></p>
                        </div>
                        <button className="primary-btn" onClick={addPayment}>
                            + Collect Fee
                        </button>
                    </div>

                    <div className="payment-filters">
                        <input
                            type="text"
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Search student, roll number or class..."
                            className="search-input"
                        />
                        <select
                            name="className"
                            value={filters.className}
                            onChange={handleFilterChange}
                            className="filter-select"
                        >
                            <option value="All">All Classes</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.name}>
                                    {c.name.includes("LKG") || c.name.includes("UKG") ? c.name : `${c.name} Standard`}
                                </option>
                            ))}
                        </select>

                        <select
                            name="paymentMode"
                            value={filters.paymentMode}
                            onChange={handleFilterChange}
                            className="filter-select"
                        >
                            <option value="All">All Modes</option>
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                        </select>

                        <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="filter-date" />
                        <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="filter-date" />

                        <button className="clear-btn" onClick={clearFilters}>Clear</button>
                    </div>

                    {/* Tabs — Completed / Reversed / Reverse Requests (approvers only) */}
                    <div className="exam-tabbar" style={{ marginTop: "20px" }}>
                        <button
                            type="button"
                            className={`exam-tab ${paymentTab === "completed" ? "exam-tab-active" : ""}`}
                            onClick={() => setPaymentTab("completed")}
                        >
                            Completed <span className="exam-badge">{completedPayments.length}</span>
                        </button>
                        {isApprover && (
                            <button
                                type="button"
                                className={`exam-tab ${paymentTab === "reversed" ? "exam-tab-active" : ""}`}
                                onClick={() => setPaymentTab("reversed")}
                            >
                                Reversed <span className="exam-badge">{reversedPayments.length}</span>
                            </button>
                        )}
                        {isApprover && (
                            <button
                                type="button"
                                className={`exam-tab ${paymentTab === "requests" ? "exam-tab-active" : ""}`}
                                onClick={() => { setPaymentTab("requests"); fetchReverseRequests(); }}
                            >
                                Reverse Requests <span className="exam-badge">{reverseRequests.length}</span>
                            </button>
                        )}
                        {isApprover && (
                            <button
                                type="button"
                                className={`exam-tab ${paymentTab === "editRequests" ? "exam-tab-active" : ""}`}
                                onClick={() => { setPaymentTab("editRequests"); fetchEditRequests(); }}
                            >
                                Edit Requests <span className="exam-badge">{editRequests.length}</span>
                            </button>
                        )}
                    </div>

                    {paymentTab === "editRequests" && isApprover && (
                        <div className="settings-card" style={{ marginTop: "14px" }}>
                            <h3 style={{ margin: "0 0 12px 0" }}>Pending Edit Requests ({editRequests.length})</h3>
                            {editRequests.length === 0 ? (
                                <p style={{ color: "#64748B", fontSize: "13px" }}>No pending edit requests.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="compact-table stack-sm">
                                        <thead>
                                            <tr><th>Student</th><th>Current → Proposed</th><th>Reason</th><th>Requested by</th><th>Action</th></tr>
                                        </thead>
                                        <tbody>
                                            {editRequests.map((r) => (
                                                <tr key={r.id}>
                                                    <td data-label="Student">{r.studentName || "-"} {r.rollNumber ? `(Roll ${r.rollNumber})` : ""}</td>
                                                    <td data-label="Amount">₹{Number(r.currentAmount || 0).toLocaleString("en-IN")} → ₹{Number(r.proposedAmount || 0).toLocaleString("en-IN")}</td>
                                                    <td data-label="Reason">{r.reason || "-"}</td>
                                                    <td data-label="Requested by">{r.displayRequester || r.requestedByName || r.requestedBy || "-"}</td>
                                                    <td data-label="Action">
                                                        <button className="save-btn" onClick={() => reviewEditRequest(r.id, "approve")}>Approve</button>
                                                        <button className="cancel-btn" onClick={() => reviewEditRequest(r.id, "reject")}>Reject</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {paymentTab === "requests" && isApprover && (
                        <div className="settings-card" style={{ marginTop: "14px" }}>
                            <h3 style={{ margin: "0 0 12px 0" }}>Pending Reverse Requests ({reverseRequests.length})</h3>
                            {reverseRequests.length === 0 ? (
                                <p style={{ color: "#64748B", fontSize: "13px" }}>No pending reverse requests.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="compact-table stack-sm">
                                        <thead>
                                            <tr><th>Student</th><th>Amount</th><th>Requested by</th><th>Reason</th><th>Action</th></tr>
                                        </thead>
                                        <tbody>
                                            {reverseRequests.map((r) => (
                                                <tr key={r.id}>
                                                    <td data-label="Student">{r.studentName || "-"} {r.rollNumber ? `(Roll ${r.rollNumber})` : ""}</td>
                                                    <td data-label="Amount">₹{Number(r.amount || 0).toLocaleString("en-IN")}</td>
                                                    <td data-label="Requested by">{r.requestedByName || "-"}</td>
                                                    <td data-label="Reason">{r.reason || "-"}</td>
                                                    <td data-label="Action">
                                                        <button className="save-btn" onClick={() => reviewRequest(r.id, "approve")}>Approve</button>
                                                        <button className="cancel-btn" onClick={() => reviewRequest(r.id, "reject")}>Reject</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {paymentTab === "completed" && (
                        <div style={{ marginTop: "14px" }}>
                            <SummaryTable payments={completedPayments} onReverse={reversePayment} onEdit={openEditPayment} />
                        </div>
                    )}
                    {paymentTab === "reversed" && isApprover && (
                        <div style={{ marginTop: "14px" }}>
                            <SummaryTable payments={reversedPayments} onReverse={reversePayment} onEdit={openEditPayment} onEditReason={isApprover ? (p) => setReasonTarget(p) : undefined} />
                        </div>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="p-mobile-cta"
                onClick={addPayment}
                aria-label="Collect Fee"
            >
                ï¼‹ Collect Fee
            </button>

            {showForm && (
                <PaymentForm editPayment={editPayment} onClose={handleFormClose} onEdit={openEditPayment} isApprover={isApprover} />
            )}

            <PromptDialog
                open={!!reverseTarget}
                onClose={() => setReverseTarget(null)}
                onConfirm={confirmReverse}
                title={reverseTarget ? `Reverse payment #${reverseTarget.id}?` : ""}
                message={
                    reverseTarget
                        ? `Student: ${reverseTarget.studentName || "-"}\n` +
                          `Amount: â‚¹${Number(reverseTarget.amount || 0).toLocaleString("en-IN")}\n` +
                          `Academic year: ${reverseTarget.academicYearName || activeYear || "-"}`
                        : ""
                }
                multiline
                requireValue
                placeholder={isApprover ? "Clear reason, at least 10 characters (required)" : "Reason for requesting reversal (required)"}
                confirmLabel={isApprover ? "Reverse" : "Send Request"}
                busy={reversing}
            />

            <PromptDialog
                open={!!reasonTarget}
                onClose={() => setReasonTarget(null)}
                onConfirm={saveReason}
                title={reasonTarget ? `Fix reason for payment #${reasonTarget.id}` : ""}
                message={reasonTarget ? `Student: ${reasonTarget.studentName || "-"}\nAmount: ₹${Number(reasonTarget.amount || 0).toLocaleString("en-IN")}\nCurrent reason: ${reasonTarget.voidReason || "Not recorded"}` : ""}
                initialValue=""
                multiline
                requireValue
                placeholder="Write a clear reason, at least 10 characters"
                confirmLabel="Save reason"
                busy={savingReason}
            />
        </div>
    );
}

export default PaymentsPage;
