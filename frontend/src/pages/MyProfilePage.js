/* My Profile — mandatory landing page for every login.
   Shows the user's details, role and live page permissions. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../services/notify";
import { useAuth } from "../context/AuthContext";
import { APP_PAGES } from "../config/pages";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/Skeleton";

const ROLE_LABELS = {
    admin: "Admin",
    principal: "Principal",
    manager: "Manager",
    accountant: "Accountant",
    teacher: "Teacher",
    supporting_teacher: "Supporting Teacher",
    supporting_staff: "Supporting Staff"
};

const roleLabel = (role) => ROLE_LABELS[role] || role || "-";

export default function MyProfilePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [pageKeys, setPageKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [p, pages] = await Promise.all([
                api.get("/users/me/profile"),
                api.get("/auth/me/pages")
            ]);
            setProfile(p.data.user || null);
            setPageKeys(pages.data.pageKeys || []);
        } catch (error) {
            toast(error.response?.data?.message || "Unable to load your profile.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Live list: only pages this login can actually open.
    const allowed = APP_PAGES.filter((p) => {
        if (p.key === "my_profile") return false;
        return pageKeys.includes(p.key);
    });

    return (
        <div className="dashboard">
            <Sidebar />
            <div className="main-content">
                <Navbar />
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h2>My Profile</h2>
                            <p>Your account details, role and everything your login can access.</p>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="cancel-btn" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
                                {refreshing ? "Refreshing…" : "Refresh"}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <SkeletonTable rows={4} />
                    ) : !profile ? (
                        <div className="settings-card"><div className="empty-state"><strong>No profile found</strong><span>Contact an admin.</span></div></div>
                    ) : (
                        <>
                            <div className="settings-card">
                                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#7A1235", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>
                                        {String(profile.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{profile.name}</h3>
                                        <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>{profile.email}</p>
                                    </div>
                                    <span className="payment-badge mode-default" style={{ marginLeft: "auto" }}>{roleLabel(profile.role)}</span>
                                </div>
                            </div>

                            <div className="cards" style={{ marginTop: 16 }}>
                                <div className="dashboard-card"><h3>Role</h3><h1 style={{ fontSize: 20 }}>{roleLabel(profile.role)}</h1></div>
                                <div className="dashboard-card"><h3>Allowed Pages</h3><h1>{allowed.length}</h1></div>
                                <div className="dashboard-card"><h3>Member Since</h3><h1 style={{ fontSize: 18 }}>{profile.dateOfJoining || (profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-IN") : "-")}</h1></div>
                            </div>

                            <div className="settings-card" style={{ marginTop: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 17 }}>Personal Details</h3>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "4px 24px", marginTop: 12 }}>
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
                                        <div key={label} style={{ padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                                            <span style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
                                            <div style={{ color: "#0F172A", marginTop: 2, fontSize: 14 }}>{value || "-"}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="settings-card" style={{ marginTop: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 17 }}>What you can do</h3>
                                        <p style={{ color: "#666", marginTop: 6, fontSize: 13 }}>
                                            Updated live from your page access — if an admin assigns a new page, it appears here after Refresh.
                                        </p>
                                    </div>
                                    <span className="att-badge att-holiday">{allowed.length} pages</span>
                                </div>
                                <div className="cards" style={{ marginTop: 14 }}>
                                    {allowed.length === 0 ? (
                                        <div className="settings-card" style={{ width: "100%" }}><div className="empty-state"><strong>No pages assigned</strong><span>Contact an admin.</span></div></div>
                                    ) : allowed.map((p) => (
                                        <div key={p.key} className="dashboard-card" style={{ flex: "1 1 260px", minWidth: 0, display: "block" }}>
                                            <h3 style={{ fontSize: 14 }}>{p.label}</h3>
                                            <p style={{ color: "#64748B", fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>{p.description || "Open this page."}</p>
                                            <button type="button" className="clear-btn" style={{ marginTop: 10 }} onClick={() => navigate(p.path)}>Open</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
