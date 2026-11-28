import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { APP_PAGES, PAGE_GROUPS } from "../config/pages";

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, allowedPages } = useAuth();
    const { sidebarOpen, closeSidebar } = useUI();

    // =====================================================
    // BUILD MENU FROM ALLOWED PAGES
    //
    // Admin sees every page; everyone else sees only the
    // pages admin assigned them. The list is driven by the
    // shared page registry so order stays consistent.
    // =====================================================
    const isAdmin = user?.role === "admin";

    // Pages every non-admin user gets without a grant:
    // Settings, My Attendance, My Schedule and My Profile.
    const DEFAULT_PAGES = ["settings", "my_attendance", "my_schedule", "my_profile"];

    const menuItems = APP_PAGES.filter(
        (page) => isAdmin || DEFAULT_PAGES.includes(page.key) || allowedPages.includes(page.key)
    );

    // My Profile pins to the top: first for staff, second (after Dashboard)
    // for admin. It is never shown inside a collapsible group.
    const pinnedKeys = ["dashboard", "my_profile"];
    const orderMenu = (list) => {
        const dashboard = list.find((i) => i.key === "dashboard");
        const profile = list.find((i) => i.key === "my_profile");
        const rest = list.filter((i) => i !== dashboard && i !== profile);
        return (isAdmin ? [dashboard, profile] : [profile, dashboard])
            .filter(Boolean)
            .concat(rest);
    };
    const orderedItems = orderMenu(menuItems);

    // The pinned items plus any other ungrouped pages sit above the groups.
    // The section holding the current route starts open. Admin gets the
    // collapsible groups; other users get a flat, always-open list.
    const topItems = orderedItems.filter((i) => !i.group || pinnedKeys.includes(i.key));
    const groups = PAGE_GROUPS
        .map((name) => ({
            name,
            items: orderedItems.filter((i) => i.group === name && !pinnedKeys.includes(i.key))
        }))
        .filter((g) => g.items.length);
    const activeItem = menuItems.find((i) => location.pathname.startsWith(i.path));
    const activeGroup = activeItem ? activeItem.group : null;

    const [openGroups, setOpenGroups] = useState({});
    const isOpen = (name) => (name in openGroups ? openGroups[name] : name === activeGroup);
    const toggleGroup = (name) => setOpenGroups((p) => ({ ...p, [name]: !isOpen(name) }));

    const renderLink = (item) => (
        <NavLink
            key={item.path}
            to={item.path}
            onClick={closeSidebar}
            className={({ isActive }) => (isActive ? "menu-item active" : "menu-item")}
        >
            <span>{item.name || item.label}</span>
        </NavLink>
    );

    // =====================================================
    // LOGOUT
    // =====================================================
    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // =====================================================
    // UI
    // =====================================================
    return (
        <>
            {/* Backdrop: only visible/active on mobile when the drawer is open */}
            <div
                className={"sidebar-backdrop" + (sidebarOpen ? " open" : "")}
                onClick={closeSidebar}
            />

            <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
                <div className="sidebar-header" style={{ textAlign: "center", padding: "15px 10px" }}>
                    <img
                        src="/logo.png"
                        alt="School Logo"
                        style={{
                            width: "65px",
                            height: "65px",
                            objectFit: "contain",
                            margin: "0 auto 8px",
                            display: "block"
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                    <h2 style={{ fontSize: "16px", margin: "0" }}>THE AGE SCHOOL</h2>
                    <p style={{ fontSize: "11px", margin: "2px 0 0", color: "#aaa" }}>Institute of Pre, Primary and Secondary Education</p>
                    <p style={{ fontSize: "11px", margin: "2px 0 0", color: "#aaa" }}>BASAVAKALYAN</p>
                </div>

                <nav className="sidebar-menu">
                    {isAdmin ? (
                        <>
                            {topItems.map(renderLink)}
                            {groups.map((g) => (
                                <div key={g.name} className={"sidebar-group" + (isOpen(g.name) ? " open" : "")}>
                                    <button
                                        type="button"
                                        className="sidebar-group-header"
                                        onClick={() => toggleGroup(g.name)}
                                        aria-expanded={isOpen(g.name)}
                                    >
                                        <span>{g.name}</span>
                                        <span className="group-chevron">{isOpen(g.name) ? "▾" : "▸"}</span>
                                    </button>
                                    {isOpen(g.name) && g.items.map(renderLink)}
                                </div>
                            ))}
                        </>
                    ) : (
                        // Non-admin: flat list, every granted page visible
                        // directly (no collapsible stacked sections).
                        orderedItems.map(renderLink)
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
