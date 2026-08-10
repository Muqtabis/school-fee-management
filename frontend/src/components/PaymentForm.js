import { useEffect, useState } from "react";
import api from "../services/api";

function PaymentForm({ payment, onClose }) {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);

    const [feeSummary, setFeeSummary] = useState(null);
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

    /*
    ====================================================
    CLASSES
    ====================================================
    */

    const classes = [
        "LKG",
        "UKG",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
    ];

    /*
    ====================================================
    FETCH STUDENTS
    ====================================================
    */

    useEffect(() => {
        fetchStudents();
    }, []);

    /*
    ====================================================
    LOAD PAYMENT WHEN EDITING
    ====================================================
    */

    useEffect(() => {
        if (payment && students.length > 0) {
            const selectedStudent = students.find(
                (student) =>
                    Number(student.id) === Number(payment.studentId)
            );

            setFormData({
                className: selectedStudent?.className || "",
                studentId: payment.studentId || "",
                paymentDate: payment.paymentDate || "",
                amount: payment.amount || "",
                paymentMode: payment.paymentMode || "Cash",
                remarks: payment.remarks || ""
            });

            if (selectedStudent) {
                fetchFeeSummary(selectedStudent.id);
            }
        }
    }, [payment, students]);

    /*
    ====================================================
    FETCH STUDENTS
    ====================================================
    */

    const fetchStudents = async () => {
        try {
            const res = await api.get("/students");

            setStudents(res.data);

        } catch (error) {
            console.error(
                "Unable to load students:",
                error
            );
        }
    };

    /*
    ====================================================
    FETCH STUDENT FEE SUMMARY
    ====================================================
    */

    const fetchFeeSummary = async (studentId) => {
        if (!studentId) {
            setFeeSummary(null);
            return;
        }

        try {
            setLoadingSummary(true);

            const res = await api.get(
                `/payments/history/student/${studentId}`
            );

            setFeeSummary(res.data);

        } catch (error) {
            console.error(
                "Unable to load fee summary:",
                error
            );

            setFeeSummary(null);

        } finally {
            setLoadingSummary(false);
        }
    };

    /*
    ====================================================
    HANDLE CLASS CHANGE
    ====================================================
    */

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
            (student) =>
                String(student.className).toUpperCase() ===
                String(selectedClass).toUpperCase()
        );

        setFilteredStudents(filtered);
    };

    /*
    ====================================================
    HANDLE STUDENT CHANGE
    ====================================================
    */

    const handleStudentChange = (e) => {
        const studentId = e.target.value;

        setFormData({
            ...formData,
            studentId
        });

        if (studentId) {
            fetchFeeSummary(studentId);
        } else {
            setFeeSummary(null);
        }
    };

    /*
    ====================================================
    HANDLE OTHER INPUTS
    ====================================================
    */

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    /*
    ====================================================
    HANDLE PAYMENT SUBMIT
    ====================================================
    */

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.className) {
            alert("Please select a class.");
            return;
        }

        if (!formData.studentId) {
            alert("Please select a student.");
            return;
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        try {
            setLoading(true);

            const paymentData = {
                studentId: formData.studentId,
                paymentDate: formData.paymentDate,
                amount: Number(formData.amount),
                paymentMode: formData.paymentMode,
                remarks: formData.remarks
            };

            if (payment) {
                await api.put(
                    `/payments/${payment.id}`,
                    paymentData
                );
            } else {
                await api.post(
                    "/payments",
                    paymentData
                );
            }

            onClose();

        } catch (error) {
            console.error(error);

            alert(
                error.response?.data?.message ||
                "Unable to save payment."
            );

        } finally {
            setLoading(false);
        }
    };

    /*
    ====================================================
    FORMAT CURRENCY
    ====================================================
    */

    const formatCurrency = (value) => {
        return `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    /*
    ====================================================
    RENDER
    ====================================================
    */

    return (
        <div className="modal-overlay">

            <div className="payment-modal">

                {/* =================================================
                    MODAL HEADER
                ================================================= */}

                <div className="modal-header">

                    <div>
                        <h2>
                            {payment
                                ? "Update Payment"
                                : "Collect Fee"}
                        </h2>

                        <p>
                            Record a student fee payment
                        </p>
                    </div>

                    <button
                        type="button"
                        className="close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>

                </div>

                {/* =================================================
                    PAYMENT FORM
                ================================================= */}

                <form
                    className="payment-form"
                    onSubmit={handleSubmit}
                >

                    {/* =================================================
                        CLASS
                    ================================================= */}

                    <div className="form-group">

                        <label>
                            Class
                        </label>

                        <select
                            name="className"
                            value={formData.className}
                            onChange={handleClassChange}
                            required
                        >

                            <option value="">
                                Select Class
                            </option>

                            {classes.map((className) => (
                                <option
                                    key={className}
                                    value={className}
                                >
                                    {className === "LKG" ||
                                    className === "UKG"
                                        ? className
                                        : `${className} Standard`}
                                </option>
                            ))}

                        </select>

                    </div>

                    {/* =================================================
                        STUDENT
                    ================================================= */}

                    <div className="form-group">

                        <label>
                            Student
                        </label>

                        <select
                            name="studentId"
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
                                <option
                                    key={student.id}
                                    value={student.id}
                                >
                                    {student.rollNumber
                                        ? `Roll ${student.rollNumber} - `
                                        : ""}
                                    {student.studentName}
                                </option>
                            ))}

                        </select>

                    </div>

                    {/* =================================================
                        FEE SUMMARY
                    ================================================= */}

                    {formData.studentId && (
                        <div className="fee-summary">

                            <div className="fee-summary-header">

                                <div>
                                    <span className="fee-summary-label">
                                        Fee Summary
                                    </span>

                                    <span className="fee-summary-subtitle">
                                        Current student account
                                    </span>
                                </div>

                                {loadingSummary && (
                                    <span className="fee-summary-loading">
                                        Loading...
                                    </span>
                                )}

                            </div>

                            {feeSummary && !loadingSummary ? (
                                <div className="fee-summary-grid">

                                    <div className="fee-summary-item">
                                        <span>
                                            Total Fee
                                        </span>

                                        <strong>
                                            {formatCurrency(
                                                feeSummary.totalFee
                                            )}
                                        </strong>
                                    </div>

                                    <div className="fee-summary-item">
                                        <span>
                                            Total Paid
                                        </span>

                                        <strong className="fee-paid">
                                            {formatCurrency(
                                                feeSummary.totalPaid
                                            )}
                                        </strong>
                                    </div>

                                    <div className="fee-summary-item remaining">
                                        <span>
                                            Remaining
                                        </span>

                                        <strong className="fee-remaining">
                                            {formatCurrency(
                                                feeSummary.balance
                                            )}
                                        </strong>
                                    </div>

                                </div>
                            ) : !loadingSummary ? (
                                <div className="fee-summary-error">
                                    Unable to load fee information.
                                </div>
                            ) : null}

                        </div>
                    )}

                    {/* =================================================
                        PAYMENT DATE
                    ================================================= */}

                    <div className="form-group">

                        <label>
                            Payment Date
                        </label>

                        <input
                            type="date"
                            name="paymentDate"
                            value={formData.paymentDate}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    {/* =================================================
                        AMOUNT
                    ================================================= */}

                    <div className="form-group">

                        <label>
                            Amount
                        </label>

                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            placeholder="Enter amount"
                            min="1"
                            required
                        />

                    </div>

                    {/* =================================================
                        PAYMENT MODE
                    ================================================= */}

                    <div className="form-group">

                        <label>
                            Payment Mode
                        </label>

                        <select
                            name="paymentMode"
                            value={formData.paymentMode}
                            onChange={handleChange}
                            required
                        >

                            <option value="Cash">
                                Cash
                            </option>

                            <option value="UPI">
                                UPI
                            </option>

                            <option value="Card">
                                Card
                            </option>

                            <option value="Bank Transfer">
                                Bank Transfer
                            </option>

                        </select>

                    </div>

                    {/* =================================================
                        REMARKS
                    ================================================= */}

                    <div className="form-group payment-remarks">

                        <label>
                            Remarks
                        </label>

                        <textarea
                            rows="3"
                            name="remarks"
                            value={formData.remarks}
                            onChange={handleChange}
                            placeholder="Optional payment remarks..."
                        />

                    </div>

                    {/* =================================================
                        ACTION BUTTONS
                    ================================================= */}

                    <div className="modal-actions">

                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="save-btn"
                            disabled={loading}
                        >
                            {loading
                                ? "Saving..."
                                : payment
                                ? "Update Payment"
                                : "Collect Fee"}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
}

export default PaymentForm;