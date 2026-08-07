import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";

import api from "../services/api";

function DashboardPage() {
  const [summary, setSummary] = useState({
    totalStudents: 0,
    totalPayments: 0,
    totalCollection: 0,
    pendingFees: 0,
  });

  const [recentPayments, setRecentPayments] = useState([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const summaryRes = await api.get("/payments/summary");
      setSummary(summaryRes.data);

      const paymentRes = await api.get("/payments");

      setRecentPayments(paymentRes.data.slice(0, 5));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="dashboard">

      <Sidebar />

      <div className="main-content">

        <Navbar />

        <div className="page-content">

          <div className="cards">

            <DashboardCard
              title="Students"
              value={summary.totalStudents}
              icon="👨‍🎓"
              color="#2563EB"
            />

            <DashboardCard
              title="Payments"
              value={summary.totalPayments}
              icon="💰"
              color="#22C55E"
            />

            <DashboardCard
              title="Collection"
              value={`₹ ${summary.totalCollection}`}
              icon="💵"
              color="#F59E0B"
            />

            <DashboardCard
              title="Pending Fees"
              value={`₹ ${summary.pendingFees}`}
              icon="⚠️"
              color="#EF4444"
            />

          </div>

          <div className="dashboard-grid">

            <div className="dashboard-table">

              <h3>Recent Payments</h3>

              <table>

                <thead>

                  <tr>

                    <th>Student</th>

                    <th>Amount</th>

                    <th>Date</th>

                    <th>Mode</th>

                  </tr>

                </thead>

                <tbody>

                  {recentPayments.length === 0 ? (

                    <tr>

                      <td colSpan="4">
                        No Payments Found
                      </td>

                    </tr>

                  ) : (

                    recentPayments.map((payment) => (

                      <tr key={payment.id}>

                        <td>{payment.studentName}</td>

                        <td>₹ {payment.amount}</td>

                        <td>{payment.paymentDate}</td>

                        <td>{payment.paymentMode}</td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default DashboardPage;