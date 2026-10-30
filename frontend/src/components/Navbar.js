import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

// Maps each route to the title shown in the top bar. Falls back to a
// title derived from the path so new routes still get a sensible label
// instead of the old hardcoded "Dashboard".
const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/students": "Students",
  "/fees": "Fee Management",
  "/payments": "Payments",
  "/expenses": "Expenses",
  "/reports": "Reports",
  "/class-management": "Class Management",
  "/teacher-management": "Teacher Management",
  "/exam-results": "Exam Results",
  "/results-overview": "Results Overview",
  "/attendance-overview": "Attendance Overview",
  "/student-attendance": "Student Attendance",
  "/teacher-attendance": "Staff Attendance",
  "/marks-entry": "Marks Entry",
  "/my-attendance": "My Attendance",
  "/notifications": "Notifications",
  "/settings": "Settings",
  "/users": "User Management",
};

function titleFromPath(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const seg = (pathname || "").split("/").filter(Boolean)[0];
  if (!seg) return "Dashboard";
  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Navbar() {
  const { user } = useAuth();
  const { toggleSidebar } = useUI();
  const { pathname } = useLocation();

  // Manual dark/light toggle (independent of system preference).
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme-preference", next);
    } catch (e) {
      /* storage unavailable — toggle still works for the session */
    }
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  const pageTitle = titleFromPath(pathname);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="nav-hamburger"
          aria-label="Open menu"
          onClick={toggleSidebar}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <h2>{pageTitle}</h2>
          <p>{today}</p>
        </div>
      </div>

      <div className="navbar-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

        <div className="user-profile">
          <div className="avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
          </div>

          <div className="user-info">
            <h4>{user?.name || "Administrator"}</h4>
            <span>{user?.role || "Admin"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;