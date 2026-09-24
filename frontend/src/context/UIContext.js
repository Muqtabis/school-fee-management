import { createContext, useContext, useState, useCallback, useEffect } from "react";

// =====================================================
// UI CONTEXT
//
// Small shared UI state. Currently just the mobile
// sidebar drawer: the Navbar hamburger opens it, the
// Sidebar renders as an off-canvas drawer, and the
// backdrop / any nav click closes it. Kept deliberately
// tiny so it stays maintainable.
// =====================================================

const UIContext = createContext({
    sidebarOpen: false,
    openSidebar: () => {},
    closeSidebar: () => {},
    toggleSidebar: () => {}
});

export function UIProvider({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

    // Lock the page behind the backdrop while the mobile drawer is
    // open so the content doesn't scroll under it. The CSS class only
    // has an effect at mobile widths where the drawer exists; on
    // desktop the drawer never opens so this stays inert.
    useEffect(() => {
        const cls = "drawer-open";
        if (sidebarOpen) {
            document.body.classList.add(cls);
        } else {
            document.body.classList.remove(cls);
        }
        return () => document.body.classList.remove(cls);
    }, [sidebarOpen]);

    return (
        <UIContext.Provider value={{ sidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    return useContext(UIContext);
}

export default UIProvider;
