import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import ExpenseForm from "../components/ExpenseForm";

import api from "../services/api";


function ExpensesPage() {

    const [expenses, setExpenses] = useState([]);

    const [filteredExpenses, setFilteredExpenses] =
        useState([]);

    const [selectedExpense, setSelectedExpense] =
        useState(null);

    const [showForm, setShowForm] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [category, setCategory] =
        useState("all");


    const fetchExpenses = async () => {

        try {

            const res =
                await api.get("/expenses");

            setExpenses(res.data);

            setFilteredExpenses(res.data);

        } catch (error) {

            console.error(error);

        }

    };


    useEffect(() => {

        fetchExpenses();

    }, []);


    useEffect(() => {

        let result = [...expenses];


        if (search.trim()) {

            const value =
                search.toLowerCase();

            result = result.filter(
                (expense) =>
                    expense.expenseName
                        ?.toLowerCase()
                        .includes(value) ||

                    expense.category
                        ?.toLowerCase()
                        .includes(value) ||

                    expense.paidTo
                        ?.toLowerCase()
                        .includes(value)
            );

        }


        if (category !== "all") {

            result = result.filter(
                (expense) =>
                    expense.category === category
            );

        }


        setFilteredExpenses(result);

    }, [search, category, expenses]);


    const handleAdd = () => {

        setSelectedExpense(null);

        setShowForm(true);

    };


    const handleEdit = (expense) => {

        setSelectedExpense(expense);

        setShowForm(true);

    };


    const handleDelete = async (id) => {

        const confirmed =
            window.confirm(
                "Delete this expense?"
            );

        if (!confirmed) return;


        try {

            await api.delete(
                `/expenses/${id}`
            );

            fetchExpenses();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to delete expense"
            );

        }

    };


    const totalExpense =
        filteredExpenses.reduce(
            (total, expense) =>
                total + Number(expense.amount || 0),
            0
        );


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


    const money = (value) => {

        return `₹${Number(
            value || 0
        ).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    };


    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    {/* HEADER */}

                    <div className="page-header">

                        <div>

                            <h2>
                                Expenses
                            </h2>

                            <p>
                                Manage school expenses
                            </p>

                        </div>


                        <button
                            className="primary-btn"
                            onClick={handleAdd}
                        >

                            + Add Expense

                        </button>

                    </div>


                    {/* SUMMARY */}

                    <div className="cards">

                        <div className="dashboard-card">

                            <h3>
                                Total Expenses
                            </h3>

                            <h1>
                                {money(totalExpense)}
                            </h1>

                        </div>


                        <div className="dashboard-card">

                            <h3>
                                Transactions
                            </h3>

                            <h1>
                                {filteredExpenses.length}
                            </h1>

                        </div>

                    </div>


                    {/* FILTERS */}

                    <div
                        className="expense-filters"
                        style={{
                            display: "flex",
                            gap: "12px",
                            marginBottom: "20px"
                        }}
                    >

                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />


                        <select
                            value={category}
                            onChange={(e) =>
                                setCategory(e.target.value)
                            }
                        >

                            <option value="all">
                                All Categories
                            </option>

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


                    {/* TABLE */}

                    <div className="table-container">

                        <table>

                            <thead>

                                <tr>

                                    <th>
                                        Date
                                    </th>

                                    <th>
                                        Expense
                                    </th>

                                    <th>
                                        Category
                                    </th>

                                    <th>
                                        Paid To
                                    </th>

                                    <th>
                                        Payment Mode
                                    </th>

                                    <th>
                                        Amount
                                    </th>

                                    <th>
                                        Actions
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {filteredExpenses.length === 0 ? (

                                    <tr>

                                        <td
                                            colSpan="7"
                                            style={{
                                                textAlign:
                                                    "center"
                                            }}
                                        >

                                            No Expenses Found

                                        </td>

                                    </tr>

                                ) : (

                                    filteredExpenses.map(
                                        (expense) => (

                                            <tr
                                                key={
                                                    expense.id
                                                }
                                            >

                                                <td>
                                                    {
                                                        expense.expenseDate
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        expense.expenseName
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        expense.category
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        expense.paidTo ||
                                                        "-"
                                                    }
                                                </td>

                                                <td>
                                                    {
                                                        expense.paymentMode
                                                    }
                                                </td>

                                                <td>

                                                    <strong>
                                                        {money(
                                                            expense.amount
                                                        )}
                                                    </strong>

                                                </td>

                                                <td>

                                                    <button
                                                        className="edit-btn"
                                                        onClick={() =>
                                                            handleEdit(
                                                                expense
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>


                                                    <button
                                                        className="delete-btn"
                                                        onClick={() =>
                                                            handleDelete(
                                                                expense.id
                                                            )
                                                        }
                                                    >
                                                        Delete
                                                    </button>

                                                </td>

                                            </tr>

                                        )
                                    )

                                )}

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>


            {showForm && (

                <ExpenseForm

                    expense={selectedExpense}

                    onClose={() => {

                        setShowForm(false);

                        fetchExpenses();

                    }}

                />

            )}

        </div>

    );

}


export default ExpensesPage;