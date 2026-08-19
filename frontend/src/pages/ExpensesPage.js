import {
    useEffect,
    useState
} from "react";

import Sidebar
    from "../components/Sidebar";

import Navbar
    from "../components/Navbar";

import ExpenseForm
    from "../components/ExpenseForm";

import api
    from "../services/api";


function ExpensesPage() {

    const [
        expenses,
        setExpenses
    ] = useState([]);


    const [
        filteredExpenses,
        setFilteredExpenses
    ] = useState([]);


    const [
        selectedExpense,
        setSelectedExpense
    ] = useState(null);


    const [
        showForm,
        setShowForm
    ] = useState(false);


    const [
        search,
        setSearch
    ] = useState("");


    const [
        category,
        setCategory
    ] = useState("all");


    // =====================================================
    // CATEGORIES
    // =====================================================

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


    // =====================================================
    // LOAD
    // =====================================================

    const fetchExpenses =
        async () => {

            try {

                const res =
                    await api.get(
                        "/expenses"
                    );


                const data =
                    Array.isArray(
                        res.data
                    )
                        ? res.data
                        : [];


                setExpenses(
                    data
                );


                setFilteredExpenses(
                    data
                );

            } catch (
                error
            ) {

                console.error(
                    "Expense Error:",
                    error
                );

            }

        };


    useEffect(
        () => {

            fetchExpenses();

        },
        []
    );


    // =====================================================
    // FILTER
    // =====================================================

    useEffect(
        () => {

            let result =
                [...expenses];


            if (
                search.trim()
            ) {

                const value =
                    search
                        .toLowerCase();


                result =
                    result.filter(
                        expense =>
                            expense.expenseName
                                ?.toLowerCase()
                                .includes(
                                    value
                                ) ||

                            expense.category
                                ?.toLowerCase()
                                .includes(
                                    value
                                ) ||

                            expense.paidTo
                                ?.toLowerCase()
                                .includes(
                                    value
                                )
                    );

            }


            if (
                category !==
                "all"
            ) {

                result =
                    result.filter(
                        expense =>
                            expense.category ===
                            category
                    );

            }


            setFilteredExpenses(
                result
            );

        },
        [
            search,
            category,
            expenses
        ]
    );


    // =====================================================
    // MONEY
    // =====================================================

    const money =
        value =>
            `₹${Number(
                value || 0
            ).toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits:
                        2,

                    maximumFractionDigits:
                        2
                }
            )}`;


    // =====================================================
    // ACTIVE EXPENSE TOTAL
    // =====================================================

    const totalExpense =
        filteredExpenses
            .filter(
                expense =>
                    expense.status !==
                    "reversed"
            )
            .reduce(
                (
                    total,
                    expense
                ) =>
                    total +
                    Number(
                        expense.amount ||
                        0
                    ),
                0
            );


    // =====================================================
    // ACTIVE TRANSACTION COUNT
    // =====================================================

    const activeCount =
        filteredExpenses.filter(
            expense =>
                expense.status !==
                "reversed"
        ).length;


    // =====================================================
    // ADD
    // =====================================================

    const handleAdd =
        () => {

            setSelectedExpense(
                null
            );

            setShowForm(
                true
            );

        };


    // =====================================================
    // EDIT
    // =====================================================

    const handleEdit =
        expense => {

            if (
                expense.status ===
                "reversed"
            ) {

                return;

            }


            setSelectedExpense(
                expense
            );


            setShowForm(
                true
            );

        };


    // =====================================================
    // REVERSE
    // =====================================================

    const handleReverse =
        async expense => {

            if (
                expense.status ===
                "reversed"
            ) {

                return;

            }


            const reason =
                window.prompt(
                    `Why are you reversing "${expense.expenseName}"?`
                );


            if (
                !reason ||
                !reason.trim()
            ) {

                return;

            }


            const confirmed =
                window.confirm(

                    `Reverse this expense?\n\n` +

                    `Amount: ${money(
                        expense.amount
                    )}\n` +

                    `Category: ${
                        expense.category ||
                        "-"
                    }\n\n` +

                    `Reason: ${
                        reason.trim()
                    }\n\n` +

                    `The expense will NOT be deleted.`

                );


            if (!confirmed) {

                return;

            }


            try {

                await api.post(

                    `/expenses/${expense.id}/reverse`,

                    {
                        reason:
                            reason.trim()
                    }

                );


                fetchExpenses();

            } catch (
                error
            ) {

                alert(
                    error.response?.data?.message ||
                    "Unable to reverse expense."
                );

            }

        };


    return (

        <div
            className="dashboard"
        >

            <Sidebar />


            <div
                className="main-content"
            >

                <Navbar />


                <div
                    className="page-content"
                >

                    {/* HEADER */}

                    <div
                        className="page-header"
                    >

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
                            onClick={
                                handleAdd
                            }
                        >

                            + Add Expense

                        </button>

                    </div>


                    {/* SUMMARY */}

                    <div
                        className="cards"
                    >

                        <div
                            className="dashboard-card"
                        >

                            <h3>
                                Active Expenses
                            </h3>

                            <h1>
                                {money(
                                    totalExpense
                                )}
                            </h1>

                        </div>


                        <div
                            className="dashboard-card"
                        >

                            <h3>
                                Active Transactions
                            </h3>

                            <h1>
                                {
                                    activeCount
                                }
                            </h1>

                        </div>

                    </div>


                    {/* FILTER */}

                    <div
                        className="expense-filters"
                        style={{
                            display:
                                "flex",

                            gap:
                                "12px",

                            marginBottom:
                                "20px"
                        }}
                    >

                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={
                                search
                            }
                            onChange={
                                e =>
                                    setSearch(
                                        e.target.value
                                    )
                            }
                        />


                        <select
                            value={
                                category
                            }
                            onChange={
                                e =>
                                    setCategory(
                                        e.target.value
                                    )
                            }
                        >

                            <option value="all">
                                All Categories
                            </option>


                            {
                                categories.map(
                                    item => (

                                        <option
                                            key={
                                                item
                                            }
                                            value={
                                                item
                                            }
                                        >

                                            {
                                                item
                                            }

                                        </option>

                                    )
                                )
                            }

                        </select>

                    </div>


                    {/* TABLE */}

                    <div
                        className="table-container"
                    >

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
                                        Status
                                    </th>

                                    <th>
                                        Actions
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {
                                    filteredExpenses.length ===
                                    0 ? (

                                        <tr>

                                            <td
                                                colSpan="8"
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
                                            expense => (

                                                <tr
                                                    key={
                                                        expense.id
                                                    }
                                                    style={
                                                        expense.status ===
                                                        "reversed"
                                                            ? {
                                                                opacity:
                                                                    0.65
                                                            }
                                                            : {}
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
                                                            {
                                                                money(
                                                                    expense.amount
                                                                )
                                                            }
                                                        </strong>

                                                    </td>


                                                    <td>

                                                        {
                                                            expense.status ===
                                                            "reversed" ? (

                                                                <span
                                                                    className="payment-badge mode-default"
                                                                >
                                                                    Reversed
                                                                </span>

                                                            ) : (

                                                                <span
                                                                    className="payment-badge mode-upi"
                                                                >
                                                                    Completed
                                                                </span>

                                                            )
                                                        }

                                                    </td>


                                                    <td>

                                                        <div
                                                            className="action-buttons"
                                                        >

                                                            {
                                                                expense.status ===
                                                                "reversed" ? (

                                                                    <span
                                                                        className="payment-badge mode-default"
                                                                    >
                                                                        Reversed
                                                                    </span>

                                                                ) : (

                                                                    <>

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
                                                                                handleReverse(
                                                                                    expense
                                                                                )
                                                                            }
                                                                        >
                                                                            Reverse
                                                                        </button>

                                                                    </>

                                                                )
                                                            }

                                                        </div>

                                                    </td>

                                                </tr>

                                            )
                                        )

                                    )
                                }

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>


            {
                showForm && (

                    <ExpenseForm

                        expense={
                            selectedExpense
                        }

                        onClose={() => {

                            setShowForm(
                                false
                            );

                            setSelectedExpense(
                                null
                            );

                            fetchExpenses();

                        }}

                    />

                )
            }

        </div>

    );

}


export default ExpensesPage;