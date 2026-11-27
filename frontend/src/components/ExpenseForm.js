import { toast } from "../services/notify";
import { useEffect, useState } from "react";

import api from "../services/api";

import useModalBehavior from "./useModalBehavior";

function ExpenseForm({
    expense,
    onClose,
    isApprover
}) {

    const [editReason, setEditReason] = useState("");
    const [editRequestSent, setEditRequestSent] = useState(false);

    const [formData, setFormData] =
        useState({

            expenseName: "",

            category: "Other",

            amount: "",

            expenseDate:
                new Date()
                    .toISOString()
                    .split("T")[0],

            paymentMode: "Cash",

            paidTo: "",

            description: ""

        });


    const [loading, setLoading] =
        useState(false);

    const [categories, setCategories] =
        useState([]);


    useEffect(() => {

        const loadCategories = async () => {
            try {
                const res = await api.get("/expenses/categories");
                setCategories(
                    Array.isArray(res.data)
                        ? res.data.map((c) => c.categoryName)
                        : []
                );
            } catch (error) {
                console.error("Unable to load categories:", error);
                setCategories([]);
            }
        };

        loadCategories();

    }, []);


    useEffect(() => {

        if (expense) {

            setFormData({

                expenseName:
                    expense.expenseName || "",

                category:
                    expense.category || "Other",

                amount:
                    expense.amount || "",

                expenseDate:
                    expense.expenseDate || "",

                paymentMode:
                    expense.paymentMode || "Cash",

                paidTo:
                    expense.paidTo || "",

                description:
                    expense.description || ""

            });

        }

    }, [expense]);


    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    const handleSubmit = async (e) => {

        e.preventDefault();

        if (expense) {
            // Approvers edit directly; staff send an edit request for approval.
            if (!isApprover && (editReason.trim().length < 10 || /^(.)\1+$/.test(editReason.trim()))) {
                toast("Please enter a clear reason (at least 10 characters).");
                return;
            }
            try {
                setLoading(true);
                const res = await api.post(
                    `/expenses/${expense.id}/edit-request`,
                    { ...formData, reason: editReason.trim() }
                );
                if (res.data?.requested) {
                    toast("Edit request submitted for admin approval.");
                    setEditRequestSent(true);
                } else {
                    toast("Payment edited successfully.");
                    onClose();
                }
            } catch (error) {
                toast(error.response?.data?.message || "Unable to edit payment.");
            } finally {
                setLoading(false);
            }
            return;
        }

        try {

            setLoading(true);

            await api.post("/expenses", formData);

            onClose();

        } catch (error) {

            toast(
                error.response?.data?.message ||
                "Unable to save expense"
            );

        } finally {

            setLoading(false);

        }

    };


    // Requirement 3: native-dialog behavior (Escape / backdrop /
    // focus trap / scroll lock) for this legacy overlay.
    const { overlayRef, contentRef, handleOverlayClick } = useModalBehavior(onClose);


    return (

        <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>

            <div ref={contentRef} className="student-modal" role="dialog" aria-modal="true">

                <div className="modal-header">

                    <h2>

                        {expense
                            ? "Edit Payment"
                            : "Add Payment"}

                    </h2>

                    <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
                        {expense
                            ? `Correcting payment #${expense.id} (editable once)`
                            : "Record a new payment"}
                    </p>


                    <button
                        className="close-btn"
                        onClick={onClose}
                    >

                        ✕

                    </button>

                </div>


                {expense && !isApprover ? (
                    <form className="student-form" onSubmit={handleSubmit} style={{ padding: "22px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                            <div style={{ padding: 14, borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Amount</span>
                                <div style={{ fontSize: 26, fontWeight: 700, color: "#17365d", marginTop: 6 }}>₹{Number(expense.amount || 0).toLocaleString("en-IN")}</div>
                                <small style={{ color: "#64748B" }}>{expense.expenseName || "-"} · {expense.expenseDate || "-"}</small>
                            </div>
                            <div style={{ padding: 14, borderRadius: 10, border: "1px solid #a9824b", background: "#f6f0e6" }}>
                                <label style={{ fontSize: 11, color: "#92400E", fontWeight: 700, textTransform: "uppercase" }}>Actual amount *</label>
                                <input
                                    type="number"
                                    name="amount"
                                    min="0"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={handleChange}
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
                            <input type="date" name="expenseDate" value={formData.expenseDate} onChange={handleChange} />
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
                <form
                    className="student-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">

                        <label>
                            Expense Name
                        </label>

                        <input
                            type="text"
                            name="expenseName"
                            value={
                                formData.expenseName
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Electricity Bill"
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Category
                        </label>

                        <select
                            name="category"
                            value={
                                formData.category
                            }
                            onChange={
                                handleChange
                            }
                            required
                        >

                            {/* Keep the current value selectable even if its
                                category was later renamed or removed. */}
                            {formData.category &&
                                !categories.includes(formData.category) && (
                                    <option value={formData.category}>
                                        {formData.category}
                                    </option>
                                )}

                            {categories.map(
                                (item) => (

                                    <option
                                        key={item}
                                        value={item}
                                    >
                                        {item}
                                    </option>

                                )
                            )}

                        </select>

                    </div>


                    <div className="form-group">

                        <label>
                            Amount
                        </label>

                        <input
                            type="number"
                            name="amount"
                            value={
                                formData.amount
                            }
                            onChange={
                                handleChange
                            }
                            min="0"
                            step="0.01"
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Expense Date
                        </label>

                        <input
                            type="date"
                            name="expenseDate"
                            value={
                                formData.expenseDate
                            }
                            onChange={
                                handleChange
                            }
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Payment Mode
                        </label>

                        <select
                            name="paymentMode"
                            value={
                                formData.paymentMode
                            }
                            onChange={
                                handleChange
                            }
                        >

                            <option>
                                Cash
                            </option>

                            <option>
                                UPI
                            </option>

                            <option>
                                Card
                            </option>

                            <option>
                                Bank Transfer
                            </option>

                            <option>
                                Cheque
                            </option>

                        </select>

                    </div>


                    <div className="form-group">

                        <label>
                            Paid To
                        </label>

                        <input
                            type="text"
                            name="paidTo"
                            value={
                                formData.paidTo
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Person / Company"
                        />

                    </div>


                    <div
                        className="form-group"
                        style={{
                            gridColumn:
                                "1 / 3"
                        }}
                    >

                        <label>
                            Description
                        </label>

                        <textarea
                            rows="4"
                            name="description"
                            value={
                                formData.description
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Optional description..."
                        />

                    </div>

                            {expense && isApprover && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                                Reason for edit <span style={{ color: "#64748B", fontWeight: 400 }}>(optional, for the audit log)</span>
                            </label>
                            <textarea rows={2} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Optional reason for the audit log" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border, #d9e0e6)", borderRadius: 8, boxSizing: "border-box" }} />
                        </div>
                    )}

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
                                : expense
                                    ? "Save Changes"
                                    : "Save Payment"}

                        </button>

                    </div>

                </form>
                )}

            </div>

        </div>

    );

}


export default ExpenseForm;