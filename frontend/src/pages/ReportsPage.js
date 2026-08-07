import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

import api from "../services/api";

function ReportsPage() {

    const [summary, setSummary] = useState({
        totalStudents: 0,
        totalPayments: 0,
        totalCollection: 0,
        pendingFees: 0
    });

    useEffect(() => {

        fetchSummary();

    }, []);

    const fetchSummary = async () => {

        try {

            const res = await api.get("/payments/summary");

            setSummary(res.data);

        }

        catch (error) {

            console.log(error);

        }

    };

    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    <div className="page-header">

                        <h2>Reports</h2>

                    </div>

                    <div className="cards">

                        <div className="dashboard-card">

                            <h3>Total Students</h3>

                            <h1>{summary.totalStudents}</h1>

                        </div>

                        <div className="dashboard-card">

                            <h3>Total Payments</h3>

                            <h1>{summary.totalPayments}</h1>

                        </div>

                        <div className="dashboard-card">

                            <h3>Total Collection</h3>

                            <h1>₹ {summary.totalCollection}</h1>

                        </div>

                        <div className="dashboard-card">

                            <h3>Pending Fees</h3>

                            <h1>₹ {summary.pendingFees}</h1>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default ReportsPage;