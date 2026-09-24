import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../services/api";


function UsersPage() {

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Master list of assignable pages (from backend registry).
    const [pageRegistry, setPageRegistry] = useState([]);

    // The user whose access is being edited, plus working state.
    const [accessUser, setAccessUser] = useState(null);
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
        role: "receptionist"
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
            alert(error.response?.data?.message || "Unable to load users.");
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
    // CREATE USER (receptionist or teacher)
    // =====================================================

    const createUser = async (e) => {
        e.preventDefault();
        try {
            await api.post("/users", form);
            alert(`${labelForRole(form.role)} created successfully.`);
            setForm({ name: "", email: "", password: "", role: "receptionist" });
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to create user.");
        }
    };


    // =====================================================
    // RESET PASSWORD
    // =====================================================

    const resetPassword = async (user) => {
        const newPassword = window.prompt(`Enter a new password for ${user.name}:`);
        if (newPassword === null) return;

        if (newPassword.length < 8) {
            alert("Password must contain at least 8 characters.");
            return;
        }

        const confirmPassword = window.prompt("Confirm the new password:");
        if (confirmPassword !== newPassword) {
            alert("Passwords do not match.");
            return;
        }

        try {
            await api.put(`/users/${user.id}/password`, { password: newPassword });
            alert("Password reset successfully.");
        } catch (error) {
            alert(error.response?.data?.message || "Unable to reset password.");
        }
    };


    // =====================================================
    // DELETE USER
    // =====================================================

    const deleteUser = async (user) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete ${user.name}?\n\nThis will remove their ERP login.`
        );
        if (!confirmed) return;

        try {
            await api.delete(`/users/${user.id}`);
            alert("User deleted successfully.");
            if (accessUser && accessUser.id === user.id) closeAccess();
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to delete user.");
        }
    };


    // =====================================================
    // PAGE ACCESS EDITOR
    // =====================================================

    const openAccess = async (user) => {
        setAccessUser(user);
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
            alert(error.response?.data?.message || "Unable to load page access.");
            setAccessUser(null);
        } finally {
            setAccessLoading(false);
        }
    };

    const closeAccess = () => {
        setAccessUser(null);
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
        if (!accessUser) return;
        try {
            setSavingAccess(true);
            await api.put(`/users/${accessUser.id}/pages`, { pageKeys: accessKeys });
            alert("Page access updated successfully.");
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to update page access.");
        } finally {
            setSavingAccess(false);
        }
    };

    const toggleLock = async () => {
        if (!accessUser) return;
        const nextLocked = !accessLocked;
        try {
            await api.post(`/users/${accessUser.id}/${nextLocked ? "lock" : "unlock"}`);
            setAccessLocked(nextLocked);
            alert(nextLocked ? "Page access locked." : "Page access unlocked.");
            loadUsers();
        } catch (error) {
            alert(error.response?.data?.message || "Unable to change lock state.");
        }
    };


    // =====================================================
    // HELPERS
    // =====================================================

    const labelForRole = (role) => {
        if (role === "teacher") return "Teacher";
        if (role === "receptionist") return "Receptionist";
        if (role === "admin") return "Admin";
        return role;
    };

    const isManageable = (role) => role === "receptionist" || role === "teacher";


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
                                <option value="receptionist">Receptionist</option>
                                <option value="teacher">Teacher</option>
                            </select>

                            <button type="submit" className="primary-btn">
                                Create Account
                            </button>
                        </form>
                    </div>

                    {/* =================================================
                        USERS TABLE
                    ================================================= */}
                    <div className="table-container" style={{ marginTop: "25px" }}>
                        <table>
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
                                    users.map((user) => (
                                        <tr key={user.id}>
                                            <td>{user.name}</td>
                                            <td>{user.email}</td>
                                            <td>{labelForRole(user.role)}</td>
                                            <td>
                                                {user.role === "admin"
                                                    ? "Full (admin)"
                                                    : user.accessLocked
                                                        ? "🔒 Locked"
                                                        : "Editable"}
                                            </td>
                                            <td>{user.createdAt}</td>
                                            <td>
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* =================================================
                        PAGE ACCESS PANEL
                    ================================================= */}
                    {accessUser && (
                        <div className="settings-card" style={{ marginTop: "25px" }}>
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
                                    Page Access — {accessUser.name} ({labelForRole(accessUser.role)})
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
                                        {pageRegistry.filter((page) => grantableKeys.includes(page.key)).map((page) => (
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
                    )}

                </div>
            </div>
        </div>
    );
}


export default UsersPage;
