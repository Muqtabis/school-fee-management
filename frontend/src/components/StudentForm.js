import { useEffect, useState, useMemo } from "react";
import api from "../services/api";

function StudentForm({ student, onClose }) {
    const [formData, setFormData] = useState({
        studentName: "",
        rollNumber: "",
        className: "",
        admissionNumber: "",
        satsNumber: "",
        gender: "",
        dob: "",
        fatherName: "",
        motherName: "",
        contact1: "",
        address: "",
        remark: "",
        previousDues: "",
        tuitionFee: "",
        concessionAmount: "",
        concessionReason: ""
    });

    const [classFeeStructures, setClassFeeStructures] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);

    const formatClass = (c) => {
        if (c.name) return c.name;
        const cName = c.className || "";
        const cSec = c.section || "";
        return cSec ? `${cName} ${cSec}`.trim() : cName.trim();
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const classRes = await api.get("/classes");
                setClasses(Array.isArray(classRes.data) ? classRes.data : []);

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
                console.error("Error loading initial form data:", error);
            }
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        if (student) {
            setFormData({
                studentName: student.studentName || "",
                rollNumber: student.rollNumber || "",
                className: student.className || "",
                admissionNumber: student.admissionNumber || "",
                satsNumber: student.satsNumber || "",
                gender: student.gender || "",
                dob: student.dob || "",
                fatherName: student.fatherName || "",
                motherName: student.motherName || "",
                contact1: student.contact1 || "",
                address: student.address || "",
                remark: student.remark || "",
                previousDues: student.previousDues || "",
                tuitionFee: student.tuitionFee || "",
                concessionAmount: student.concessionAmount || "",
                concessionReason: student.concessionReason || ""
            });
        }
    }, [student]);

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

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const calculations = useMemo(() => {
        const matchingStructure = classFeeStructures.find(
            (s) => String(s.className).trim().toLowerCase() === String(formData.className).trim().toLowerCase()
        );

        const standardBase = matchingStructure ? Number(matchingStructure.totalAmount || 0) : Number(formData.tuitionFee || 0);
        const concession = Number(formData.concessionAmount || 0);
        const previous = Number(formData.previousDues || 0);
        const netAcademicFee = Math.max(0, standardBase - concession);

        const term1 = Math.floor(netAcademicFee / 3);
        const term2 = Math.floor(netAcademicFee / 3);
        const term3 = netAcademicFee - (term1 + term2);
        const totalPayable = previous + netAcademicFee;

        return { standardBase, concession, previous, netAcademicFee, term1, term2, term3, totalPayable };
    }, [formData.className, formData.tuitionFee, formData.concessionAmount, formData.previousDues, classFeeStructures]);

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.studentName.trim() || !formData.rollNumber.trim() || !formData.className) {
            alert("Please fill in all required fields.");
            return;
        }

        try {
            setLoading(true);
            const payload = {
                ...formData,
                previousDues: Number(formData.previousDues || 0),
                tuitionFee: Number(calculations.netAcademicFee || formData.tuitionFee || 0),
                concessionAmount: Number(formData.concessionAmount || 0),
            };

            if (student) {
                await api.put(`/students/${student.id}`, payload);
            } else {
                await api.post("/students", payload);
            }

            onClose();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to save student.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="student-modal" style={{ maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
                <div className="modal-header" style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10 }}>
                    <div>
                        <h2>{student ? "Edit Student" : "Register New Student"}</h2>
                        <p>Complete profile details and configure standard fee assignments.</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form className="student-form" onSubmit={handleSubmit} style={{ padding: "20px" }}>
                    
                    {/* SECTION 1: ACADEMIC DETAILS */}
                    <h3 style={{ fontSize: "14px", color: "#475569", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px" }}>Academic Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                        <div className="form-group">
                            <label>Admission No.</label>
                            <input type="text" name="admissionNumber" value={formData.admissionNumber} onChange={handleChange} placeholder="e.g. ADM-2026" />
                        </div>
                        <div className="form-group">
                            <label>SATS No.</label>
                            <input type="text" name="satsNumber" value={formData.satsNumber} onChange={handleChange} placeholder="e.g. 123456" />
                        </div>
                        <div className="form-group">
                            <label>Roll Number *</label>
                            <input type="text" name="rollNumber" value={formData.rollNumber} onChange={handleChange} required />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "24px" }}>
                        <div className="form-group">
                            <label>Student Name *</label>
                            <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Class *</label>
                            <select name="className" value={formData.className} onChange={handleClassChange} required>
                                <option value="">Select Class</option>
                                {classes.map((c) => {
                                    const displayClass = formatClass(c);
                                    return <option key={c.id} value={displayClass}>{displayClass}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    {/* SECTION 2: PERSONAL DETAILS */}
                    <h3 style={{ fontSize: "14px", color: "#475569", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px" }}>Personal Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                        <div className="form-group">
                            <label>Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange}>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Date of Birth</label>
                            <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                        <div className="form-group">
                            <label>Father's Name</label>
                            <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Mother's Name</label>
                            <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "16px" }}>
                        <div className="form-group">
                            <label>Contact Number *</label>
                            <input type="tel" name="contact1" value={formData.contact1} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Home Address</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Full residential address" />
                        </div>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: "24px" }}>
                        <label>General Remarks</label>
                        <input type="text" name="remark" value={formData.remark} onChange={handleChange} placeholder="Any specific notes or medical remarks" />
                    </div>

                    {/* SECTION 3: FEE CONFIGURATION */}
                    <h3 style={{ fontSize: "14px", color: "#475569", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", marginBottom: "16px" }}>Fee Configuration</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Previous Dues (₹) <small style={{ color: "#64748B" }}>(Carry Forward)</small></label>
                            <input type="number" min="0" step="0.01" name="previousDues" value={formData.previousDues} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Negotiated Concession (₹) <small style={{ color: "#16A34A" }}>(Discount)</small></label>
                            <input type="number" min="0" step="0.01" name="concessionAmount" value={formData.concessionAmount} onChange={handleChange} />
                        </div>
                    </div>

                    {Number(formData.concessionAmount) > 0 && (
                        <div className="form-group" style={{ marginTop: "12px" }}>
                            <label>Concession Reason</label>
                            <input type="text" name="concessionReason" value={formData.concessionReason} onChange={handleChange} placeholder="e.g., Sibling discount, Management approval" required />
                        </div>
                    )}

                    <div style={{ marginTop: "20px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>Standard Class Fee:</span>
                            <strong style={{ color: "#0F172A", fontSize: "15px" }}>{money(calculations.standardBase)}</strong>
                        </div>

                        {calculations.concession > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "#16A34A", fontSize: "13px" }}>
                                <span>Less Negotiated Concession:</span>
                                <strong>- {money(calculations.concession)}</strong>
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "16px" }}>
                            <div style={{ backgroundColor: "#EFF6FF", padding: "10px", borderRadius: "6px", textAlign: "center", border: "1px solid #BFDBFE" }}>
                                <small style={{ color: "#1E40AF", fontSize: "11px", fontWeight: "700" }}>PREV DUES</small>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#1E3A8A", marginTop: "4px" }}>{money(calculations.previous)}</div>
                            </div>
                            <div style={{ backgroundColor: "#F1F5F9", padding: "10px", borderRadius: "6px", textAlign: "center", border: "1px solid #E2E8F0" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 1</small>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>{money(calculations.term1)}</div>
                            </div>
                            <div style={{ backgroundColor: "#F1F5F9", padding: "10px", borderRadius: "6px", textAlign: "center", border: "1px solid #E2E8F0" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 2</small>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>{money(calculations.term2)}</div>
                            </div>
                            <div style={{ backgroundColor: "#F1F5F9", padding: "10px", borderRadius: "6px", textAlign: "center", border: "1px solid #E2E8F0" }}>
                                <small style={{ color: "#475569", fontSize: "11px", fontWeight: "700" }}>TERM 3</small>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#334155", marginTop: "4px" }}>{money(calculations.term3)}</div>
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #CBD5E1", fontWeight: "700" }}>
                            <span style={{ color: "#0F172A", fontSize: "15px" }}>Total Net Payable Demand:</span>
                            <span style={{ color: "#2563EB", fontSize: "18px" }}>{money(calculations.totalPayable)}</span>
                        </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #E2E8F0", position: "sticky", bottom: 0, backgroundColor: "#fff", paddingBottom: "10px" }}>
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn" disabled={loading} style={{ padding: "10px 24px" }}>
                            {loading ? "Saving..." : student ? "Update Student" : "Save Student"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default StudentForm;