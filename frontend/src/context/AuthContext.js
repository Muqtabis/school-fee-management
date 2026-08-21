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

    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef(null);

    // =====================================================
    // LOGOUT
    // =====================================================
    const logout = useCallback(() => {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("lastActivity");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setUser(null);
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
    const login = (token, userData) => {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("lastActivity", Date.now().toString());
        setUser(userData);
        resetTimer();
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
            .then((res) => {
                setUser(res.data.user);
                sessionStorage.setItem("user", JSON.stringify(res.data.user));
                resetTimer();
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
    }, [logout, resetTimer]);

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                loading
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}