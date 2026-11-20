/*
 * MOBILE APP CHROME — wraps mobile page content with a native-feeling
 * header and fixed bottom tab bar. On desktop it renders children
 * unchanged, so every original page keeps its exact behavior.
 */
import { useEffect, useState } from "react";
import useIsMobile from "../../hooks/useIsMobile";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { APP_PAGES, PAGE_GROUPS } from "../../config/pages";
import api from "../../services/api";

const TABS = [
    { path: "/dashboard", label: "Home", icon: "⌂" },
    { path: "/students", label: "Students", icon: "◉" },
    { path: "/payments", label: "Fees", icon: "₹" },
    { path: "/student-attendance", label: "Attendance", icon: "✓" },
    { path: null, label: "More", icon: "⋯" }   // opens the full menu
];

export default function MobileShell({ children }) {
    const isMobile = useIsMobile();
    const { user, canAccess, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Pending reverse requests badge for approvers (never touches attendance).
    const isApprover = user?.role === "admin" || user?.role === "principal";
    useEffect(() => {
        if (!isApprover) return;
        const load = () => api.get("/payments/reverse-requests")
            .then((r) => setPendingCount((r.data || []).length))
            .catch(() => {});
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [isApprover, location.pathname]);

    // All hooks called unconditionally (Rules of Hooks).
    const isAuthPage = ["/login", "/forgot-password", "/reset-password"].some((p) =>
        location.pathname.startsWith(p)
    );
    // Desktop/tablet and auth screens render the original app unchanged.
    if (!isMobile || isAuthPage) return <>{children}</>;

    // EVERY web page, straight from the shared registry — nothing missing.
    const allowed = APP_PAGES.filter((p) => canAccess(p.key));
    const current = APP_PAGES.find((p) => p.path === location.pathname);
    const title = current?.label || "School ERP";

    return (
        <div className="m-app">
            <header className="m-appbar">
                <button
                    type="button"
                    className="m-menu-btn"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open menu"
                >☰</button>
                <div className="m-appbar-title">{title}</div>
                <div className="m-appbar-actions">
                    <button
                        type="button"
                        className="m-search-btn"
                        onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
                        aria-label="Search"
                    >⌕</button>
                    <button
                        type="button"
                        className="m-avatar"
                        onClick={() => setMenuOpen(true)}
                        aria-label="Account menu"
                    >
                        {(user?.name || "U").charAt(0).toUpperCase()}
                    </button>
                </div>
            </header>

            {/* Full-screen app menu — every page, grouped like the sidebar */}
            {menuOpen && (
                <div className="m-menu" onClick={() => setMenuOpen(false)}>
                    <div className="m-menu-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="m-menu-head">
                            <div className="m-menu-user">
                                <span className="m-avatar">{(user?.name || "U").charAt(0).toUpperCase()}</span>
                                <div>
                                    <strong>{user?.name || "User"}</strong>
                                    <small>{user?.role || ""}</small>
                                </div>
                            </div>
                            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
                        </div>
                        <div className="m-menu-scroll">
                            {APP_PAGES.filter((p) => !p.group).map((p) => (
                                <MenuLink key={p.key} page={p} allowed={allowed} go={(to) => { setMenuOpen(false); navigate(to); }} />
                            ))}
                            {PAGE_GROUPS.map((group) => {
                                const items = allowed.filter((p) => p.group === group);
                                if (!items.length) return null;
                                return (
                                    <div key={group} className="m-menu-group">
                                        <div className="m-menu-group-title">{group}</div>
                                        {items.map((p) => (
                                            <MenuLink key={p.key} page={p} allowed={allowed} go={(to) => { setMenuOpen(false); navigate(to); }} />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                        <button type="button" className="m-menu-logout" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
                            Log out
                        </button>
                    </div>
                </div>
            )}

            <main className="m-main">{children}</main>

            <nav className="m-tabbar">
                {TABS.map((t) => {
                    const page = t.path ? APP_PAGES.find((p) => p.path === t.path) : null;
                    if (page && !canAccess(page.key)) return null;
                    if (!t.path) {
                        return (
                            <button type="button" key="more" className="m-tab" onClick={() => setMenuOpen(true)}>
                                <span className="m-tab-icon">
                                    {t.icon}
                                    {pendingCount > 0 && <span className="m-badge-dot">{pendingCount}</span>}
                                </span>
                                <span className="m-tab-label">{t.label}</span>
                            </button>
                        );
                    }
                    return (
                        <NavLink
                            key={t.path}
                            to={t.path}
                            end={t.path === "/dashboard"}
                            className={({ isActive }) => "m-tab" + (isActive ? " m-tab-active" : "")}
                        >
                            <span className="m-tab-icon">{t.icon}</span>
                            <span className="m-tab-label">{t.label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </div>
    );
}

function MenuLink({ page, allowed, go }) {
    const isAllowed = allowed.some((p) => p.key === page.key);
    return (
        <button
            type="button"
            className="m-menu-link"
            disabled={!isAllowed}
            onClick={() => go(page.path)}
        >
            <span className="m-menu-icon">{page.icon}</span>
            <span>{page.label}</span>
            {!isAllowed && <small>no access</small>}
        </button>
    );
}
