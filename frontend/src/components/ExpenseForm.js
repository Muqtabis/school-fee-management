import { useEffect, useState } from "react";

import api from "../services/api";


function ExpenseForm({
    expense,
    onClose
}) {

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


        try {

            setLoading(true);


            if (expense) {

                await api.put(
                    `/expenses/${expense.id}`,
                    formData
                );

            } else {

                await api.post(
                    "/expenses",
                    formData
                );

            }


            onClose();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to save expense"
            );

        } finally {

            setLoading(false);

        }

    };


    const categories = [
        "Salary",
        "Electricity",
        "Water",
        "Internet",
        "Stationery",
        "Maintenance",
        "Transport",
        "School Supplies",
        "Events",
        "Rent",
        "Repairs",
        "Other"
    ];


    return (

        <div className="modal-overlay">

            <div className="student-modal">

                <div className="modal-header">

                    <h2>

                        {expense
                            ? "Edit Expense"
                            : "Add Expense"}

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
                        >

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
                                    ? "Update Expense"
                                    : "Save Expense"}

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

}


export default ExpenseForm;