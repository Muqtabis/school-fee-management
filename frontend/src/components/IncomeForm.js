import { toast } from "../services/notify";
import { useEffect, useState } from "react";

import api from "../services/api";

import useModalBehavior from "./useModalBehavior";

// =====================================================
// INCOME FORM (add / edit)
// Mirrors ExpenseForm. Income categories are created by the
// admin manually (none are hardcoded), so admins get a small
// inline "create category" row right inside this dialog.
// =====================================================

function IncomeForm({
    income,
    isAdmin,
    onClose
}) {

    const [formData, setFormData] =
        useState({

            incomeName: "",

            category: "",

            amount: "",

            incomeDate:
                new Date()
                    .toISOString()
                    .split("T")[0],

            paymentMode: "Cash",

            receivedFrom: "",

            description: ""

        });

    const [loading, setLoading] =
        useState(false);

    const [categories, setCategories] =
        useState([]);

    // Inline category creation (admin only).
    const [newCategory, setNewCategory] = useState("");
    const [addingCategory, setAddingCategory] = useState(false);


    useEffect(() => {

        const loadCategories = async () => {
            try {
                const res = await api.get("/incomes/categories");
                setCategories(
                    Array.isArray(res.data)
                        ? res.data.map((c) => c.categoryName)
                        : []
                );
            } catch (error) {
                console.error("Unable to load income categories:", error);
                setCategories([]);
            }
        };

        loadCategories();

    }, []);


    useEffect(() => {

        if (income) {

            setFormData({

                incomeName:
                    income.incomeName || "",

                category:
                    income.category || "",

                amount:
                    income.amount || "",

                incomeDate:
                    income.incomeDate || "",

                paymentMode:
                    income.paymentMode || "Cash",

                receivedFrom:
                    income.receivedFrom || "",

                description:
                    income.description || ""

            });

        }

    }, [income]);


    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    const handleCreateCategory = async () => {
        const name = newCategory.trim();
        if (!name) return;
        setAddingCategory(true);
        try {
            const res = await api.post("/incomes/categories", { categoryName: name });
            setCategories((prev) => [...prev, name]);
            setFormData((prev) => ({ ...prev, category: prev.category || name }));
            setNewCategory("");
        } catch (error) {
            toast(error.response?.data?.message || "Unable to create category.");
        } finally {
            setAddingCategory(false);
        }
    };


    const handleSubmit = async (e) => {

        e.preventDefault();


        try {

            setLoading(true);


            if (income) {

                await api.put(
                    `/incomes/${income.id}`,
                    formData
                );

            } else {

                await api.post(
                    "/incomes",
                    formData
                );

            }


            onClose();

        } catch (error) {

            toast(
                error.response?.data?.message ||
                "Unable to save income"
            );

        } finally {

            setLoading(false);

        }

    };


    // Native-dialog behavior (Escape / backdrop / focus trap /
    // scroll lock) for this overlay.
    const { overlayRef, contentRef, handleOverlayClick } = useModalBehavior(onClose);


    return (

        <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>

            <div ref={contentRef} className="student-modal" role="dialog" aria-modal="true">

                <div className="modal-header">

                    <h2>

                        {income
                            ? "Edit Income"
                            : "Add Income"}

                    </h2>


                    <button
                        className="close-btn"
                        onClick={onClose}
                    >

                        ✕

                    </button>

                </div>


                <form
                    className="student-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">

                        <label>
                            Income Name
                        </label>

                        <input
                            type="text"
                            name="incomeName"
                            value={
                                formData.incomeName
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Donation / Grant / Event Collection"
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

                            <option value="" disabled>
                                — Select category —
                            </option>

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

                        {isAdmin && (
                            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    placeholder="New category name…"
                                    style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateCategory}
                                    disabled={addingCategory || !newCategory.trim()}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #CBD5E1",
                                        background: newCategory.trim() ? "#0F172A" : "#94A3B8",
                                        color: "#fff",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        cursor: newCategory.trim() ? "pointer" : "not-allowed",
                                        whiteSpace: "nowrap"
                                    }}
                                >
                                    {addingCategory ? "Adding…" : "＋ Create"}
                                </button>
                            </div>
                        )}

                        {!isAdmin && categories.length === 0 && (
                            <p style={{ fontSize: "12px", color: "#64748B", margin: "6px 0 0" }}>
                                No income categories yet — ask the admin to create them (Manage Categories).
                            </p>
                        )}

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
                            Income Date
                        </label>

                        <input
                            type="date"
                            name="incomeDate"
                            value={
                                formData.incomeDate
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
                            Received From
                        </label>

                        <input
                            type="text"
                            name="receivedFrom"
                            value={
                                formData.receivedFrom
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Person / Organization"
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
                                : income
                                    ? "Update Income"
                                    : "Save Income"}

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}


export default IncomeForm;
