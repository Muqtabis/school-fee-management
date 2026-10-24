import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { APP_PAGES, PAGE_GROUPS } from "../config/pages";
import Modal from "./Modal";

// =====================================================
// BOTTOM TAB BAR (Requirement 2 — adaptive navigation)
//
// MOBILE + TABLET ONLY (< 1024px; hidden by platform.css on
// desktop where the persistent Sidebar rail takes over).
//
// Platform styling is supplied by platform.css:
//   - iOS (HIG): translucent blurred bar (backdrop-filter),
//     safe-area padding for the home indicator.
//   - Android (M3): pill highlight on the active destination
//     and 48x48dp minimum touch targets.
//
// Popup policy (Requirement 3): tapping "More" opens a
// CENTERED MODAL (never a dropdown or side drawer) listing
// every allowed page grouped by section, plus Logout.
// =====================================================

function TabBar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, allowedPages } = useAuth();
    const [moreOpen, setMoreOpen] = useState(false);

    const isAdmin = user?.role === "admin";
    const menuItems = APP_PAGES.filter(
        (page) => isAdmin || allowedPages.includes(page.key)
    );

    // First four pages sit directly on the bar; everything else
    // is reachable through the centered "More" dialog.
    const primaryItems = menuItems.slice(0, 4);

    const groups = PAGE_GROUPS.map((name) => ({
        name,
        items: menuItems.filter((i) => i.group === name)
    })).filter((g) => g.items.length);

    const ungrouped = menuItems.filter((i) => !i.group);

    const go = (path) => {
        setMoreOpen(false);
        navigate(path);
    };

    const handleLogout = () => {
        setMoreOpen(false);
        logout();
        navigate("/login");
    };

    const renderTab = (item) => {
        const active = location.pathname.startsWith(item.path);
        return (
            <button
                key={item.key}
                type="button"
                className={active ? "tab-item active" : "tab-item"}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.path)}
            >
                <span className="tab-icon" aria-hidden="true">{item.icon}</span>
                <span className="tab-label">{item.label}</span>
            </button>
        );
    };

    return (
        <>
            <nav
                className="app-tabbar"
                aria-label="Primary navigation (mobile)"
            >
                <div className="app-tabbar-inner">
                    {primaryItems.map(renderTab)}
                    <button
                        type="button"
                        className="tab-item"
                        aria-haspopup="dialog"
                        aria-expanded={moreOpen}
                        onClick={() => setMoreOpen(true)}
                    >
                        <span className="tab-icon" aria-hidden="true">☰</span>
                        <span className="tab-label">More</span>
                    </button>
                </div>
            </nav>

            {/* CENTERED modal menu — requirement 3 */}
            <Modal
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                title="All Pages"
                ariaLabel="All pages menu"
            >
                <div className="app-more-menu">
                    {ungrouped.length > 0 && (
                        <div className="app-more-group">
                            {ungrouped.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className="app-more-item"
                                    onClick={() => go(item.path)}
                                >
                                    <span aria-hidden="true">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {groups.map((g) => (
                        <div key={g.name} className="app-more-group">
                            <h3>{g.name}</h3>
                            {g.items.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className="app-more-item"
                                    onClick={() => go(item.path)}
                                >
                                    <span aria-hidden="true">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    ))}

                    {menuItems.length === 0 && (
                        <p style={{ color: "var(--text-secondary)" }}>
                            No pages assigned to your account.
                        </p>
                    )}
                </div>

                <div className="app-more-footer">
                    <button type="button" className="app-more-logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </Modal>
        </>
    );
}

export default TabBar;
