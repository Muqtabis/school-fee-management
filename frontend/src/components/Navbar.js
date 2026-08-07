import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { user } = useAuth();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h2>Dashboard</h2>
        <p>{today}</p>
      </div>

      <div className="navbar-right">
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