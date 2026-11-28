import { toast, confirmDialog } from "../services/notify";
import { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PromptDialog from "../components/PromptDialog";
import OverlayDialog from "../components/OverlayDialog";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";


// Stable ordering for the Users page role filter tabs.
const ROLE_TAB_ORDER = [
    "admin",
    "principal",
    "manager",
    "accountant",
    "teacher",
    "supporting_teacher",
    "supporting_staff"
];

function UsersPage() {

    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === "admin";

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Role filter tabs — with many staff accounts, jumping straight
    // to a role is faster than scanning the full list.
    const [roleFilter, setRoleFilter] = useState("All");

    // The filtered rows the table renders.
    const visibleUsers = useMemo(
        () => (roleFilter === "All" ? users : users.filter((u) => u.role === roleFilter)),
        [users, roleFilter]
    );

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

    // Staff profile modal (student-profile style), admin-only edit.
    const [profileTarget, setProfileTarget] = useState(null);
    const [profile, setProfile] = useState(null);
    const [profileForm, setProfileForm] = useState({});
    const [profileEditing, setProfileEditing] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
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

    const openProfile = async (u) => {
        setProfileTarget(u);
        setProfile(null);
        setProfileEditing(false);
        setProfileLoading(true);
        try {
            const res = await api.get(`/users/${u.id}/profile`);
            const p = res.data.user || {};
            setProfile(p);
            setProfileForm({
                name: p.name || "", email: p.email || "", phone: p.phone || "",
                parentName: p.parentName || "", maritalStatus: p.maritalStatus || "single",
                spouseName: p.spouseName || "", dateOfJoining: p.dateOfJoining || "",
                designation: p.designation || "", address: p.address || ""
            });
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load profile.");
        } finally {
            setProfileLoading(false);
        }
    };

    const closeProfile = () => {
        setProfileTarget(null); setProfile(null); setProfileEditing(false);
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        try {
            setProfileSaving(true);
            const res = await api.put(`/users/${profileTarget.id}/profile`, profileForm);
            toast(res.data?.message || "Profile updated.");
            setProfileEditing(false);
            await Promise.all([openProfile(profileTarget), loadUsers()]);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to update profile.");
        } finally {
            setProfileSaving(false);
        }
    };


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
        if (role === "supporting_teacher") return "Supporting Teacher";
        if (role === "supporting_staff") return "Supporting Staff";
        if (role === "accountant") return "Accountant";
        if (role === "principal") return "Principal";
        if (role === "manager") return "Manager";
        if (role === "admin") return "Admin";
        return role;
    };

    const isManageable = (role) =>
        ["accountant", "principal", "manager", "teacher", "supporting_teacher", "supporting_staff"].includes(role);


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
                                <option value="supporting_teacher">Supporting Teacher</option>
                                <option value="supporting_staff">Supporting Staff</option>
                            </select>

                            <button type="submit" className="primary-btn">
                                Create Account
                            </button>
                        </form>
                    </div>

                    {/* =================================================
                        ROLE FILTER TABS
                        All + every role actually present (so the bar
                        stays short early on), each with a count badge.
                    ================================================= */}
                    {users.length > 0 && (
                        <div className="exam-tabbar" style={{ marginTop: "25px" }}>
                            <button
                                type="button"
                                className={`exam-tab ${roleFilter === "All" ? "exam-tab-active" : ""}`}
                                onClick={() => setRoleFilter("All")}
                            >
                                All
                                <span className="exam-badge">{users.length}</span>
                            </button>
                            {ROLE_TAB_ORDER
                                .map((role) => ({ role, count: users.filter((u) => u.role === role).length }))
                                .filter((t) => t.count > 0)
                                .map((t) => (
                                    <button
                                        key={t.role}
                                        type="button"
                                        className={`exam-tab ${roleFilter === t.role ? "exam-tab-active" : ""}`}
                                        onClick={() => setRoleFilter(t.role)}
                                    >
                                        {labelForRole(t.role)}
                                        <span className="exam-badge">{t.count}</span>
                                    </button>
                                ))}
                        </div>
                    )}

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
                                ) : visibleUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6">
                                            {roleFilter === "All"
                                                ? "No users found."
                                                : `No ${labelForRole(roleFilter)} accounts yet.`}
                                        </td>
                                    </tr>
                                ) : (
                                    visibleUsers.flatMap((user) => {
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
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: isManageable(user.role) ? 6 : 0 }}>
                                                    <button type="button" className="edit-btn" onClick={() => openProfile(user)}>View Profile</button>
                                                </div>
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
                                                                        {/* Settings and Notice Board are open to
                                                                            every user by default — nothing to grant. */}
                                                                        {pageRegistry.filter((page) => page.key !== "settings" && page.key !== "notices" && grantableKeys.includes(page.key)).map((page) => (
                                                                            <label
                                                                                key={page.key}
                                                                                style={{
                                                                                    display: "flex",
                                                                                    alignItems: "flex-start",
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
                                                                                    style={{ marginTop: 2, flexShrink: 0 }}
                                                                                    checked={accessKeys.includes(page.key)}
                                                                                    disabled={accessLocked}
                                                                                    onChange={() => toggleKey(page.key)}
                                                                                />
                                                                                <span style={{ display: "block", minWidth: 0 }}>
                                                                                    <strong style={{ display: "block", fontSize: "13px" }}>{page.label}</strong>
                                                                                    <small style={{ display: "block", color: "#64748B", fontSize: "12px", marginTop: "2px", lineHeight: 1.35 }}>{page.description}</small>
                                                                                </span>
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

            {profileTarget && (
                <OverlayDialog onClose={closeProfile} ariaLabel="Staff profile">
                    <div className="student-modal" style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                        <div className="modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                            <div>
                                <h2>Staff Profile</h2>
                                <p>{profileTarget.name} · {labelForRole(profileTarget.role)}</p>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {isAdmin && !profileEditing && profile && (
                                    <button type="button" className="edit-btn" onClick={() => setProfileEditing(true)}>Edit Profile</button>
                                )}
                                <button type="button" className="close-btn" onClick={closeProfile}>✕</button>
                            </div>
                        </div>

                        <div style={{ padding: 20 }}>
                            {profileLoading ? (
                                <p style={{ color: "#666" }}>Loading profile…</p>
                            ) : !profile ? (
                                <p style={{ color: "#666" }}>No profile found.</p>
                            ) : profileEditing ? (
                                <form onSubmit={saveProfile}>
                                    <h3 style={{ fontSize: 15, color: "#334155", margin: "0 0 14px" }}>Basic Details</h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        <label style={{ fontSize: 13 }}>Full Name<input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required /></label>
                                        <label style={{ fontSize: 13 }}>Email<input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required /></label>
                                        <label style={{ fontSize: 13 }}>Phone Number<input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="10-digit mobile" /></label>
                                        <label style={{ fontSize: 13 }}>Parent's Name<input value={profileForm.parentName} onChange={(e) => setProfileForm({ ...profileForm, parentName: e.target.value })} /></label>
                                        <label style={{ fontSize: 13 }}>Marital Status
                                            <select value={profileForm.maritalStatus} onChange={(e) => setProfileForm({ ...profileForm, maritalStatus: e.target.value })}>
                                                <option value="single">Single</option><option value="married">Married</option>
                                            </select>
                                        </label>
                                        <label style={{ fontSize: 13 }}>Spouse Name
                                            <input value={profileForm.spouseName} disabled={profileForm.maritalStatus !== "married"}
                                                onChange={(e) => setProfileForm({ ...profileForm, spouseName: e.target.value })} placeholder={profileForm.maritalStatus === "married" ? "Spouse name" : "Only if married"} />
                                        </label>
                                        <label style={{ fontSize: 13 }}>Date of Joining<input type="date" value={profileForm.dateOfJoining || ""} onChange={(e) => setProfileForm({ ...profileForm, dateOfJoining: e.target.value })} /></label>
                                        <label style={{ fontSize: 13 }}>Designation<input value={profileForm.designation || ""} onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })} /></label>
                                    </div>
                                    <label style={{ fontSize: 13, display: "block", marginTop: 12 }}>Address
                                        <textarea rows={3} value={profileForm.address || ""} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} style={{ width: "100%" }} />
                                    </label>
                                    <div className="modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                                        <button type="button" className="cancel-btn" onClick={() => setProfileEditing(false)}>Cancel</button>
                                        <button type="submit" className="primary-btn" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save Profile"}</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <h3 style={{ fontSize: 15, color: "#334155", margin: "0 0 12px" }}>Basic Details</h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: 14 }}>
                                        {[
                                            ["Full Name", profile.name],
                                            ["Email", profile.email],
                                            ["Phone Number", profile.phone],
                                            ["Parent's Name", profile.parentName],
                                            ["Marital Status", profile.maritalStatus === "married" ? "Married" : "Single"],
                                            ["Spouse Name", profile.maritalStatus === "married" ? profile.spouseName : "-"],
                                            ["Date of Joining", profile.dateOfJoining],
                                            ["Designation", profile.designation],
                                            ["Address", profile.address]
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
                                                <span style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
                                                <div style={{ color: "#0F172A", marginTop: 2 }}>{value || "-"}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 16 }}>Profile can be edited by an admin.</p>
                                </>
                            )}
                        </div>
                    </div>
                </OverlayDialog>
            )}

        </div>
    );
}


export default UsersPage;
