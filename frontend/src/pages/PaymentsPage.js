import { toast } from "../services/notify";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PaymentForm from "../components/PaymentForm";
import PromptDialog from "../components/PromptDialog";
import SummaryTable from "../components/SummaryTable";
import api from "../services/api";

function PaymentsPage() {
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

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        await Promise.all([
            fetchPayments(),
            fetchActiveYear(),
            fetchClasses() // Fetching dynamic classes concurrently
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
    const [reversing, setReversing] = useState(false);

    const reversePayment = (payment) => {
        if (payment.status === "reversed") return;
        setReverseTarget(payment);
    };

    const confirmReverse = async (reason) => {
        if (!reverseTarget) return;
        setReversing(true);
        try {
            await api.post(`/payments/${reverseTarget.id}/reverse`, { reason });
            setReverseTarget(null);
            fetchPayments();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to reverse payment.");
        } finally {
            setReversing(false);
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

                    <SummaryTable payments={payments} onReverse={reversePayment} />
                </div>
            </div>

            <button
                type="button"
                className="p-mobile-cta"
                onClick={addPayment}
                aria-label="Collect Fee"
            >
                ＋ Collect Fee
            </button>

            {showForm && (
                <PaymentForm onClose={() => {
                    setShowForm(false);
                    fetchPayments();
                }} />
            )}

            <PromptDialog
                open={!!reverseTarget}
                onClose={() => setReverseTarget(null)}
                onConfirm={confirmReverse}
                title={reverseTarget ? `Reverse payment #${reverseTarget.id}?` : ""}
                message={
                    reverseTarget
                        ? `Student: ${reverseTarget.studentName || "-"}\n` +
                          `Amount: ₹${Number(reverseTarget.amount || 0).toLocaleString("en-IN")}\n` +
                          `Academic year: ${reverseTarget.academicYearName || activeYear || "-"}`
                        : ""
                }
                multiline
                requireValue
                placeholder="Reason for reversing (required)"
                confirmLabel="Reverse"
                busy={reversing}
            />
        </div>
    );
}

export default PaymentsPage;