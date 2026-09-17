import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // =====================================================
    // BASE MENU (VISIBLE TO ALL ROLES)
    // =====================================================
    const menuItems = [
        {
            name: "Students",
            path: "/students",
            icon: "👨‍🎓"
        },
        {
            name: "Fee Management",
            path: "/fees",
            icon: "📚"
        },
        {
            name: "Payments",
            path: "/payments",
            icon: "💰"
        },
        {
            name: "Expenses",
            path: "/expenses",
            icon: "💸"
        },
        {
            name: "Notifications",
            path: "/notifications",
            icon: "🔔"
        },
        {
            name: "Settings",
            path: "/settings",
            icon: "⚙️"
        }
    ];

    // =====================================================
    // ADMIN ONLY MENU (DASHBOARD, REPORTS, USERS)
    // =====================================================
    if (user?.role === "admin") {
        // Add Dashboard at the top
        menuItems.unshift({
            name: "Dashboard",
            path: "/dashboard",
            icon: "🏠"
        });

        // Add Reports before Notifications
        const notifIndex = menuItems.findIndex((item) => item.path === "/notifications");
        const insertIndex = notifIndex !== -1 ? notifIndex : menuItems.length;

        menuItems.splice(insertIndex, 0, {
            name: "Reports",
            path: "/reports",
            icon: "📊"
        });

        // Add Users at the bottom
        menuItems.push({
            name: "Users",
            path: "/users",
            icon: "👥"
        });
    }

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
        <aside className="sidebar">
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
                        className={({ isActive }) =>
                            isActive ? "menu-item active" : "menu-item"
                        }
                    >
                        <span className="menu-icon">{item.icon}</span>
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button className="logout-btn" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </aside>
    );
}

export default Sidebar;