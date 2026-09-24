import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { APP_PAGES } from "../config/pages";

function Sidebar() {
    const navigate = useNavigate();
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
        (page) => isAdmin || allowedPages.includes(page.key)
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
                    <p style={{ fontSize: "11px", margin: "2px 0 0", color: "#aaa" }}>ERP</p>
                </div>

                <nav className="sidebar-menu">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={closeSidebar}
                            className={({ isActive }) =>
                                isActive ? "menu-item active" : "menu-item"
                            }
                        >
                            <span className="menu-icon">{item.icon}</span>
                            <span>{item.name || item.label}</span>
                        </NavLink>
                    ))}
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
