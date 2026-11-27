import { toast } from "../services/notify";
import { useEffect, useState, useMemo, useRef } from "react";
import api from "../services/api";
import useModalBehavior from "./useModalBehavior";
import { printReceipt } from "../utils/receipt";

function PaymentForm({ onClose, editPayment, onEdit, isApprover }) {
    const [editLineItems, setEditLineItems] = useState([]);
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [feeSummary, setFeeSummary] = useState(null);
    const [activeYear, setActiveYear] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loading, setLoading] = useState(false);
    // After a successful save the form stays open and shows the saved receipts.
    const [savedReceipts, setSavedReceipts] = useState([]);
    const [editReason, setEditReason] = useState("");
    const [editRequestSent, setEditRequestSent] = useState(false);

    const [selectedComponents, setSelectedComponents] = useState({});

    const [formData, setFormData] = useState({
        className: "",
        studentId: "",
        paymentDate: new Date().toISOString().split("T")[0],
        amount: "",
        paymentMode: "",
        remarks: ""
    });

    // Per-component mode/date/ref for multi-mode payments
    const [componentDetails, setComponentDetails] = useState({});

    // "Multiple Payments" mode: collect several payments for this student
    // in one go, each entry with its own component/amount/mode/date/ref.
    // Entries on different dates are submitted as separate payments so
    // each date gets its own receipt.
    const [multiMode, setMultiMode] = useState(false);
    const [multiEntries, setMultiEntries] = useState([]);
    const entrySeq = useRef(0);

    useEffect(() => {
        loadData();
    }, []);

    // EDIT MODE: prefill the FULL form from the payment being edited,
    // including its saved fee components (so the receipt components and
    // the total can be corrected together).
    useEffect(() => {
        if (!editPayment) return;
        (async () => {
            let items = [];
            try {
                const res = await api.get(`/payments/receipt/${editPayment.id}`);
                items = Array.isArray(res.data?.lineItems) ? res.data.lineItems : [];
            } catch (e) {
                console.error("Unable to load payment components:", e);
            }
            setEditLineItems(items);
            const selected = {};
            const details = {};
            items.forEach((li) => {
                const name = li.componentName || "Fee";
                selected[name] = Number(li.amount || 0);
                details[name] = {
                    mode: li.mode || "Cash",
                    paidOn: li.paidOn ? String(li.paidOn).slice(0, 10) : (editPayment.paymentDate || "").slice(0, 10),
                    reference: li.reference || "",
                    remark: li.remark || ""
                };
            });
            setSelectedComponents(selected);
            setComponentDetails(details);
            const total = items.reduce((s, li) => s + Number(li.amount || 0), 0);
            setFormData({
                className: editPayment.className || "",
                studentId: String(editPayment.studentId || ""),
                paymentDate: editPayment.paymentDate ? String(editPayment.paymentDate).slice(0, 10) : new Date().toISOString().split("T")[0],
                amount: String(total || editPayment.amount || ""),
                paymentMode: editPayment.paymentMode || "Cash",
                remarks: editPayment.remarks || ""
            });
            setFilteredStudents(students.filter(
                (s) => String(s.className).toUpperCase() === String(editPayment.className).toUpperCase()
            ));
            // Load the fee ledger so the full component list is available
            try {
                const hist = await api.get(`/payments/history/student/${editPayment.studentId}`);
                setFeeSummary(hist.data);
            } catch (e) {
                console.error("Fee account error:", e);
            }
        })();
    }, [editPayment, students]);

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
        setMultiEntries([]);

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
        setMultiEntries([]);

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

        const studentPrevDues = Math.max(0, Number(selectedStudent?.previousDues || 0) - Number(selectedStudent?.previousDuesConcession || 0));
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

        // Concession reduces the whole fee, not just tuition. Apply it to
        // tuition first, then to the remaining components, so the payable
        // ledger matches max(0, total items - concession) used everywhere else.
        let concessionLeft = Math.max(0, concession);
        const tuitionTake = Math.min(concessionLeft, totalTuitionAmount);
        const netTuition = Math.max(0, totalTuitionAmount - tuitionTake);
        concessionLeft -= tuitionTake;
        rawAdditionalItems.forEach((item) => {
            const take = Math.min(concessionLeft, Number(item.amount || 0));
            item.amount = Number(item.amount || 0) - take;
            concessionLeft -= take;
        });

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
                        // Unrecognised line items (e.g. "Fee Collection (TC)")
                        // go into the shared pool and are allocated below.
                        unassignedLegacyPool += amt;
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
            studentPrevDues, concession, totalTuitionAmount, netTuition,
            rawAdditionalItems, paidMap
        };
    }, [feeSummary, selectedStudent]);

    // =====================================================
    // BUILD CLEAN COMPONENT LIST (VANISHES IF PAID 100%)
    // =====================================================
    const componentBreakdown = useMemo(() => {
        // EDIT MODE: keep every original component editable (even if fully
        // paid), but allow raising it up to what the student actually owes —
        // the ledger's outstanding amount, not the old line-item amount.
        if (editPayment) {
            const ledger = parsedLedger || {
                studentPrevDues: Math.max(0, Number(selectedStudent?.previousDues || 0) - Number(selectedStudent?.previousDuesConcession || 0)),
                netTuition: 0, rawAdditionalItems: [], paidMap: {}
            };
            const capFor = (name, original) => {
                const lower = String(name).toLowerCase();
                let outstanding = 0;
                if (lower.includes("previous")) outstanding = ledger.studentPrevDues || 0;
                else if (lower.includes("tuition") || lower.includes("tution") || lower.includes("term")) outstanding = ledger.netTuition || 0;
                else {
                    const found = (ledger.rawAdditionalItems || []).find((i) => String(i.name).toLowerCase() === lower);
                    outstanding = found ? Number(found.amount || 0) : 0;
                }
                return Math.max(Number(original || 0), Number(outstanding || 0));
            };
            let prev = 0;
            let tuition = null;
            const additional = [];
            editLineItems.forEach((li) => {
                const name = li.componentName || "Fee";
                const amt = Number(li.amount || 0);
                const cap = capFor(name, amt);
                const lower = name.toLowerCase();
                if (lower.includes("previous")) {
                    prev = cap;
                } else if (lower.includes("tuition") || lower.includes("tution") || lower.includes("term")) {
                    tuition = { name, total: cap, paid: 0, amount: cap };
                } else {
                    additional.push({ name, total: cap, amount: cap });
                }
            });
            return { previousDues: prev, tuition, additionalItems: additional };
        }
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
    }, [parsedLedger, editPayment, editLineItems]);

    // Collectible components with their current due amounts (used by the
    // Multiple-Payments entry editor).
    const duesMap = useMemo(() => {
        const map = {};
        if (componentBreakdown.previousDues > 0) map["Previous Dues"] = componentBreakdown.previousDues;
        if (componentBreakdown.tuition) map["Tuition Fee"] = componentBreakdown.tuition.amount;
        componentBreakdown.additionalItems.forEach((i) => { map[i.name] = i.amount; });
        return map;
    }, [componentBreakdown]);

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
                // Initialize per-component details with defaults
                setComponentDetails((cd) => ({
                    ...cd,
                    [componentName]: {
                        mode: "Cash",
                        paidOn: formData.paymentDate,
                        reference: "",
                        remark: ""
                    }
                }));
            } else {
                delete updated[componentName];
                setComponentDetails((cd) => {
                    const copy = { ...cd };
                    delete copy[componentName];
                    return copy;
                });
            }
            const newTotal = Object.values(updated).reduce((sum, val) => sum + Number(val || 0), 0);
            setFormData((f) => ({ ...f, amount: newTotal > 0 ? String(newTotal) : "" }));
            return updated;
        });
    };

    const getCompDetail = (compName, field, defaultVal) => {
        if (componentDetails[compName] && componentDetails[compName][field] !== undefined) {
            return componentDetails[compName][field];
        }
        return defaultVal;
    };

    const updateCompDetail = (compName, field, val) => {
        setComponentDetails((prev) => ({
            ...prev,
            [compName]: {
                mode: "Cash",
                paidOn: formData.paymentDate,
                reference: "",
                remark: "",
                ...(prev[compName] || {}),
                [field]: val
            }
        }));
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

    // =====================================================
    // MULTIPLE-PAYMENTS ENTRIES
    // Each entry is one payment: component + amount + mode +
    // date + reference. Same component can be added several
    // times (e.g. tuition split over weeks).
    // =====================================================
    const remainingFor = (componentName) => {
        const due = duesMap[componentName] || 0;
        const used = multiEntries
            .filter((e) => e.component === componentName)
            .reduce((s, e) => s + Number(e.amount || 0), 0);
        return Math.max(0, due - used);
    };

    const commitEntries = (next) => {
        setMultiEntries(next);
        const total = next.reduce((s, e) => s + Number(e.amount || 0), 0);
        setFormData((f) => ({ ...f, amount: total > 0 ? String(total) : "" }));
    };

    const addEntry = (componentName) => {
        if (!componentName) return;
        const remaining = remainingFor(componentName);
        if (remaining <= 0) return toast(`${componentName} is already fully covered by the entries below.`);
        commitEntries([
            ...multiEntries,
            {
                id: ++entrySeq.current,
                component: componentName,
                amount: String(remaining),
                mode: "Cash",
                date: formData.paymentDate,
                ref: ""
            }
        ]);
    };

    const updateEntry = (id, field, val) => {
        commitEntries(multiEntries.map((e) => {
            if (e.id !== id) return e;
            const next = { ...e, [field]: val };
            if (field === "amount") {
                let parsed = Number(val);
                if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;
                const due = duesMap[e.component] || 0;
                const others = multiEntries
                    .filter((x) => x.id !== id && x.component === e.component)
                    .reduce((s, x) => s + Number(x.amount || 0), 0);
                const cap = Math.max(0, due - others);
                if (parsed > cap) parsed = cap;
                next.amount = String(parsed);
            }
            return next;
        }));
    };

    const removeEntry = (id) => {
        commitEntries(multiEntries.filter((e) => e.id !== id));
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!activeYear) return toast("There is no active academic year.");
        if (!formData.className || !formData.studentId) return toast("Please select a class and a student.");
        if (!formData.amount || Number(formData.amount) <= 0) return toast("Please specify an amount.");

        // Build the fee entries (multi-entry mode uses the entries list;
        // normal + edit modes use the per-component checkboxes).
        const lineItems = multiMode && !editPayment
            ? multiEntries
                .filter((en) => en.component && Number(en.amount) > 0)
                .map((en) => ({
                    componentName: en.component,
                    amount: Number(en.amount),
                    mode: en.mode || "Cash",
                    paidOn: en.date || formData.paymentDate,
                    reference: en.ref || "",
                    remark: ""
                }))
            : Object.entries(selectedComponents)
                .filter(([_, amt]) => Number(amt) > 0)
                .map(([componentName, amount]) => {
                    const details = componentDetails[componentName] || {};
                    return {
                        componentName,
                        amount: Number(amount),
                        mode: details.mode || "Cash", // Default to Cash if not changed
                        paidOn: details.paidOn || formData.paymentDate,
                        reference: details.reference || "",
                        remark: details.remark || ""
                    };
                });

        // EDIT MODE: send the full form — including the edited fee components
        // — so the receipt rows and the total are corrected together.
        if (editPayment) {
            if (lineItems.length === 0) return toast("Please keep at least one fee component.");
            // Staff requests: the proposed amount is the single component so the
            // approved edit actually applies the new amount (not the old rows).
            const effectiveLineItems = !isApprover
                ? [{ componentName: editLineItems[0]?.componentName || "Fee Collection",
                     amount: Number(formData.amount || 0), mode: formData.paymentMode || "Cash",
                     paidOn: formData.paymentDate, reference: "", remark: "" }]
                : lineItems;
            const payload = {
                reason: editReason.trim(),
                amount: Number(formData.amount),
                paymentMode: formData.paymentMode,
                paymentDate: formData.paymentDate,
                remarks: formData.remarks,
                lineItems: effectiveLineItems
            };
            if (!isApprover && (payload.reason.length < 10 || /^(.)\1+$/.test(payload.reason))) {
                return toast("Please enter a clear reason (at least 10 characters).");
            }
            try {
                setLoading(true);
                // Approvers edit directly; staff submit a request for approval.
                const res = await api.post(
                    isApprover ? `/payments/${editPayment.id}/edit` : `/payments/${editPayment.id}/edit-request`,
                    payload
                );
                if (res.data?.requested) {
                    toast("Edit request submitted for admin approval.");
                    setSavedReceipts([]);
                    setEditRequestSent(true);
                } else {
                    toast("Payment edited successfully.");
                    setSavedReceipts([{ id: editPayment.id, amount: Number(formData.amount || 0), date: formData.paymentDate, mode: formData.paymentMode }]);
                }
            } catch (error) {
                toast(error.response?.data?.message || "Unable to edit payment.");
            } finally {
                setLoading(false);
            }
            return;
        }

        if (lineItems.length === 0) return toast("Please select at least one fee component to collect.");

        // Multi-entry validation: every entry needs a date, and the entries
        // for each component must not exceed what is still due.
        if (multiMode) {
            for (const li of lineItems) {
                if (!li.paidOn) return toast(`Enter a date for the ${li.componentName} entry.`);
            }
            const sums = {};
            lineItems.forEach((li) => { sums[li.componentName] = (sums[li.componentName] || 0) + li.amount; });
            for (const [comp, sum] of Object.entries(sums)) {
                const due = duesMap[comp] || 0;
                if (sum > due + 0.01) return toast(`${comp}: entries total ${money(sum)} but only ${money(due)} is due.`);
            }
        }

        // Group entries by date. Entries sharing a date become ONE payment
        // (one receipt); each different date becomes its own payment with
        // its own receipt.
        const groups = {};
        lineItems.forEach((li) => {
            (groups[li.paidOn] = groups[li.paidOn] || []).push(li);
        });
        const dates = Object.keys(groups).sort();

        try {
            setLoading(true);
            let recorded = 0;
            let lastError = null;
            const failedDates = [];
            const receipts = [];
            for (const date of dates) {
                const items = groups[date];
                const amount = items.reduce((s, li) => s + Number(li.amount || 0), 0);
                const modes = Array.from(new Set(items.map((i) => i.mode).filter(Boolean)));
                try {
                    const res = await api.post("/payments", {
                        studentId: formData.studentId,
                        paymentDate: date,
                        amount: Number(amount.toFixed(2)),
                        paymentMode: modes.length > 0 ? modes.join(", ") : "Cash",
                        remarks: formData.remarks,
                        lineItems: items
                    });
                    receipts.push({ id: res.data?.id, amount: Number(amount.toFixed(2)), date, mode: modes.join(", ") || "Cash" });
                    recorded++;
                } catch (err) {
                    lastError = err;
                    failedDates.push(date);
                }
            }

            if (recorded === 0) {
                toast(lastError?.response?.data?.message || "Unable to save payment.");
            } else {
                setSavedReceipts(receipts);
                if (failedDates.length > 0) {
                    toast(`${recorded} receipt(s) recorded. Could not record: ${failedDates.join(", ")} — please retry those.`);
                } else {
                    toast(`${recorded} receipt${recorded > 1 ? "s" : ""} recorded successfully.`);
                }
                fetchFeeSummary(formData.studentId);
                setMultiEntries([]);
                setSelectedComponents({});
                setFormData((f) => ({ ...f, amount: "" }));
            }
        } catch (error) {
            console.error("Payment error:", error);
            toast(error.response?.data?.message || "Unable to save payment.");
        } finally {
            setLoading(false);
        }
    };

    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Requirement 3: native-dialog behavior (Escape / backdrop /
    // focus trap / scroll lock) for this legacy overlay.
    const { overlayRef, contentRef, handleOverlayClick } = useModalBehavior(onClose);

    return (
        <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div ref={contentRef} className="payment-modal" role="dialog" aria-modal="true" style={{ maxWidth: "650px", maxHeight: "90vh", overflowY: "auto" }}>
                <div className="modal-header" style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10 }}>
                    <div>
                        <h2>{editPayment ? "Edit Payment" : "Collect Fee"}</h2>
                        <p>{editPayment ? `Correcting payment #${editPayment.id} (editable once)` : "Record itemized partial or full fee collections"}</p>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose}>✕</button>
                </div>

                {editPayment && !isApprover ? (
                    <form className="payment-form" onSubmit={handleSubmit} style={{ padding: "22px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                            <div style={{ padding: 14, borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Payment collected</span>
                                <div style={{ fontSize: 26, fontWeight: 700, color: "#17365d", marginTop: 6 }}>{money(editPayment.amount)}</div>
                                <small style={{ color: "#64748B" }}>Receipt #{editPayment.id} · {editPayment.paymentDate || "-"}</small>
                            </div>
                            <div style={{ padding: 14, borderRadius: 10, border: "1px solid #a9824b", background: "#f6f0e6" }}>
                                <label style={{ fontSize: 11, color: "#92400E", fontWeight: 700, textTransform: "uppercase" }}>Actual amount to collect *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="Enter corrected amount"
                                    style={{ width: "100%", marginTop: 6, padding: "8px 10px", fontSize: 16, borderRadius: 8, border: "1px solid #d8e1e8", boxSizing: "border-box" }}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label>Payment mode</label>
                            <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
                                {["Cash", "UPI", "Card", "Bank Transfer", "Cheque"].map((m) => <option key={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label>Date</label>
                            <input type="date" name="paymentDate" value={formData.paymentDate} onChange={handleChange} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label>Reason for edit * <span style={{ color: "#b91c1c" }}>(at least 10 characters)</span></label>
                            <textarea rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Wrong amount entered — please correct to the actual cash received" required />
                        </div>
                        {editRequestSent && (
                            <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", fontSize: 13 }}>
                                ✓ Edit request submitted. An admin/principal will review it.
                            </div>
                        )}
                        <div className="modal-actions" style={{ marginTop: 8 }}>
                            <button type="button" className="cancel-btn" onClick={onClose}>Close</button>
                            <button type="submit" className="save-btn" disabled={loading || Number(formData.amount) <= 0 || editReason.trim().length < 10}>
                                {loading ? "Sending..." : "Send Request"}
                            </button>
                        </div>
                    </form>
                ) : (
                <>
                {savedReceipts.length > 0 && (
                    <div style={{ margin: "14px 20px 0", padding: 14, borderRadius: 10, border: "1px solid #BBF7D0", background: "#F0FDF4" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <strong style={{ color: "#15803D", fontSize: 14 }}>✓ Payment recorded</strong>
                            <span style={{ fontSize: 12, color: "#15803D" }}>{savedReceipts.length} receipt{savedReceipts.length > 1 ? "s" : ""} saved — you can print now or close.</span>
                        </div>
                        {savedReceipts.map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #D1FAE5", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, color: "#475569" }}>Receipt #{r.id} · {money(r.amount)} · {r.date} · {r.mode}</span>
                                <button type="button" className="receipt-btn" onClick={() => printReceipt(r.id)}>🧾 Print Receipt</button>
                                {onEdit && <button type="button" className="edit-btn" onClick={() => onEdit({ id: r.id, studentId: formData.studentId, className: formData.className, paymentMode: r.mode, paymentDate: r.date })}>Edit</button>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="fee-summary" style={{ marginBottom: "16px" }}>
                    <div><span>Active Academic Year</span><strong>{activeYear?.name || "Not configured"}</strong></div>
                </div>

                <form className="payment-form" onSubmit={handleSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Class *</label>
                            <select value={formData.className} onChange={handleClassChange} required disabled={!!editPayment}>
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.name}>{c.name.includes("LKG") || c.name.includes("UKG") ? c.name : `${c.name} Standard`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Student *</label>
                            <select value={formData.studentId} onChange={handleStudentChange} required disabled={!formData.className || !!editPayment}>
                                <option value="">{!formData.className ? "Select Class First" : filteredStudents.length === 0 ? "No Students" : "Select Student"}</option>
                                {filteredStudents.map((student) => (
                                    <option key={student.id} value={student.id}>{student.rollNumber ? `Roll ${student.rollNumber} - ` : ""}{student.studentName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedStudent && (
                        <div style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: "600", color: "#0F172A" }}>{selectedStudent.studentName}</span>
                            <span style={{ color: "#475569" }}>Father: <strong style={{ color: "#0F172A" }}>{selectedStudent.fatherName || "—"}</strong></span>
                        </div>
                    )}

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
                                        {Number(selectedStudent?.concessionAmount || 0) > 0 && (
                                            <div className="fee-summary-item"><span>Concession</span><strong style={{ color: "#16A34A" }}>- {money(selectedStudent.concessionAmount)}</strong></div>
                                        )}
                                    </div>

                                    {/* READ-ONLY CONCESSION BREAKDOWN — shows how the
                                        concession reduces the standard tuition so the
                                        collector can see the real math. Not editable. */}
                                    {parsedLedger.concession > 0 && (
                                        <div style={{ marginTop: "12px", border: "1px solid #FDE68A", borderRadius: "6px", overflow: "hidden" }}>
                                            <div style={{ backgroundColor: "#FEF3C7", padding: "6px 12px", fontSize: "11px", fontWeight: "700", color: "#92400E", textTransform: "uppercase" }}>
                                                Fee Concession Applied (Read-only)
                                            </div>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ padding: "7px 12px", color: "#475569" }}>Standard Tuition Fee</td>
                                                        <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: "600", color: "#0F172A" }}>{money(parsedLedger.totalTuitionAmount)}</td>
                                                    </tr>
                                                    <tr style={{ backgroundColor: "#FFFBEB" }}>
                                                        <td style={{ padding: "7px 12px", color: "#92400E" }}>
                                                            Concession{selectedStudent?.concessionReason ? ` — ${selectedStudent.concessionReason}` : ""}
                                                        </td>
                                                        <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: "700", color: "#16A34A" }}>- {money(parsedLedger.concession)}</td>
                                                    </tr>
                                                    <tr style={{ borderTop: "1px solid #FDE68A" }}>
                                                        <td style={{ padding: "7px 12px", fontWeight: "700", color: "#0F172A" }}>Net Tuition Fee</td>
                                                        <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{money(parsedLedger.netTuition)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

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
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>{editPayment ? "Fee Components (edit amounts, dates & modes)" : "Select Fees To Collect"}</span>
                                            {!editPayment && (
                                                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
                                                    <input type="checkbox" checked={multiMode} onChange={(e) => { setMultiMode(e.target.checked); if (!e.target.checked) setMultiEntries([]); }} />
                                                    Multiple Payments
                                                </label>
                                            )}
                                        </div>
                                        {multiMode && (
                                            <div style={{ marginTop: "6px", fontSize: "11px", color: "#64748b" }}>
                                                Collect several payments in one go — each entry has its own date and mode. Entries on different dates are saved as separate payments, each with its own receipt.
                                            </div>
                                        )}

                                        {!multiMode && componentBreakdown.previousDues > 0 && (
                                            <div style={{ marginTop: "8px", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px", border: "1px solid #fecaca", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                                                {selectedComponents["Previous Dues"] !== undefined && (
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
                                                        <select value={getCompDetail("Previous Dues", "mode", "Cash")} onChange={(e) => updateCompDetail("Previous Dues", "mode", e.target.value)} style={{ padding: "2px 4px" }}>
                                                            <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                                                        </select>
                                                        <input type="date" value={getCompDetail("Previous Dues", "paidOn", formData.paymentDate)} onChange={(e) => updateCompDetail("Previous Dues", "paidOn", e.target.value)} style={{ padding: "2px 4px" }} />
                                                        <input type="text" placeholder="Ref/Remarks" value={getCompDetail("Previous Dues", "reference", "")} onChange={(e) => updateCompDetail("Previous Dues", "reference", e.target.value)} style={{ padding: "2px 4px" }} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {parsedLedger.concession > 0 && (
                                            <div style={{ marginTop: "10px", background: "#f0fdf4", padding: "8px 12px", borderRadius: "6px", border: "1px dashed #86EFAC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803d" }}>
                                                    🏷️ Concession Applied (not collectible){selectedStudent?.concessionReason ? ` — ${selectedStudent.concessionReason}` : ""}
                                                </span>
                                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#16A34A" }}>- {money(parsedLedger.concession)}</span>
                                            </div>
                                        )}

                                        {multiMode && (
                                            <div style={{ marginTop: "10px" }}>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                                                    {Object.entries(duesMap).map(([name, due]) => {
                                                        const remaining = remainingFor(name);
                                                        return (
                                                            <button key={name} type="button" onClick={() => addEntry(name)} disabled={remaining <= 0}
                                                                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: remaining > 0 ? "#f8fafc" : "#f1f5f9", cursor: remaining > 0 ? "pointer" : "not-allowed", fontSize: "11px", fontWeight: "600", color: remaining > 0 ? "#0F172A" : "#94a3b8" }}>
                                                                ＋ {name} — {money(remaining)} due
                                                            </button>
                                                        );
                                                    })}
                                                    {Object.keys(duesMap).length === 0 && (
                                                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Nothing pending to collect.</span>
                                                    )}
                                                </div>

                                                {multiEntries.map((entry) => (
                                                    <div key={entry.id} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#ffffff", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                                                            <select value={entry.component} onChange={(e) => updateEntry(entry.id, "component", e.target.value)} style={{ fontSize: "12px", fontWeight: "600", padding: "2px 4px", flex: 1 }}>
                                                                {Object.keys(duesMap).map((name) => <option key={name} value={name}>{name}</option>)}
                                                            </select>
                                                            <input type="number" value={entry.amount} onChange={(e) => updateEntry(entry.id, "amount", e.target.value)} style={{ width: "85px", padding: "2px 4px", fontSize: "12px", textAlign: "right" }} />
                                                            <button type="button" onClick={() => removeEntry(entry.id)} style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", fontSize: "14px", padding: "0 4px" }} title="Remove entry">✕</button>
                                                        </div>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
                                                            <select value={entry.mode} onChange={(e) => updateEntry(entry.id, "mode", e.target.value)} style={{ padding: "2px 4px" }}>
                                                                <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                                                            </select>
                                                            <input type="date" value={entry.date} onChange={(e) => updateEntry(entry.id, "date", e.target.value)} style={{ padding: "2px 4px" }} />
                                                            <input type="text" placeholder="Ref/Remarks" value={entry.ref} onChange={(e) => updateEntry(entry.id, "ref", e.target.value)} style={{ padding: "2px 4px" }} />
                                                        </div>
                                                    </div>
                                                ))}

                                                {multiEntries.length === 0 && (
                                                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>No entries yet — tap a fee above to add one. Tap the same fee again to add another payment for it.</div>
                                                )}
                                            </div>
                                        )}

                                        {!multiMode && componentBreakdown.tuition && (
                                            <div style={{ marginTop: "10px", background: selectedComponents["Tuition Fee"] !== undefined ? "#f0fdf4" : "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                                                {selectedComponents["Tuition Fee"] !== undefined && (
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
                                                        <select value={getCompDetail("Tuition Fee", "mode", "Cash")} onChange={(e) => updateCompDetail("Tuition Fee", "mode", e.target.value)} style={{ padding: "2px 4px" }}>
                                                            <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                                                        </select>
                                                        <input type="date" value={getCompDetail("Tuition Fee", "paidOn", formData.paymentDate)} onChange={(e) => updateCompDetail("Tuition Fee", "paidOn", e.target.value)} style={{ padding: "2px 4px" }} />
                                                        <input type="text" placeholder="Ref/Remarks" value={getCompDetail("Tuition Fee", "reference", "")} onChange={(e) => updateCompDetail("Tuition Fee", "reference", e.target.value)} style={{ padding: "2px 4px" }} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!multiMode && componentBreakdown.additionalItems.length > 0 && (
                                            <div style={{ marginTop: "12px" }}>
                                                <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "6px" }}>ADDITIONAL COMPONENTS</div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                                                    {componentBreakdown.additionalItems.map((comp, idx) => (
                                                        <div key={idx} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", background: selectedComponents[comp.name] !== undefined ? "#f0fdf4" : "#ffffff", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                                                            {selectedComponents[comp.name] !== undefined && (
                                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
                                                                    <select value={getCompDetail(comp.name, "mode", "Cash")} onChange={(e) => updateCompDetail(comp.name, "mode", e.target.value)} style={{ padding: "2px 4px" }}>
                                                                        <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                                                                    </select>
                                                                    <input type="date" value={getCompDetail(comp.name, "paidOn", formData.paymentDate)} onChange={(e) => updateCompDetail(comp.name, "paidOn", e.target.value)} style={{ padding: "2px 4px" }} />
                                                                    <input type="text" placeholder="Ref/Remarks" value={getCompDetail(comp.name, "reference", "")} onChange={(e) => updateCompDetail(comp.name, "reference", e.target.value)} style={{ padding: "2px 4px" }} />
                                                                </div>
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

                    <div className="form-group" style={{ marginTop: "14px" }}>
                        <label>Total Amount (₹) *</label>
                        <input type="number" name="amount" value={formData.amount} readOnly style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed", fontWeight: "bold" }} placeholder="Auto-calculated" required />
                    </div>

                    <div className="form-group">
                        <label>Remarks</label>
                        <textarea name="remarks" rows="2" value={formData.remarks} onChange={handleChange} placeholder="Optional notes..." />
                    </div>

                    {editPayment && (
                        <div className="form-group">
                            <label>Reason for edit {!isApprover && <span style={{ color: "#b91c1c" }}>* required, at least 10 characters</span>}</label>
                            <textarea
                                rows={2}
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                placeholder={isApprover ? "Optional reason for the audit log" : "e.g. Wrong amount entered — please correct to the actual cash received"}
                            />
                        </div>
                    )}

                    {editRequestSent && (
                        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", fontSize: 13 }}>
                            ✓ Edit request submitted. An admin/principal will review it — you can close this form.
                        </div>
                    )}

                    <div className="modal-actions" style={{ marginTop: "18px" }}>
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="save-btn" disabled={loading || !activeYear || (!editPayment && (loadingSummary || Number(formData.amount) <= 0))}>
                            {loading ? (editPayment ? "Saving..." : "Recording...") : (editPayment ? "Save Changes" : "Collect Fee")}
                        </button>
                    </div>
                </form>
                </>
                )}
            </div>
        </div>
    );
}

export default PaymentForm;