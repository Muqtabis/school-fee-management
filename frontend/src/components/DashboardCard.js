function DashboardCard({
  title,
  value,
  icon,
  color = "#2563EB",
  chipColor,
  onClick
}) {
  // When a destination is provided the card becomes an
  // accessible click target ("Students 599" -> Students page, etc.)
  const interactive = typeof onClick === "function";

  const handleKeyDown = (e) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={"dashboard-card" + (interactive ? " clickable" : "")}
      style={{
        borderTop: `4px solid ${color}`
      }}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={interactive ? `${title} — open` : undefined}
    >
      <div className="card-header">
        <div
          className="card-icon"
          style={{
            backgroundColor: chipColor || color
          }}
        >
          {icon}
        </div>

        <div className="card-details">
          <h3>{title}</h3>
          <h1>{value}</h1>
        </div>
      </div>
    </div>
  );
}

export default DashboardCard;
