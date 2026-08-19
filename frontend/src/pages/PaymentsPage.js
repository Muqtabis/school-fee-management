import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PaymentForm from "../components/PaymentForm";
import SummaryTable from "../components/SummaryTable";
import api from "../services/api";

function PaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [filters, setFilters] = useState({
        search: "",
        className: "All",
        paymentMode: "All",
        dateFrom: "",
        dateTo: ""
    });
    const [activeYear, setActiveYear] = useState("");

    const classes = [
        "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"
    ];

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        await Promise.all([
            fetchPayments(),
            fetchActiveYear()
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

    const reversePayment = async (payment) => {
        if (payment.status === "reversed") return;

        const reason = window.prompt(`Why are you reversing payment #${payment.id}?`);
        if (!reason || !reason.trim()) return;

        const confirmed = window.confirm(
            `Reverse payment #${payment.id}?\n\n` +
            `Student: ${payment.studentName || "-"}\n` +
            `Amount: ₹${Number(payment.amount || 0).toLocaleString("en-IN")}\n\n` +
            `Academic Year: ${payment.academicYearName || activeYear || "-"}\n\n` +
            `Reason: ${reason.trim()}`
        );

        if (!confirmed) return;

        try {
            await api.post(`/payments/${payment.id}/reverse`, { reason: reason.trim() });
            fetchPayments();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to reverse payment.");
        }
    };

    return (
        <div className="dashboard">
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
                            {classes.map(className => (
                                <option key={className} value={className}>
                                    {className === "LKG" || className === "UKG" ? className : `${className} Standard`}
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

            {showForm && (
                <PaymentForm onClose={() => {
                    setShowForm(false);
                    fetchPayments();
                }} />
            )}
        </div>
    );
}

export default PaymentsPage;