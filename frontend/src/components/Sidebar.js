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

    const menuItems = APP_PAGES.filter(
        (page) =>
            isAdmin ||
            // Settings is open to every user by default.
            page.key === "settings" ||
            allowedPages.includes(page.key)
    );
    // Ungrouped items (Dashboard) pin to the top; the rest fall into
    // collapsible sections. The section holding the current route starts open.
    // ADMIN ONLY: other users get a flat, always-open list instead of
    // stacked collapsible sections.
    const topItems = menuItems.filter((i) => !i.group);
    const groups = PAGE_GROUPS
        .map((name) => ({ name, items: menuItems.filter((i) => i.group === name) }))
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
            <span className="menu-icon">{item.icon}</span>
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
                            width: "45px",
                            height: "45px",
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
                        menuItems.map(renderLink)
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
