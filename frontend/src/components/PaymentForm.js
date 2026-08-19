import { useEffect, useState } from "react";
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
        "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"
    ];

    // =====================================================
    // LOAD
    // =====================================================
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
            const current = years.find(year => year.status === "active");
            setActiveYear(current || null);
        } catch (error) {
            console.error("Unable to load payment data:", error);
        }
    };

    // =====================================================
    // CLASS
    // =====================================================
    const handleClassChange = (e) => {
        const selectedClass = e.target.value;
        setFormData({
            ...formData,
            className: selectedClass,
            studentId: ""
        });
        setFeeSummary(null);

        if (!selectedClass) {
            setFilteredStudents([]);
            return;
        }

        const filtered = students.filter(
            student => String(student.className).toUpperCase() === String(selectedClass).toUpperCase()
        );
        setFilteredStudents(filtered);
    };

    // =====================================================
    // STUDENT
    // =====================================================
    const handleStudentChange = async (e) => {
        const studentId = e.target.value;
        setFormData({ ...formData, studentId });

        if (studentId) {
            await fetchFeeSummary(studentId);
        } else {
            setFeeSummary(null);
        }
    };

    // =====================================================
    // FEE SUMMARY
    // =====================================================
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

    // =====================================================
    // INPUT & SUBMIT
    // =====================================================
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

    const money = value =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    return (
        <div className="modal-overlay">
            <div className="payment-modal">
                <div className="modal-header">
                    <div>
                        <h2>Collect Fee</h2>
                        <p>Record a student fee payment</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="fee-summary" style={{ marginBottom: "18px" }}>
                    <div>
                        <span>Active Academic Year</span>
                        <strong>{activeYear?.name || "Not configured"}</strong>
                    </div>
                </div>

                <form className="payment-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Class</label>
                        <select value={formData.className} onChange={handleClassChange} required>
                            <option value="">Select Class</option>
                            {classes.map(className => (
                                <option key={className} value={className}>
                                    {className === "LKG" || className === "UKG" ? className : `${className} Standard`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Student</label>
                        <select value={formData.studentId} onChange={handleStudentChange} required disabled={!formData.className}>
                            <option value="">
                                {!formData.className
                                    ? "Select Class First"
                                    : filteredStudents.length === 0
                                        ? "No Students in this Class"
                                        : "Select Student"}
                            </option>
                            {filteredStudents.map(student => (
                                <option key={student.id} value={student.id}>
                                    {student.rollNumber ? `Roll ${student.rollNumber} - ` : ""}
                                    {student.studentName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* FEE SUMMARY SECTION */}
                    {formData.studentId && (
                        <div className="fee-summary">
                            <div className="fee-summary-header">
                                <div>
                                    <span className="fee-summary-label">Fee Account</span>
                                    <span className="fee-summary-subtitle">
                                        {feeSummary?.academicYear?.name || activeYear?.name || ""}
                                    </span>
                                </div>
                                {loadingSummary && <span>Loading...</span>}
                            </div>

                            {feeSummary && !loadingSummary ? (
                                <>
                                    <div className="fee-summary-grid">
                                        <div className="fee-summary-item">
                                            <span>Total Fee</span>
                                            <strong>{money(feeSummary.totalFee)}</strong>
                                        </div>
                                        <div className="fee-summary-item">
                                            <span>Total Paid</span>
                                            <strong className="fee-paid">{money(feeSummary.totalPaid)}</strong>
                                        </div>
                                        <div className="fee-summary-item remaining">
                                            <span>Remaining</span>
                                            <strong className="fee-remaining">{money(feeSummary.balance)}</strong>
                                        </div>
                                    </div>

                                    {/* COMPONENT BREAKDOWN */}
                                    <div style={{ marginTop: "15px" }}>
                                        {feeSummary.items && feeSummary.items.length > 0 ? (
                                            feeSummary.items.map(item => (
                                                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
                                                    <span>{item.componentName}</span>
                                                    <strong>{money(item.amount)}</strong>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: "10px", textAlign: "center", color: "#e74c3c", backgroundColor: "#fdf0ed", borderRadius: "5px" }}>
                                                <strong>No Fee Components Found</strong><br/>
                                                <span style={{ fontSize: "0.85rem" }}>Close this modal, go to the <b>Fee Management</b> page, and click "<b>Prepare Student Accounts</b>" to sync prices to this student.</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : !loadingSummary ? (
                                <div>Unable to load fee information.</div>
                            ) : null}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Payment Date</label>
                        <input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label>Amount</label>
                        <input type="number" name="amount" value={formData.amount} onChange={handleChange} min="1" step="0.01" placeholder="Enter amount" required />
                    </div>

                    <div className="form-group">
                        <label>Payment Mode</label>
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
                        <textarea name="remarks" rows="3" value={formData.remarks} onChange={handleChange} placeholder="Optional remarks..." />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn" disabled={loading || !activeYear || loadingSummary}>
                            {loading ? "Saving..." : "Collect Fee"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PaymentForm;