import { useEffect, useState, useMemo } from "react";
import api from "../services/api";

function PaymentForm({ onClose }) {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [feeSummary, setFeeSummary] = useState(null);
    const [activeYear, setActiveYear] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loading, setLoading] = useState(false);

    const [selectedComponents, setSelectedComponents] = useState({});

    const [formData, setFormData] = useState({
        className: "",
        studentId: "",
        paymentDate: new Date().toISOString().split("T")[0],
        amount: "",
        paymentMode: "Cash",
        remarks: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [studentResponse, yearResponse, classResponse] = await Promise.all([
                api.get("/students"),
                api.get("/fees/academic-years"),
                api.get("/classes")
            ]);

            setStudents(Array.isArray(studentResponse.data) ? studentResponse.data : []);
            setClasses(Array.isArray(classResponse.data) ? classResponse.data : []);
            
            const years = Array.isArray(yearResponse.data) ? yearResponse.data : [];
            const current = years.find((year) => year.status === "active");
            setActiveYear(current || null);
        } catch (error) {
            console.error("Unable to load payment data:", error);
        }
    };

    const handleClassChange = (e) => {
        const selectedClass = e.target.value;
        setFormData({ ...formData, className: selectedClass, studentId: "", amount: "" });
        setFeeSummary(null);
        setSelectedComponents({});

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
        setSelectedComponents({});

        if (studentId) {
            await fetchFeeSummary(studentId);
        } else {
            setFeeSummary(null);
        }
    };

    const fetchFeeSummary = async (studentId) => {
        try {
            setLoadingSummary(true);
            const res = await api.get(`/payments/history/student/${studentId}`);
            setFeeSummary(res.data);
        } catch (error) {
            console.error("Fee account error:", error);
            setFeeSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    };

    const selectedStudent = useMemo(() => {
        return students.find((s) => Number(s.id) === Number(formData.studentId)) || null;
    }, [students, formData.studentId]);

    // =====================================================
    // PRECISE COMPONENT-WISE LEDGER PARSER
    // =====================================================
    const parsedLedger = useMemo(() => {
        if (!feeSummary || !feeSummary.items) return null;

        const studentPrevDues = Number(selectedStudent?.previousDues || 0);
        const concession = Number(selectedStudent?.concessionAmount || 0);

        let totalTuitionAmount = 0;
        const rawAdditionalItems = [];

        feeSummary.items.forEach((item) => {
            const itemAmt = Number(item.amount || 0);
            if (itemAmt <= 0 || item.itemType === "carry_forward" || item.componentName?.toLowerCase().includes("previous")) return;

            const name = String(item.componentName || "").toLowerCase();
            const key = String(item.componentKey || "").toLowerCase();

            if (key.includes("tution") || key.includes("tuition") || name.includes("tution") || name.includes("tuition")) {
                totalTuitionAmount += itemAmt;
            } else {
                rawAdditionalItems.push({ name: item.componentName, amount: itemAmt });
            }
        });

        const netTuition = Math.max(0, totalTuitionAmount - concession);

        // Single tuition bucket (no term splitting). Legacy payments tagged with
        // "Term 1/2/3" are folded into the one "tuition fee" total.
        let paidMap = {
            "previous dues": 0,
            "tuition fee": 0
        };
        rawAdditionalItems.forEach(i => { paidMap[i.name.toLowerCase().trim()] = 0; });

        let unassignedLegacyPool = 0;

        (feeSummary.payments || []).forEach(p => {
            if (p.status === "reversed") return;
            if (Array.isArray(p.lineItems) && p.lineItems.length > 0) {
                p.lineItems.forEach(li => {
                    const cName = String(li.componentName || "").toLowerCase().trim();
                    const amt = Number(li.amount || 0);
                    if (cName.includes("previous")) {
                        paidMap["previous dues"] += amt;
                    } else if (cName.includes("tuition") || cName.includes("tution") || cName.includes("term")) {
                        paidMap["tuition fee"] += amt;
                    } else if (paidMap[cName] !== undefined) {
                        paidMap[cName] += amt;
                    } else {
                        paidMap[cName] = (paidMap[cName] || 0) + amt;
                    }
                });
            } else {
                unassignedLegacyPool += Number(p.amount || 0);
            }
        });

        if (unassignedLegacyPool > 0) {
            // Apply any legacy (un-itemized) payments to tuition, then additional
            // components, then previous dues.
            const tuitionRem = netTuition - (paidMap["tuition fee"] || 0);
            const takeTuition = Math.min(Math.max(0, tuitionRem), unassignedLegacyPool);
            if (takeTuition > 0) { paidMap["tuition fee"] += takeTuition; unassignedLegacyPool -= takeTuition; }

            rawAdditionalItems.forEach(item => {
                const n = item.name.toLowerCase().trim();
                const rem = item.amount - (paidMap[n] || 0);
                const take = Math.min(Math.max(0, rem), unassignedLegacyPool);
                if (take > 0) { paidMap[n] += take; unassignedLegacyPool -= take; }
            });

            const remPrev = studentPrevDues - (paidMap["previous dues"] || 0);
            const takePrev = Math.min(Math.max(0, remPrev), unassignedLegacyPool);
            if (takePrev > 0) { paidMap["previous dues"] += takePrev; unassignedLegacyPool -= takePrev; }
        }

        return {
            studentPrevDues, concession, netTuition,
            rawAdditionalItems, paidMap
        };
    }, [feeSummary, selectedStudent]);

    // =====================================================
    // BUILD CLEAN COMPONENT LIST (VANISHES IF PAID 100%)
    // =====================================================
    const componentBreakdown = useMemo(() => {
        if (!parsedLedger) return { tuition: null, additionalItems: [], previousDues: 0 };
        const { studentPrevDues, netTuition, rawAdditionalItems, paidMap } = parsedLedger;

        const prevDuesBal = Math.max(0, studentPrevDues - (paidMap["previous dues"] || 0));

        const tuitionPaid = paidMap["tuition fee"] || 0;
        const tuitionDue = Math.max(0, netTuition - tuitionPaid);
        const tuition = tuitionDue > 0
            ? { name: "Tuition Fee", total: netTuition, paid: tuitionPaid, amount: tuitionDue }
            : null;

        const additionalItems = rawAdditionalItems.map(item => {
            const paid = paidMap[item.name.toLowerCase().trim()] || 0;
            return { name: item.name, total: item.amount, amount: Math.max(0, item.amount - paid) };
        }).filter(i => i.amount > 0);

        return { previousDues: prevDuesBal, tuition, additionalItems };
    }, [parsedLedger]);

    // =====================================================
    // SETTLEMENT TRACKER CALCULATIONS
    // =====================================================
    const financialOverview = useMemo(() => {
        if (!parsedLedger) return null;
        const { studentPrevDues, netTuition, rawAdditionalItems, paidMap } = parsedLedger;

        const totalAssessedDemand = studentPrevDues + netTuition + rawAdditionalItems.reduce((s,i)=>s+i.amount, 0);
        const previouslyPaid = Number(feeSummary?.totalPaid || 0);
        const currentPayAmount = Number(formData.amount || 0);
        const currentBalanceDue = Math.max(0, totalAssessedDemand - previouslyPaid - currentPayAmount);

        const getNow = (name) => selectedComponents[name] || 0;

        const buckets = [
            { name: "Previous Dues", total: studentPrevDues, paid: (paidMap["previous dues"] || 0) + getNow("Previous Dues"), due: Math.max(0, studentPrevDues - ((paidMap["previous dues"] || 0) + getNow("Previous Dues"))), isPrevious: true },
            { name: "Tuition Fee", total: netTuition, paid: (paidMap["tuition fee"] || 0) + getNow("Tuition Fee"), due: Math.max(0, netTuition - ((paidMap["tuition fee"] || 0) + getNow("Tuition Fee"))) }
        ].filter(b => b.total > 0);

        return { totalAssessedDemand, previouslyPaid, currentBalanceDue, buckets };
    }, [parsedLedger, selectedComponents, feeSummary, formData.amount]);

    const handleToggleComponent = (componentName, maxAmount, isChecked) => {
        setSelectedComponents((prev) => {
            const updated = { ...prev };
            if (isChecked) {
                updated[componentName] = maxAmount;
            } else {
                delete updated[componentName];
            }
            const newTotal = Object.values(updated).reduce((sum, val) => sum + Number(val || 0), 0);
            setFormData((f) => ({ ...f, amount: newTotal > 0 ? String(newTotal) : "" }));
            return updated;
        });
    };

    const handleComponentAmountChange = (componentName, value, maxAllowed) => {
        let parsedVal = Number(value);
        if (parsedVal > maxAllowed) parsedVal = maxAllowed;
        if (parsedVal < 0) parsedVal = 0;

        setSelectedComponents((prev) => {
            const updated = { ...prev, [componentName]: parsedVal };
            // If they type 0, uncheck the box entirely
            if (parsedVal === 0) delete updated[componentName];
            const newTotal = Object.values(updated).reduce((sum, val) => sum + Number(val || 0), 0);
            setFormData((f) => ({ ...f, amount: newTotal > 0 ? String(newTotal) : "" }));
            return updated;
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!activeYear) return alert("There is no active academic year.");
        if (!formData.className || !formData.studentId) return alert("Please select a class and a student.");
        if (!formData.amount || Number(formData.amount) <= 0) return alert("Please check and specify amounts to collect.");

        const lineItems = Object.entries(selectedComponents)
            .filter(([_, amt]) => Number(amt) > 0)
            .map(([componentName, amount]) => ({
                componentName,
                amount: Number(amount)
            }));

        try {
            setLoading(true);
            await api.post("/payments", {
                studentId: formData.studentId,
                paymentDate: formData.paymentDate,
                amount: Number(formData.amount),
                paymentMode: formData.paymentMode,
                remarks: formData.remarks,
                lineItems: lineItems.length > 0 ? lineItems : undefined 
            });
            onClose();
        } catch (error) {
            console.error("Payment error:", error);
            alert(error.response?.data?.message || "Unable to save payment.");
        } finally {
            setLoading(false);
        }
    };

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="modal-overlay">
            <div className="payment-modal" style={{ maxWidth: "650px", maxHeight: "90vh", overflowY: "auto" }}>
                <div className="modal-header" style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10 }}>
                    <div>
                        <h2>Collect Fee</h2>
                        <p>Record itemized partial or full fee collections</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="fee-summary" style={{ marginBottom: "16px" }}>
                    <div><span>Active Academic Year</span><strong>{activeYear?.name || "Not configured"}</strong></div>
                </div>

                <form className="payment-form" onSubmit={handleSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Class *</label>
                            <select value={formData.className} onChange={handleClassChange} required>
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.name}>{c.name.includes("LKG") || c.name.includes("UKG") ? c.name : `${c.name} Standard`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Student *</label>
                            <select value={formData.studentId} onChange={handleStudentChange} required disabled={!formData.className}>
                                <option value="">{!formData.className ? "Select Class First" : filteredStudents.length === 0 ? "No Students" : "Select Student"}</option>
                                {filteredStudents.map((student) => (
                                    <option key={student.id} value={student.id}>{student.rollNumber ? `Roll ${student.rollNumber} - ` : ""}{student.studentName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {formData.studentId && (
                        <div className="fee-summary" style={{ marginTop: "10px" }}>
                            <div className="fee-summary-header">
                                <div><span className="fee-summary-label">Student Fee Ledger</span><span className="fee-summary-subtitle">{feeSummary?.academicYear?.name || activeYear?.name || ""}</span></div>
                                {loadingSummary && <span>Loading ledger...</span>}
                            </div>

                            {financialOverview && !loadingSummary && (
                                <>
                                    <div className="fee-summary-grid">
                                        <div className="fee-summary-item"><span>Total Demand</span><strong>{money(financialOverview.totalAssessedDemand)}</strong></div>
                                        <div className="fee-summary-item"><span>Paid Till Date</span><strong className="fee-paid">{money(financialOverview.previouslyPaid)}</strong></div>
                                        <div className="fee-summary-item remaining"><span>Current Due</span><strong className="fee-remaining">{money(financialOverview.currentBalanceDue)}</strong></div>
                                    </div>

                                    <div style={{ marginTop: "14px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Settlement Tracker</span>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "6px" }}>
                                            {financialOverview.buckets.map((item, idx) => (
                                                <div key={idx} style={{ padding: "8px", borderRadius: "6px", border: "1px solid", borderColor: item.due === 0 && item.total > 0 ? "#86EFAC" : item.isPrevious ? "#BFDBFE" : "#E2E8F0", backgroundColor: item.due === 0 && item.total > 0 ? "#F0FDF4" : item.isPrevious ? "#EFF6FF" : "#F8FAFC" }}>
                                                    <div style={{ fontSize: "10px", fontWeight: "700", color: item.isPrevious ? "#1E40AF" : "#64748B" }}>{item.name.toUpperCase()}</div>
                                                    <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "2px" }}>{money(item.total)}</div>
                                                    <div style={{ fontSize: "11px", color: item.due === 0 && item.total > 0 ? "#16A34A" : "#DC2626", marginTop: "2px" }}>{item.due === 0 && item.total > 0 ? "✓ Cleared" : `Due: ${money(item.due)}`}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CHECKBOXES WITH CUSTOM PARTIAL PAYMENT INPUTS */}
                                    <div style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Select Fees To Collect (Customizable)</span>

                                        {componentBreakdown.previousDues > 0 && (
                                            <div style={{ marginTop: "8px", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px", border: "1px solid #fecaca", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                                    <input type="checkbox" checked={selectedComponents["Previous Dues"] !== undefined} onChange={(e) => handleToggleComponent("Previous Dues", componentBreakdown.previousDues, e.target.checked)} />
                                                    <strong style={{ fontSize: "12px", color: "#b91c1c" }}>Previous Dues (Carry Forward)</strong>
                                                </label>
                                                {selectedComponents["Previous Dues"] !== undefined ? (
                                                    <input type="number" value={selectedComponents["Previous Dues"]} onChange={(e) => handleComponentAmountChange("Previous Dues", e.target.value, componentBreakdown.previousDues)} style={{ width: "85px", padding: "2px 4px", fontSize: "12px", textAlign: "right" }} />
                                                ) : (
                                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#b91c1c" }}>{money(componentBreakdown.previousDues)}</span>
                                                )}
                                            </div>
                                        )}

                                        {componentBreakdown.tuition && (
                                            <div style={{ marginTop: "10px", background: selectedComponents["Tuition Fee"] !== undefined ? "#f0fdf4" : "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                                    <input type="checkbox" checked={selectedComponents["Tuition Fee"] !== undefined} onChange={(e) => handleToggleComponent("Tuition Fee", componentBreakdown.tuition.amount, e.target.checked)} />
                                                    <strong style={{ fontSize: "12px", color: "#15803d" }}>Tuition Fee</strong>
                                                </label>
                                                {selectedComponents["Tuition Fee"] !== undefined ? (
                                                    <input type="number" value={selectedComponents["Tuition Fee"]} onChange={(e) => handleComponentAmountChange("Tuition Fee", e.target.value, componentBreakdown.tuition.amount)} style={{ width: "85px", padding: "2px 4px", fontSize: "12px", textAlign: "right" }} />
                                                ) : (
                                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803d" }}>{money(componentBreakdown.tuition.amount)}</span>
                                                )}
                                            </div>
                                        )}

                                        {componentBreakdown.additionalItems.length > 0 && (
                                            <div style={{ marginTop: "12px" }}>
                                                <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "6px" }}>ADDITIONAL COMPONENTS</div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                                    {componentBreakdown.additionalItems.map((comp, idx) => (
                                                        <div key={idx} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: selectedComponents[comp.name] !== undefined ? "#f0fdf4" : "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                                                                <input type="checkbox" checked={selectedComponents[comp.name] !== undefined} onChange={(e) => handleToggleComponent(comp.name, comp.amount, e.target.checked)} />
                                                                {comp.name}
                                                            </label>
                                                            {selectedComponents[comp.name] !== undefined ? (
                                                                <input type="number" value={selectedComponents[comp.name]} onChange={(e) => handleComponentAmountChange(comp.name, e.target.value, comp.amount)} style={{ width: "75px", padding: "2px 4px", fontSize: "12px", textAlign: "right" }} />
                                                            ) : (
                                                                <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>{money(comp.amount)}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
                        <div className="form-group">
                            <label>Payment Date *</label>
                            <input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Amount (₹) *</label>
                            <input type="number" name="amount" value={formData.amount} readOnly style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed", fontWeight: "bold" }} placeholder="Auto-calculated from checkboxes" required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Payment Mode *</label>
                        <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
                            <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Remarks</label>
                        <textarea name="remarks" rows="2" value={formData.remarks} onChange={handleChange} placeholder="Optional notes..." />
                    </div>

                    <div className="modal-actions" style={{ marginTop: "18px" }}>
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn" disabled={loading || !activeYear || loadingSummary || Number(formData.amount) <= 0}>
                            {loading ? "Recording..." : "Collect Fee"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PaymentForm;