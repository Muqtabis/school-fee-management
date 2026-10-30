import { toast, confirmDialog } from "../services/notify";
import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PromptDialog from "../components/PromptDialog";
import api from "../services/api";


function UsersPage() {

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Master list of assignable pages (from backend registry).
    const [pageRegistry, setPageRegistry] = useState([]);

    // The user whose access is being edited, plus working state.
    // accessUserId === user.id means the panel is open inline below
    // that user's row (not at the bottom of the page).
    const [accessUserId, setAccessUserId] = useState(null);
    const [accessKeys, setAccessKeys] = useState([]);
    // Page keys valid for the selected user's role (from the backend).
    const [grantableKeys, setGrantableKeys] = useState([]);
    const [accessLocked, setAccessLocked] = useState(false);
    const [accessLoading, setAccessLoading] = useState(false);
    const [savingAccess, setSavingAccess] = useState(false);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "accountant"
    });


    // =====================================================
    // LOAD USERS + PAGE REGISTRY
    // =====================================================

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await api.get("/users");
            setUsers(res.data);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    };

    const loadRegistry = async () => {
        try {
            const res = await api.get("/users/pages/registry");
            setPageRegistry(res.data.pages || []);
        } catch (error) {
            console.error("Registry load error:", error.response?.data || error.message);
        }
    };

    useEffect(() => {
        loadUsers();
        loadRegistry();
    }, []);


    // =====================================================
    // INPUT CHANGE
    // =====================================================

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };


    // =====================================================
    // CREATE USER (accountant, principal, manager or teacher)
    // =====================================================

    const createUser = async (e) => {
        e.preventDefault();
        try {
            await api.post("/users", form);
            toast(`${labelForRole(form.role)} created successfully.`);
            setForm({ name: "", email: "", password: "", role: "accountant" });
            loadUsers();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to create user.");
        }
    };


    // =====================================================
    // RESET PASSWORD
    // Centered two-step PromptDialog replaces the old
    // window.prompt pair.
    // =====================================================

    const [pwTarget, setPwTarget] = useState(null);
    const [pwStage, setPwStage] = useState("new"); // "new" | "confirm"
    const [pwBusy, setPwBusy] = useState(false);
    const [firstPw, setFirstPw] = useState("");

    const resetPassword = (user) => {
        setPwTarget(user);
        setPwStage("new");
    };

    const closePwDialogs = () => {
        setPwTarget(null);
        setPwStage("new");
        setFirstPw("");
    };

    const handlePwNew = (value) => {
        if (value.length < 8) {
            toast("Password must contain at least 8 characters.");
            return;
        }
        setFirstPw(value);
        setPwStage("confirm");
    };

    const handlePwConfirm = async (value) => {
        if (value !== firstPw) {
            toast("Passwords do not match.");
            return;
        }
        setPwBusy(true);
        try {
            await api.put(`/users/${pwTarget.id}/password`, { password: value });
            toast("Password reset successfully.");
            closePwDialogs();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to reset password.");
        } finally {
            setPwBusy(false);
        }
    };


    // =====================================================
    // DELETE USER
    // =====================================================

    const deleteUser = async (user) => {
        const confirmed = await confirmDialog({
            title: "Delete user?",
            message: `Are you sure you want to delete ${user.name}?\nThis will remove their ERP login.`,
            confirmLabel: "Delete",
            danger: true
        });
        if (!confirmed) return;

        try {
            await api.delete(`/users/${user.id}`);
            toast("User deleted successfully.");
            if (accessUserId && accessUserId === user.id) closeAccess();
            loadUsers();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to delete user.");
        }
    };


    // =====================================================
    // PAGE ACCESS EDITOR
    // =====================================================

    const openAccess = async (user) => {
        setAccessUserId(user.id);
        setAccessLoading(true);
        setAccessKeys([]);
        setGrantableKeys([]);
        try {
            const res = await api.get(`/users/${user.id}/pages`);
            const grantable = res.data.grantablePageKeys || [];
            setGrantableKeys(grantable);
            // Drop any previously-stored keys that are no longer valid for the
            // role, so a save doesn't try to re-grant a page the API rejects.
            setAccessKeys((res.data.pageKeys || []).filter((k) => grantable.includes(k)));
            setAccessLocked(res.data.accessLocked || false);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load page access.");
            setAccessUserId(null);
        } finally {
            setAccessLoading(false);
        }
    };

    const closeAccess = () => {
        setAccessUserId(null);
        setAccessKeys([]);
        setGrantableKeys([]);
        setAccessLocked(false);
    };

    const toggleKey = (key) => {
        setAccessKeys((prev) =>
            prev.includes(key)
                ? prev.filter((k) => k !== key)
                : [...prev, key]
        );
    };

    const saveAccess = async () => {
        if (!accessUserId) return;
        try {
            setSavingAccess(true);
            await api.put(`/users/${accessUserId}/pages`, { pageKeys: accessKeys });
            toast("Page access updated successfully.");
            loadUsers();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to update page access.");
        } finally {
            setSavingAccess(false);
        }
    };

    const toggleLock = async () => {
        if (!accessUserId) return;
        const nextLocked = !accessLocked;
        try {
            await api.post(`/users/${accessUserId}/${nextLocked ? "lock" : "unlock"}`);
            setAccessLocked(nextLocked);
            toast(nextLocked ? "Page access locked." : "Page access unlocked.");
            loadUsers();
        } catch (error) {
            toast(error.response?.data?.message || "Unable to change lock state.");
        }
    };


    // =====================================================
    // HELPERS
    // =====================================================

    const labelForRole = (role) => {
        if (role === "teacher") return "Teacher";
        if (role === "accountant") return "Accountant";
        if (role === "principal") return "Principal";
        if (role === "manager") return "Manager";
        if (role === "admin") return "Admin";
        return role;
    };

    const isManageable = (role) =>
        ["accountant", "principal", "manager", "teacher"].includes(role);


    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="dashboard">
            <Sidebar />

            <div className="main-content">
                <Navbar />

                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>User Management</h2>
                            <p>Admin can create staff accounts and control which pages each can access.</p>
                        </div>
                    </div>

                    {/* =================================================
                        CREATE USER
                    ================================================= */}
                    <div className="settings-card">
                        <h3>Create Staff Account</h3>

                        <form
                            onSubmit={createUser}
                            style={{
                                display: "grid",
                                gap: "12px",
                                marginTop: "20px",
                                maxWidth: "500px"
                            }}
                        >
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="Full name"
                                required
                            />

                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="Email"
                                required
                            />

                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Initial password"
                                minLength="8"
                                required
                            />

                            <select
                                name="role"
                                value={form.role}
                                onChange={handleChange}
                            >
                                <option value="accountant">Accountant</option>
                                <option value="principal">Principal</option>
                                <option value="manager">Manager</option>
                                <option value="teacher">Teacher</option>
                            </select>

                            <button type="submit" className="primary-btn">
                                Create Account
                            </button>
                        </form>
                    </div>

                    {/* =================================================
                        USERS TABLE
                        The Page Access panel renders INLINE — a full-width
                        row right below the user whose "Page Access"
                        button was clicked, not at the bottom of the page.
                    ================================================= */}
                    <div className="table-container" style={{ marginTop: "25px" }}>
                        <table className="stack-sm">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Access</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6">Loading...</td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6">No users found.</td>
                                    </tr>
                                ) : (
                                    users.flatMap((user) => {
                                        const rows = [
                                        <tr key={user.id}>
                                            <td data-label="Name">{user.name}</td>
                                            <td data-label="Email">{user.email}</td>
                                            <td data-label="Role">{labelForRole(user.role)}</td>
                                            <td data-label="Access">
                                                {user.role === "admin"
                                                    ? "Full (admin)"
                                                    : user.accessLocked
                                                        ? "🔒 Locked"
                                                        : "Editable"}
                                            </td>
                                            <td data-label="Created">{user.createdAt}</td>
                                            <td data-label="">
                                                {isManageable(user.role) ? (
                                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                        <button type="button" onClick={() => openAccess(user)}>
                                                            Page Access
                                                        </button>
                                                        <button type="button" onClick={() => resetPassword(user)}>
                                                            Reset Password
                                                        </button>
                                                        <button type="button" onClick={() => deleteUser(user)}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span>Current Admin</span>
                                                )}
                                            </td>
                                        </tr>
                                        ];

                                        // Inline Page Access panel — appears right
                                        // below this user's row, not at page bottom.
                                        if (accessUserId === user.id) {
                                            rows.push(
                                                <tr key={`${user.id}-access`} className="access-panel-row">
                                                    <td colSpan="6" style={{ padding: "0" }}>
                                                        <div className="settings-card" style={{ margin: "0", borderRadius: "0" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    justifyContent: "space-between",
                                                                    alignItems: "center",
                                                                    flexWrap: "wrap",
                                                                    gap: "10px"
                                                                }}
                                                            >
                                                                <h3 style={{ margin: 0 }}>
                                                                    Page Access — {user.name} ({labelForRole(user.role)})
                                                                </h3>
                                                                <button type="button" onClick={closeAccess}>Close</button>
                                                            </div>

                                                            {accessLocked && (
                                                                <p style={{ color: "#b45309", marginTop: "12px" }}>
                                                                    🔒 This user's access is locked. Unlock to make changes.
                                                                </p>
                                                            )}

                                                            {accessLoading ? (
                                                                <p style={{ marginTop: "15px" }}>Loading access...</p>
                                                            ) : (
                                                                <>
                                                                    <div
                                                                        style={{
                                                                            display: "grid",
                                                                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                                                                            gap: "10px",
                                                                            marginTop: "18px"
                                                                        }}
                                                                    >
                                                                        {/* Settings is open to every user by
                                                                            default — nothing to grant here. */}
                                                                        {pageRegistry.filter((page) => page.key !== "settings" && grantableKeys.includes(page.key)).map((page) => (
                                                                            <label
                                                                                key={page.key}
                                                                                style={{
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    gap: "8px",
                                                                                    padding: "8px 10px",
                                                                                    border: "1px solid #e2e2e2",
                                                                                    borderRadius: "6px",
                                                                                    opacity: accessLocked ? 0.6 : 1,
                                                                                    cursor: accessLocked ? "not-allowed" : "pointer"
                                                                                }}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={accessKeys.includes(page.key)}
                                                                                    disabled={accessLocked}
                                                                                    onChange={() => toggleKey(page.key)}
                                                                                />
                                                                                <span>{page.label}</span>
                                                                                <small style={{ color: "#64748B", fontSize: "12px", marginLeft: "8px" }}>({page.description})</small>
                                                                            </label>
                                                                        ))}
                                                                    </div>

                                                                    <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                                                                        <button
                                                                            type="button"
                                                                            className="primary-btn"
                                                                            onClick={saveAccess}
                                                                            disabled={accessLocked || savingAccess}
                                                                        >
                                                                            {savingAccess ? "Saving..." : "Save Access"}
                                                                        </button>

                                                                        <button type="button" onClick={toggleLock}>
                                                                            {accessLocked ? "Unlock" : "Lock"}
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return rows;
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
            <PromptDialog
                open={!!pwTarget && pwStage === "new"}
                onClose={closePwDialogs}
                onConfirm={handlePwNew}
                title={pwTarget ? `Set a new password for ${pwTarget.name}` : ""}
                message="At least 8 characters."
                type="password"
                requireValue
                placeholder="New password"
                confirmLabel="Continue"
                busy={pwBusy}
            />

            <PromptDialog
                open={!!pwTarget && pwStage === "confirm"}
                onClose={closePwDialogs}
                onConfirm={handlePwConfirm}
                title={pwTarget ? `Confirm the new password for ${pwTarget.name}` : ""}
                message="Passwords are case-sensitive."
                type="password"
                requireValue
                placeholder="Re-enter the new password"
                confirmLabel="Reset Password"
                busy={pwBusy}
            />

        </div>
    );
}


export default UsersPage;
