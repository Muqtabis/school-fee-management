import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef
} from "react";

import api from "../services/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Session duration: 2 hours in milliseconds
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export default function AuthProvider({ children }) {
    // 1. Initialize user from sessionStorage
    const [user, setUser] = useState(() => {
        const savedUser = sessionStorage.getItem("user");
        return savedUser ? JSON.parse(savedUser) : null;
    });

    // Pages this user is allowed to open (page keys).
    const [allowedPages, setAllowedPages] = useState(() => {
        const saved = sessionStorage.getItem("allowedPages");
        return saved ? JSON.parse(saved) : [];
    });

    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef(null);

    // =====================================================
    // LOGOUT
    // =====================================================
    const logout = useCallback(() => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("lastActivity");
        sessionStorage.removeItem("allowedPages");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setUser(null);
        setAllowedPages([]);
    }, []);

    // =====================================================
    // LOAD MY PAGE ACCESS
    // =====================================================
    const fetchMyPages = useCallback(async () => {
        try {
            const res = await api.get("/auth/me/pages");
            const keys = res.data?.pageKeys || [];
            setAllowedPages(keys);
            sessionStorage.setItem("allowedPages", JSON.stringify(keys));
            return keys;
        } catch (err) {
            console.error("Load Pages Error:", err.response?.data || err.message);
            setAllowedPages([]);
            sessionStorage.setItem("allowedPages", JSON.stringify([]));
            return [];
        }
    }, []);

    // =====================================================
    // RESET INACTIVITY TIMER
    // =====================================================
    const resetTimer = useCallback(() => {
        const token = sessionStorage.getItem("token");
        if (!token) return;

        sessionStorage.setItem("lastActivity", Date.now().toString());

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Auto logout after 2 hours of inactivity
        timeoutRef.current = setTimeout(() => {
            alert("Session expired due to inactivity. Please log in again.");
            logout();
        }, SESSION_TIMEOUT_MS);
    }, [logout]);

    // =====================================================
    // LOGIN
    // =====================================================
    const login = async (token, userData) => {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("lastActivity", Date.now().toString());
        setUser(userData);
        resetTimer();
        // Load this user's allowed pages right after login so
        // the sidebar and routes reflect their access immediately.
        await fetchMyPages();
    };

    // =====================================================
    // VERIFY SESSION & LISTEN TO USER ACTIVITY
    // =====================================================
    useEffect(() => {
        const token = sessionStorage.getItem("token");
        const lastActivity = sessionStorage.getItem("lastActivity");

        // 1. Check if token exists
        if (!token) {
            setLoading(false);
            return;
        }

        // 2. Check if 2-hour session expired while page was closed
        if (lastActivity && Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS) {
            logout();
            setLoading(false);
            return;
        }

        // 3. Verify token integrity with backend
        api.get("/auth/profile")
            .then(async (res) => {
                setUser(res.data.user);
                sessionStorage.setItem("user", JSON.stringify(res.data.user));
                resetTimer();
                // Refresh allowed pages on every verified session so
                // access changes made by admin take effect on reload.
                await fetchMyPages();
            })
            .catch((err) => {
                console.error("Profile Error:", err.response?.data || err.message);
                logout();
            })
            .finally(() => {
                setLoading(false);
            });

        // 4. Track mouse movement, clicks, and typing to refresh the 2-hr window
        const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
        const handleUserActivity = () => resetTimer();

        activityEvents.forEach((event) => {
            window.addEventListener(event, handleUserActivity);
        });

        return () => {
            activityEvents.forEach((event) => {
                window.removeEventListener(event, handleUserActivity);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [logout, resetTimer, fetchMyPages]);

    // Helper: can this user open a given page key?
    // Admin always can.
    const canAccess = useCallback(
        (pageKey) => {
            if (user?.role === "admin") return true;
            return allowedPages.includes(pageKey);
        },
        [user, allowedPages]
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                allowedPages,
                canAccess,
                fetchMyPages,
                login,
                logout,
                loading
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}