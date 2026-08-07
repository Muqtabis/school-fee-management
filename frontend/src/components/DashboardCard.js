function DashboardCard({
  title,
  value,
  icon,
  color = "#2563EB"
}) {
  return (
    <div
      className="dashboard-card"
      style={{
        borderTop: `4px solid ${color}`
      }}
    >
      <div className="card-header">
        <div
          className="card-icon"
          style={{
            backgroundColor: color
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