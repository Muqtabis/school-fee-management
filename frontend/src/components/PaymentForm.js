import { useEffect, useState, useMemo } from "react";
import api from "../services/api";

function PaymentForm({ onClose }) {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [feeSummary, setFeeSummary] = useState(null);
    const [activeYear, setActiveYear] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        className: "",
        studentId: "",
        paymentDate: new Date().toISOString().split("T")[0],
        amount: "",
        paymentMode: "Cash",
        remarks: ""
    });

    const classes = [
        "LKG", "UKG", 
    "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", 
    "5A", "5B", "6A", "6B", "7A", "7B", "8A", "8B", 
    "9A", "9B", "10A", "10B"
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [studentResponse, yearResponse] = await Promise.all([
                api.get("/students"),
                api.get("/fees/academic-years")
            ]);

            setStudents(Array.isArray(studentResponse.data) ? studentResponse.data : []);
            const years = Array.isArray(yearResponse.data) ? yearResponse.data : [];
            const current = years.find((year) => year.status === "active");
            setActiveYear(current || null);
        } catch (error) {
            console.error("Unable to load payment data:", error);
        }
    };

    const handleClassChange = (e) => {
        const selectedClass = e.target.value;
        setFormData({
            ...formData,
            className: selectedClass,
            studentId: "",
            amount: ""
        });
        setFeeSummary(null);

        if (!selectedClass) {
            setFilteredStudents([]);
            return;
        }

        const filtered = students.filter(
            (student) => String(student.className).toUpperCase() === String(selectedClass).toUpperCase()
        );
        setFilteredStudents(filtered);
    };

    const handleStudentChange = async (e) => {
        const studentId = e.target.value;
        setFormData({ ...formData, studentId, amount: "" });

        if (studentId) {
            await fetchFeeSummary(studentId);
        } else {
            setFeeSummary(null);
        }
    };

    const fetchFeeSummary = async (studentId) => {
        try {
            setLoadingSummary(true);
            const res = await api.get(`/fees/student/${studentId}`);
            setFeeSummary(res.data);
        } catch (error) {
            console.error("Fee account error:", error);
            setFeeSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    };

    // Selected student object from students state
    const selectedStudent = useMemo(() => {
        return students.find((s) => Number(s.id) === Number(formData.studentId)) || null;
    }, [students, formData.studentId]);

    // =====================================================
    // REAL-TIME 4-PART FIFO SETTLEMENT CALCULATION
    // =====================================================
    const financialOverview = useMemo(() => {
        if (!selectedStudent && !feeSummary) return null;

        const studentPrevDues = Number(selectedStudent?.previousDues || 0);
        const studentConcession = Number(selectedStudent?.concessionAmount || 0);

        // Standard Class Base from API items or totalFee
        let standardBase = Number(feeSummary?.totalFee || 0);
        if (Array.isArray(feeSummary?.items) && feeSummary.items.length > 0) {
            standardBase = feeSummary.items.reduce((sum, item) => {
                if (item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) {
                    return sum;
                }
                return sum + Number(item.amount || 0);
            }, 0);
        }

        const netAcademicFee = Math.max(0, standardBase - studentConcession);
        const totalAssessedDemand = studentPrevDues + netAcademicFee;
        const previouslyPaid = Number(feeSummary?.totalPaid || 0);
        const currentPayAmount = Number(formData.amount || 0);
        const currentBalanceDue = Math.max(0, totalAssessedDemand - previouslyPaid);

        // 3-Term Academic Breakdown
        const term1Total = Math.floor(netAcademicFee / 3);
        const term2Total = Math.floor(netAcademicFee / 3);
        const term3Total = netAcademicFee - (term1Total + term2Total);

        // Cumulative Payment Pool for FIFO Waterfall
        let pool = previouslyPaid + currentPayAmount;

        const prevPaidSoFar = Math.min(studentPrevDues, pool);
        pool = Math.max(0, pool - studentPrevDues);

        const term1PaidSoFar = Math.min(term1Total, pool);
        pool = Math.max(0, pool - term1Total);

        const term2PaidSoFar = Math.min(term2Total, pool);
        pool = Math.max(0, pool - term2Total);

        const term3PaidSoFar = Math.min(term3Total, pool);

        const buckets = [
            {
                name: "Previous Dues",
                total: studentPrevDues,
                paid: prevPaidSoFar,
                due: Math.max(0, studentPrevDues - prevPaidSoFar),
                isPrevious: true
            },
            {
                name: "Term 1 Fee",
                total: term1Total,
                paid: term1PaidSoFar,
                due: Math.max(0, term1Total - term1PaidSoFar)
            },
            {
                name: "Term 2 Fee",
                total: term2Total,
                paid: term2PaidSoFar,
                due: Math.max(0, term2Total - term2PaidSoFar)
            },
            {
                name: "Term 3 Fee",
                total: term3Total,
                paid: term3PaidSoFar,
                due: Math.max(0, term3Total - term3PaidSoFar)
            }
        ];

        return {
            totalAssessedDemand,
            previouslyPaid,
            currentBalanceDue,
            studentPrevDues,
            studentConcession,
            buckets
        };
    }, [selectedStudent, feeSummary, formData.amount]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!activeYear) {
            alert("There is no active academic year.");
            return;
        }
        if (!formData.className || !formData.studentId) {
            alert("Please select a class and a student.");
            return;
        }
        if (!formData.amount || Number(formData.amount) <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        try {
            setLoading(true);
            await api.post("/payments", {
                studentId: formData.studentId,
                paymentDate: formData.paymentDate,
                amount: Number(formData.amount),
                paymentMode: formData.paymentMode,
                remarks: formData.remarks
            });
            onClose();
        } catch (error) {
            console.error("Payment error:", error);
            alert(error.response?.data?.message || "Unable to save payment.");
        } finally {
            setLoading(false);
        }
    };

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    return (
        <div className="modal-overlay">
            <div className="payment-modal" style={{ maxWidth: "650px" }}>
                <div className="modal-header">
                    <div>
                        <h2>Collect Fee</h2>
                        <p>Record a fee payment with 4-part term reconciliation</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="fee-summary" style={{ marginBottom: "16px" }}>
                    <div>
                        <span>Active Academic Year</span>
                        <strong>{activeYear?.name || "Not configured"}</strong>
                    </div>
                </div>

                <form className="payment-form" onSubmit={handleSubmit}>
                    {/* CLASS & STUDENT */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Class *</label>
                            <select value={formData.className} onChange={handleClassChange} required>
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c} value={c}>
                                        {c === "LKG" || c === "UKG" ? c : `${c} Standard`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Student *</label>
                            <select
                                value={formData.studentId}
                                onChange={handleStudentChange}
                                required
                                disabled={!formData.className}
                            >
                                <option value="">
                                    {!formData.className
                                        ? "Select Class First"
                                        : filteredStudents.length === 0
                                        ? "No Students in this Class"
                                        : "Select Student"}
                                </option>
                                {filteredStudents.map((student) => (
                                    <option key={student.id} value={student.id}>
                                        {student.rollNumber ? `Roll ${student.rollNumber} - ` : ""}
                                        {student.studentName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* DYNAMIC FEE SUMMARY & 4-PART SETTLEMENT */}
                    {formData.studentId && (
                        <div className="fee-summary" style={{ marginTop: "10px" }}>
                            <div className="fee-summary-header">
                                <div>
                                    <span className="fee-summary-label">Student Fee Ledger</span>
                                    <span className="fee-summary-subtitle">
                                        {feeSummary?.academicYear?.name || activeYear?.name || ""}
                                    </span>
                                </div>
                                {loadingSummary && <span>Loading ledger...</span>}
                            </div>

                            {financialOverview && !loadingSummary && (
                                <>
                                    <div className="fee-summary-grid">
                                        <div className="fee-summary-item">
                                            <span>Total Demand</span>
                                            <strong>{money(financialOverview.totalAssessedDemand)}</strong>
                                        </div>
                                        <div className="fee-summary-item">
                                            <span>Paid Till Date</span>
                                            <strong className="fee-paid">{money(financialOverview.previouslyPaid)}</strong>
                                        </div>
                                        <div className="fee-summary-item remaining">
                                            <span>Current Due</span>
                                            <strong className="fee-remaining">
                                                {money(financialOverview.currentBalanceDue)}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* 4-PART TERM ALLOCATION */}
                                    <div style={{ marginTop: "14px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                                            Installment Settlement Tracker
                                        </span>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "6px" }}>
                                            {financialOverview.buckets.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: "8px",
                                                        borderRadius: "6px",
                                                        border: "1px solid",
                                                        borderColor: item.due === 0 && item.total > 0 ? "#86EFAC" : item.isPrevious ? "#BFDBFE" : "#E2E8F0",
                                                        backgroundColor: item.due === 0 && item.total > 0 ? "#F0FDF4" : item.isPrevious ? "#EFF6FF" : "#F8FAFC"
                                                    }}
                                                >
                                                    <div style={{ fontSize: "10px", fontWeight: "700", color: item.isPrevious ? "#1E40AF" : "#64748B" }}>
                                                        {item.name.toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "2px" }}>
                                                        {money(item.total)}
                                                    </div>
                                                    <div style={{ fontSize: "11px", color: item.due === 0 && item.total > 0 ? "#16A34A" : "#DC2626", marginTop: "2px" }}>
                                                        {item.due === 0 && item.total > 0 ? "✓ Cleared" : `Due: ${money(item.due)}`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* PAYMENT INPUTS */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
                        <div className="form-group">
                            <label>Payment Date *</label>
                            <input
                                type="date"
                                name="paymentDate"
                                value={formData.paymentDate}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Amount (₹) *</label>
                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                min="1"
                                step="0.01"
                                placeholder="Enter payment amount"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Payment Mode *</label>
                        <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
                            <option>Cash</option>
                            <option>UPI</option>
                            <option>Card</option>
                            <option>Bank Transfer</option>
                            <option>Cheque</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Remarks</label>
                        <textarea
                            name="remarks"
                            rows="2"
                            value={formData.remarks}
                            onChange={handleChange}
                            placeholder="Optional notes or transaction reference ID..."
                        />
                    </div>

                    <div className="modal-actions" style={{ marginTop: "18px" }}>
                        <button type="button" className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="save-btn"
                            disabled={loading || !activeYear || loadingSummary}
                        >
                            {loading ? "Recording Payment..." : "Collect Fee"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PaymentForm;