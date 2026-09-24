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

import { useAuth }
    from "../context/AuthContext";

import api
    from "../services/api";


function ExpensesPage() {

    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

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


    const [
        categories,
        setCategories
    ] = useState([]);


    const [
        showCategoryManager,
        setShowCategoryManager
    ] = useState(false);


    // =====================================================
    // LOAD CATEGORIES
    // =====================================================

    const fetchCategories =
        async () => {

            try {

                const res =
                    await api.get(
                        "/expenses/categories"
                    );

                setCategories(
                    Array.isArray(res.data)
                        ? res.data
                        : []
                );

            } catch (error) {

                console.error(
                    "Category Error:",
                    error
                );

            }

        };


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
            fetchCategories();

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
                                                item.id
                                            }
                                            value={
                                                item.categoryName
                                            }
                                        >

                                            {
                                                item.categoryName
                                            }

                                        </option>

                                    )
                                )
                            }

                        </select>


                        {
                            isAdmin && (

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowCategoryManager(true)
                                    }
                                    style={{
                                        padding: "10px 16px",
                                        backgroundColor: "#F1F5F9",
                                        border: "1px solid #CBD5E1",
                                        borderRadius: "8px",
                                        color: "#334155",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap"
                                    }}
                                >
                                    Manage Categories
                                </button>

                            )
                        }

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


            {
                showCategoryManager && (

                    <CategoryManagerModal
                        categories={categories}
                        refreshCategories={fetchCategories}
                        onClose={() =>
                            setShowCategoryManager(false)
                        }
                    />

                )
            }

        </div>

    );

}


// =====================================================
// EXPENSE CATEGORY MANAGER MODAL (admin)
// =====================================================

function CategoryManagerModal({ categories, refreshCategories, onClose }) {

    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await api.post("/expenses/categories", { categoryName: newName.trim() });
            setNewName("");
            refreshCategories();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to add category.");
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (cat) => {
        setEditingId(cat.id);
        setEditName(cat.categoryName);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName("");
    };

    const saveEdit = async (id) => {
        if (!editName.trim()) return alert("Category name is required.");
        setBusyId(id);
        try {
            await api.put(`/expenses/categories/${id}`, { categoryName: editName.trim() });
            cancelEdit();
            refreshCategories();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to rename category.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (cat) => {
        if (!window.confirm(`Delete the category "${cat.categoryName}"?`)) return;
        setBusyId(cat.id);
        try {
            await api.delete(`/expenses/categories/${cat.id}`);
            refreshCategories();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to delete category.");
        } finally {
            setBusyId(null);
        }
    };

    const keyword = search.toLowerCase().trim();
    const visible = categories.filter(
        (c) => !keyword || c.categoryName.toLowerCase().includes(keyword)
    );

    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Manage Expense Categories</h2>
                    <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", fontSize: "14px", color: "#475569", cursor: "pointer", width: "28px", height: "28px", borderRadius: "50%", fontWeight: "bold" }}>✕</button>
                </div>
                <div style={{ padding: "20px", overflowY: "auto" }}>
                    <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "16px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#475569" }}>New Category *</label>
                            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Lab Equipment" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
                        </div>
                        <button type="submit" disabled={loading || !newName.trim()} style={{ padding: "8px 16px", backgroundColor: newName.trim() ? "#0F172A" : "#94A3B8", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: newName.trim() ? "pointer" : "not-allowed", height: "35px" }}>{loading ? "Adding..." : "Add"}</button>
                    </form>

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search categories..."
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box", marginBottom: "12px" }}
                    />

                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase" }}>Existing Categories ({visible.length})</div>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                        {visible.length === 0 ? (
                            <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>No categories found.</div>
                        ) : visible.map((cat, idx) => {
                            const isEditing = editingId === cat.id;
                            const busy = busyId === cat.id;
                            return (
                                <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: idx !== visible.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: "14px", color: "#334155" }}>
                                    {isEditing ? (
                                        <>
                                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                <button onClick={() => saveEdit(cat.id)} disabled={busy} style={{ background: "#0F172A", border: "none", color: "#fff", fontSize: "12px", cursor: "pointer", fontWeight: "600", padding: "6px 10px", borderRadius: "6px" }}>{busy ? "..." : "Save"}</button>
                                                <button onClick={cancelEdit} style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#475569", fontSize: "12px", cursor: "pointer", fontWeight: "600", padding: "6px 10px", borderRadius: "6px" }}>Cancel</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span style={{ fontWeight: "600" }}>{cat.categoryName}</span>
                                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                                <button onClick={() => startEdit(cat)} style={{ background: "none", border: "none", color: "#2563EB", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                                                <button onClick={() => handleDelete(cat)} disabled={busy} style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: "12px", color: "#64748B", marginTop: "12px", lineHeight: 1.5 }}>
                        A category that is still used by an expense cannot be deleted. Renaming a category updates it on all of its existing expenses.
                    </p>
                </div>
            </div>
        </div>
    );
}


export default ExpensesPage;