import { useEffect, useState, useMemo } from "react";
import api from "../services/api";

function StudentForm({ student, onClose }) {
    const [formData, setFormData] = useState({
        studentName: "",
        rollNumber: "",
        className: "",
        fatherName: "",
        contact1: "",
        previousDues: "",
        tuitionFee: "", // Stores Net Academic Fee (Standard Fee - Concession)
        concessionAmount: "",
        concessionReason: ""
    });

    const [classFeeStructures, setClassFeeStructures] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingFee, setFetchingFee] = useState(false);

    const classes = [
        "LKG", "UKG", 
    "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", 
    "5A", "5B", "6A", "6B", "7A", "7B", "8A", "8B", 
    "9A", "9B", "10A", "10B"
    ];

    // =====================================================
    // LOAD ACTIVE FEE STRUCTURES
    // =====================================================
    useEffect(() => {
        const loadFeeStructures = async () => {
            try {
                const yearsRes = await api.get("/fees/academic-years");
                const years = Array.isArray(yearsRes.data) ? yearsRes.data : [];
                const activeYear = years.find((y) => y.status === "active") || years[0];

                if (activeYear?.id) {
                    const structRes = await api.get("/fees/structures", {
                        params: { academicYearId: activeYear.id }
                    });
                    setClassFeeStructures(Array.isArray(structRes.data) ? structRes.data : []);
                }
            } catch (error) {
                console.error("Error loading fee structures:", error);
            }
        };

        loadFeeStructures();
    }, []);

    // =====================================================
    // LOAD STUDENT DATA ON EDIT
    // =====================================================
    useEffect(() => {
        if (student) {
            setFormData({
                studentName: student.studentName || "",
                rollNumber: student.rollNumber || "",
                className: student.className || "",
                fatherName: student.fatherName || "",
                contact1: student.contact1 || "",
                previousDues: student.previousDues || "",
                tuitionFee: student.tuitionFee || "",
                concessionAmount: student.concessionAmount || "",
                concessionReason: student.concessionReason || ""
            });
        } else {
            setFormData({
                studentName: "",
                rollNumber: "",
                className: "",
                fatherName: "",
                contact1: "",
                previousDues: "",
                tuitionFee: "",
                concessionAmount: "",
                concessionReason: ""
            });
        }
    }, [student]);

    // =====================================================
    // AUTO-POPULATE CLASS FEE ON CLASS SELECTION
    // =====================================================
    const handleClassChange = (e) => {
        const selectedClass = e.target.value;
        const matchingStructure = classFeeStructures.find(
            (s) => String(s.className).trim().toLowerCase() === String(selectedClass).trim().toLowerCase()
        );

        const standardAmount = matchingStructure ? Number(matchingStructure.totalAmount || 0) : 0;
        const concession = Number(formData.concessionAmount || 0);
        const netTuition = Math.max(0, standardAmount - concession);

        setFormData((prev) => ({
            ...prev,
            className: selectedClass,
            tuitionFee: standardAmount > 0 ? netTuition : prev.tuitionFee
        }));
    };

    // =====================================================
    // INPUT CHANGE WITH DYNAMIC CONCESSION CALCULATION
    // =====================================================
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "concessionAmount") {
            const matchingStructure = classFeeStructures.find(
                (s) => String(s.className).trim().toLowerCase() === String(formData.className).trim().toLowerCase()
            );
            const standardAmount = matchingStructure ? Number(matchingStructure.totalAmount || 0) : Number(formData.tuitionFee || 0);
            const concession = Number(value || 0);
            const netTuition = Math.max(0, standardAmount - concession);

            setFormData((prev) => ({
                ...prev,
                concessionAmount: value,
                tuitionFee: netTuition
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    // =====================================================
    // 4-PART TERM SPLIT CALCULATIONS
    // =====================================================
    const calculations = useMemo(() => {
        const matchingStructure = classFeeStructures.find(
            (s) => String(s.className).trim().toLowerCase() === String(formData.className).trim().toLowerCase()
        );

        const standardBase = matchingStructure
            ? Number(matchingStructure.totalAmount || 0)
            : Number(formData.tuitionFee || 0);

        const concession = Number(formData.concessionAmount || 0);
        const previous = Number(formData.previousDues || 0);
        const netAcademicFee = Math.max(0, standardBase - concession);

        // Divide Net Fee into 3 equal terms
        const term1 = Math.floor(netAcademicFee / 3);
        const term2 = Math.floor(netAcademicFee / 3);
        const term3 = netAcademicFee - (term1 + term2); // Balance remainder to term 3

        const totalPayable = previous + netAcademicFee;

        return {
            standardBase,
            concession,
            previous,
            netAcademicFee,
            term1,
            term2,
            term3,
            totalPayable
        };
    }, [formData.className, formData.tuitionFee, formData.concessionAmount, formData.previousDues, classFeeStructures]);

    const money = (value) =>
        `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    // =====================================================
    // SUBMIT
    // =====================================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.studentName.trim()) {
            alert("Please enter the student name.");
            return;
        }

        if (!formData.rollNumber.trim()) {
            alert("Please enter the roll number.");
            return;
        }

        if (!formData.className) {
            alert("Please select the class.");
            return;
        }

        try {
            setLoading(true);

            const payload = {
                studentName: formData.studentName.trim(),
                rollNumber: formData.rollNumber.trim(),
                className: formData.className,
                fatherName: formData.fatherName.trim(),
                contact1: formData.contact1.trim(),
                previousDues: Number(formData.previousDues || 0),
                tuitionFee: Number(calculations.netAcademicFee || formData.tuitionFee || 0),
                concessionAmount: Number(formData.concessionAmount || 0),
                concessionReason: formData.concessionReason.trim()
            };

            if (student) {
                await api.put(`/students/${student.id}`, payload);
            } else {
                await api.post("/students", payload);
            }

            onClose();
        } catch (error) {
            console.error("Student Save Error:", error);
            alert(error.response?.data?.message || "Unable to save student.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="student-modal" style={{ maxWidth: "680px" }}>
                {/* HEADER */}
                <div className="modal-header">
                    <div>
                        <h2>{student ? "Edit Student" : "Add Student"}</h2>
                        <p>{student ? "Update student profile & fee structure" : "Register student & configure fee terms"}</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* FORM */}
                <form className="student-form" onSubmit={handleSubmit}>
                    {/* STUDENT NAME & ROLL NO */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Student Name *</label>
                            <input
                                type="text"
                                name="studentName"
                                value={formData.studentName}
                                onChange={handleChange}
                                placeholder="Enter student name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Roll Number *</label>
                            <input
                                type="text"
                                name="rollNumber"
                                value={formData.rollNumber}
                                onChange={handleChange}
                                placeholder="Example: 101, 102..."
                                required
                            />
                        </div>
                    </div>

                    {/* CLASS & FATHER NAME */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Class *</label>
                            <select
                                name="className"
                                value={formData.className}
                                onChange={handleClassChange}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c} value={c}>
                                        {c === "LKG" || c === "UKG" ? c : `${c} Standard`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Father / Guardian Name</label>
                            <input
                                type="text"
                                name="fatherName"
                                value={formData.fatherName}
                                onChange={handleChange}
                                placeholder="Enter father's name"
                                required
                            />
                        </div>
                    </div>

                    {/* CONTACT */}
                    <div className="form-group">
                        <label>Contact Number *</label>
                        <input
                            type="tel"
                            name="contact1"
                            value={formData.contact1}
                            onChange={handleChange}
                            placeholder="Enter 10-digit mobile number"
                            required
                        />
                    </div>

                    {/* PREVIOUS DUES & CONCESSION SECTION */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                        <div className="form-group">
                            <label>Previous Dues (₹) <small style={{ color: "#64748b" }}>(Past Year Debt)</small></label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                name="previousDues"
                                value={formData.previousDues}
                                onChange={handleChange}
                                placeholder="₹0.00"
                            />
                        </div>

                        <div className="form-group">
                            <label>Negotiated Concession (₹) <small style={{ color: "#16A34A" }}>(Discount)</small></label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                name="concessionAmount"
                                value={formData.concessionAmount}
                                onChange={handleChange}
                                placeholder="₹0.00"
                            />
                        </div>
                    </div>

                    {Number(formData.concessionAmount) > 0 && (
                        <div className="form-group">
                            <label>Concession Reason / Remark</label>
                            <input
                                type="text"
                                name="concessionReason"
                                value={formData.concessionReason}
                                onChange={handleChange}
                                placeholder="e.g., Sibling discount, Management concession"
                            />
                        </div>
                    )}

                    {/* 4-PART TERM SPLIT LIVE SUMMARY BOX */}
                    <div style={{
                        marginTop: "16px",
                        padding: "14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>Standard Class Fee:</span>
                            <strong style={{ color: "#0F172A" }}>{money(calculations.standardBase)}</strong>
                        </div>

                        {calculations.concession > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#16A34A", fontSize: "13px" }}>
                                <span>Less Negotiated Concession:</span>
                                <strong>- {money(calculations.concession)}</strong>
                            </div>
                        )}

                        {/* 4-TERM GRID CARDS */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "10px" }}>
                            <div style={{ backgroundColor: "#EFF6FF", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                <small style={{ color: "#1E40AF", fontSize: "11px", fontWeight: "700" }}>PREVIOUS DUES</small>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#1E3A8A", marginTop: "4px" }}>
                                    {money(calculations.previous)}
                                </div>
                            </div>

                            <div style={{ backgroundColor: "#F1F5F9", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 1 FEE</small>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>
                                    {money(calculations.term1)}
                                </div>
                            </div>

                            <div style={{ backgroundColor: "#F1F5F9", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 2 FEE</small>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>
                                    {money(calculations.term2)}
                                </div>
                            </div>

                            <div style={{ backgroundColor: "#F1F5F9", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 3 FEE</small>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>
                                    {money(calculations.term3)}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: "12px",
                            paddingTop: "8px",
                            borderTop: "1px solid #CBD5E1",
                            fontWeight: "700"
                        }}>
                            <span style={{ color: "#0F172A" }}>Total Net Payable Demand:</span>
                            <span style={{ color: "#2563EB", fontSize: "15px" }}>{money(calculations.totalPayable)}</span>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="modal-actions" style={{ marginTop: "20px" }}>
                        <button type="button" className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="save-btn" disabled={loading}>
                            {loading ? "Saving..." : student ? "Update Student" : "Save Student"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default StudentForm;