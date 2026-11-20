import { toast, confirmDialog } from "../services/notify";
import {
    useEffect,
    useState,
    useMemo
} from "react";

import Sidebar
    from "../components/Sidebar";

import Navbar
    from "../components/Navbar";

import IncomeForm
    from "../components/IncomeForm";

import OverlayDialog
    from "../components/OverlayDialog";

import PromptDialog
    from "../components/PromptDialog";

import { useAuth }
    from "../context/AuthContext";

import api
    from "../services/api";


// =====================================================
// INCOMES
// Non-fee money coming into the school (donations, grants,
// event collections ...). Exact mirror of the Expenses page:
// admin-managed categories (none hardcoded), reversal instead
// of deletion. Active incomes are added to the dashboard's
// Net Balance.
// =====================================================

function IncomesPage() {

    const { user } = useAuth();
    // Finance actions (reverse, categories) stay admin-only.
    const isAdmin = user?.role === "admin";
    const isApprover = user?.role === "admin" || user?.role === "principal";

    const [
        incomes,
        setIncomes
    ] = useState([]);


    const [
        filteredIncomes,
        setFilteredIncomes
    ] = useState([]);


    const [
        selectedIncome,
        setSelectedIncome
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
                        "/incomes/categories"
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

    const fetchIncomes =
        async () => {

            try {

                const res =
                    await api.get(
                        "/incomes"
                    );


                const data =
                    Array.isArray(
                        res.data
                    )
                        ? res.data
                        : [];


                setIncomes(
                    data
                );


                setFilteredIncomes(
                    data
                );

            } catch (
                error
            ) {

                console.error(
                    "Income Error:",
                    error
                );

            }

        };


    useEffect(
        () => {

            fetchIncomes();
            fetchCategories();
            fetchReverseRequests();

        },
        []
    );


    // =====================================================
    // FILTER
    // =====================================================

    useEffect(
        () => {

            let result =
                [...incomes];


            if (
                search.trim()
            ) {

                const value =
                    search
                        .toLowerCase();


                result =
                    result.filter(
                        income =>
                            income.incomeName
                                ?.toLowerCase()
                                .includes(
                                    value
                                ) ||

                            income.category
                                ?.toLowerCase()
                                .includes(
                                    value
                                ) ||

                            income.receivedFrom
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
                        income =>
                            income.category ===
                            category
                    );

            }


            setFilteredIncomes(
                result
            );

        },
        [
            search,
            category,
            incomes
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
    // ACTIVE INCOME TOTAL
    // =====================================================

    const totalIncome =
        filteredIncomes
            .filter(
                income =>
                    income.status !==
                    "reversed"
            )
            .reduce(
                (
                    total,
                    income
                ) =>
                    total +
                    Number(
                        income.amount ||
                        0
                    ),
                0
            );


    // =====================================================
    // ACTIVE TRANSACTION COUNT
    // =====================================================

    const activeCount =
        filteredIncomes.filter(
            income =>
                income.status !==
                "reversed"
        ).length;


    // =====================================================
    // ADD
    // =====================================================

    const handleAdd =
        () => {

            setSelectedIncome(
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
        income => {

            if (
                income.status ===
                "reversed"
            ) {

                return;

            }


            setSelectedIncome(
                income
            );


            setShowForm(
                true
            );

        };


    // =====================================================
    // REVERSE
    // =====================================================

    const [reverseTarget, setReverseTarget] = useState(null);
    const [reversing, setReversing] = useState(false);
    const [reverseRequests, setReverseRequests] = useState([]);
    const [tab, setTab] = useState("completed");

    const fetchReverseRequests = async () => {
        if (!isApprover) return;
        try {
            const res = await api.get("/incomes/reverse-requests");
            setReverseRequests(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error("Reverse requests error:", e); }
    };

    const reviewRequest = async (id, action) => {
        try {
            const res = await api.post(`/incomes/reverse-requests/${id}/${action}`, {});
            toast(res.data?.message || "Request updated.");
            fetchIncomes();
            fetchReverseRequests();
        } catch (e) {
            toast(e.response?.data?.message || "Unable to review request.");
        }
    };

    const handleReverse = (income) => {
        if (income.status === "reversed") return;
        setReverseTarget(income);
    };

    const confirmReverse = async (reason) => {
        if (!reverseTarget) return;
        setReversing(true);
        try {
            const res = await api.post(`/incomes/${reverseTarget.id}/reverse`, { reason });
            toast(res.data?.message || (isApprover ? "Income reversed successfully." : "Reverse request submitted for admin approval."));
            setReverseTarget(null);
            fetchIncomes();
            fetchReverseRequests();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to reverse income.");
        } finally {
            setReversing(false);
        }
    };


    const completedIncomes = useMemo(
        () => filteredIncomes.filter((i) => i.status !== "reversed"),
        [filteredIncomes]
    );
    const reversedIncomes = useMemo(
        () => filteredIncomes.filter((i) => i.status === "reversed"),
        [filteredIncomes]
    );
    const visibleIncomes = tab === "reversed" ? reversedIncomes : completedIncomes;

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
                                Incomes
                            </h2>

                            <p>
                                Manage school incomes (added to the Net Balance)
                            </p>

                        </div>


                        <button
                            className="primary-btn"
                            onClick={
                                handleAdd
                            }
                        >

                            + Add Income

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
                                Active Income
                            </h3>

                            <h1>
                                {money(
                                    totalIncome
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
                            placeholder="Search incomes..."
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


                    {/* TABS */}
                    <div className="exam-tabbar" style={{ marginBottom: "18px" }}>
                        <button type="button" className={`exam-tab ${tab === "completed" ? "exam-tab-active" : ""}`} onClick={() => setTab("completed")}>
                            Completed <span className="exam-badge">{completedIncomes.length}</span>
                        </button>
                        {isApprover && (
                            <>
                                <button type="button" className={`exam-tab ${tab === "reversed" ? "exam-tab-active" : ""}`} onClick={() => setTab("reversed")}>
                                    Reversed <span className="exam-badge">{reversedIncomes.length}</span>
                                </button>
                                <button type="button" className={`exam-tab ${tab === "requests" ? "exam-tab-active" : ""}`} onClick={() => { setTab("requests"); fetchReverseRequests(); }}>
                                    Reverse Requests <span className="exam-badge">{reverseRequests.length}</span>
                                </button>
                            </>
                        )}
                    </div>

                    {tab === "requests" && isApprover && (
                        <div className="settings-card" style={{ marginBottom: "18px" }}>
                            <h3 style={{ margin: "0 0 12px 0" }}>Pending Reverse Requests ({reverseRequests.length})</h3>
                            {reverseRequests.length === 0 ? (
                                <p style={{ color: "#64748B", fontSize: "13px" }}>No pending reverse requests.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="compact-table stack-sm">
                                        <thead><tr><th>Income</th><th>Amount</th><th>Requested by</th><th>Reason</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {reverseRequests.map((r) => (
                                                <tr key={r.id}>
                                                    <td data-label="Income">{r.incomeName || "-"}</td>
                                                    <td data-label="Amount">{money(r.amount)}</td>
                                                    <td data-label="Requested by">{r.requestedByName || "-"}</td>
                                                    <td data-label="Reason">{r.reason || "-"}</td>
                                                    <td data-label="Action">
                                                        <button className="save-btn" onClick={() => reviewRequest(r.id, "approve")}>Approve</button>
                                                        <button className="cancel-btn" onClick={() => reviewRequest(r.id, "reject")}>Reject</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {tab !== "requests" && (
                    <div
                        className="table-container"
                    >

                        <table className="stack-sm">

                            <thead>

                                <tr>

                                    <th>
                                        Date
                                    </th>

                                    <th>
                                        Income
                                    </th>

                                    <th>
                                        Category
                                    </th>

                                    <th>
                                        Received From
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
                                    visibleIncomes.length ===
                                    0 ? (

                                        <tr>

                                            <td
                                                colSpan="8"
                                                style={{
                                                    textAlign:
                                                        "center"
                                                }}
                                            >

                                                No Incomes Found

                                            </td>

                                        </tr>

                                    ) : (

                                        visibleIncomes.map(
                                            income => (

                                                <tr
                                                    key={
                                                        income.id
                                                    }
                                                    style={
                                                        income.status ===
                                                        "reversed"
                                                            ? {
                                                                opacity:
                                                                    0.65
                                                            }
                                                            : {}
                                                    }
                                                >

                                                    <td data-label="Date">
                                                        {
                                                            income.incomeDate
                                                        }
                                                    </td>


                                                    <td data-label="Income">
                                                        {
                                                            income.incomeName
                                                        }
                                                    </td>


                                                    <td data-label="Category">
                                                        {
                                                            income.category
                                                        }
                                                    </td>


                                                    <td data-label="Received From">
                                                        {
                                                            income.receivedFrom ||
                                                            "-"
                                                        }
                                                    </td>


                                                    <td data-label="Payment Mode">
                                                        {
                                                            income.paymentMode
                                                        }
                                                    </td>


                                                    <td data-label="Amount">

                                                        <strong>
                                                            {
                                                                money(
                                                                    income.amount
                                                                )
                                                            }
                                                        </strong>

                                                    </td>


                                                    <td data-label="Status">

                                                        {
                                                            income.status ===
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


                                                    <td data-label="">

                                                        <div
                                                            className="action-buttons"
                                                        >

                                                            {
                                                                income.status ===
                                                                "reversed" ? (

                                                                    <span
                                                                        className="payment-badge mode-default"
                                                                    >
                                                                        Reversed
                                                                    </span>

                                                                ) : (

                                                                    <>

                                                                        {Number(income.editCount || 0) < 1 && (
                                                                        <button
                                                                            className="edit-btn"
                                                                            onClick={() =>
                                                                                handleEdit(
                                                                                    income
                                                                                )
                                                                            }
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        )}


                                                                        <button
                                                                            className="delete-btn"
                                                                            onClick={() =>
                                                                                handleReverse(
                                                                                    income
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
                    )}

                </div>

            </div>


            {
                showForm && (

                    <IncomeForm

                        income={
                            selectedIncome
                        }

                        isAdmin={isAdmin}

                        onClose={() => {

                            setShowForm(
                                false
                            );

                            setSelectedIncome(
                                null
                            );

                            fetchIncomes();
                            fetchCategories();

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

            <PromptDialog
                open={!!reverseTarget}
                onClose={() => setReverseTarget(null)}
                onConfirm={confirmReverse}
                title={reverseTarget ? `Reverse "${reverseTarget.incomeName}"?` : ""}
                message={
                    reverseTarget
                        ? `Amount: ${money(reverseTarget.amount)}\n` +
                          `Category: ${reverseTarget.category || "-"}\n\n` +
                          `The income will NOT be deleted.`
                        : ""
                }
                multiline
                requireValue
                placeholder={isApprover ? "Reason for reversing (required)" : "Reason for requesting reversal (required)"}
                confirmLabel={isApprover ? "Reverse" : "Send Request"}
                busy={reversing}
            />

        </div>

    );

}


// =====================================================
// INCOME CATEGORY MANAGER MODAL (admin)
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
            await api.post("/incomes/categories", { categoryName: newName.trim() });
            setNewName("");
            refreshCategories();
        } catch (error) {
            toast(error.response?.data?.message || "Failed to add category.");
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
        if (!editName.trim()) return toast("Category name is required.");
        setBusyId(id);
        try {
            await api.put(`/incomes/categories/${id}`, { categoryName: editName.trim() });
            cancelEdit();
            refreshCategories();
        } catch (error) {
            toast(error.response?.data?.message || "Failed to rename category.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (cat) => {
        if (!(await confirmDialog({ message: `Delete the category "${cat.categoryName}"?`, confirmLabel: "Delete", danger: true }))) return;
        setBusyId(cat.id);
        try {
            await api.delete(`/incomes/categories/${cat.id}`);
            refreshCategories();
        } catch (error) {
            toast(error.response?.data?.message || "Failed to delete category.");
        } finally {
            setBusyId(null);
        }
    };

    const keyword = search.toLowerCase().trim();
    const visible = categories.filter(
        (c) => !keyword || c.categoryName.toLowerCase().includes(keyword)
    );

    return (
        <OverlayDialog onClose={onClose} ariaLabel="Manage income categories">
            <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", width: "100%", maxWidth: "520px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Manage Income Categories</h2>
                    <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", fontSize: "14px", color: "#475569", cursor: "pointer", width: "28px", height: "28px", borderRadius: "50%", fontWeight: "bold" }}>✕</button>
                </div>
                <div style={{ padding: "20px", overflowY: "auto" }}>
                    <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "16px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#475569" }}>New Category *</label>
                            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Donations" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", boxSizing: "border-box" }} />
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
                            <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>No categories yet — create your first one above.</div>
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
                        A category that is still used by an income cannot be deleted. Renaming a category updates it on all of its existing incomes.
                    </p>
                </div>
            </div>
        </OverlayDialog>
    );
}


export default IncomesPage;
