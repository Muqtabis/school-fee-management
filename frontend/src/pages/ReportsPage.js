import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

import api from "../services/api";

function ReportsPage() {

    const [period, setPeriod] = useState("all");

    const [report, setReport] = useState({
        totalStudents: 0,
        totalPayments: 0,
        totalCollection: 0,
        pendingFees: 0,
        averagePayment: 0,
        highestPayment: 0,
        modeCollection: [],
        classCollection: [],
        recentPayments: []
    });

    const [loading, setLoading] = useState(true);

    // =====================================================
    // FETCH REPORT
    // =====================================================

    const fetchReport = async () => {

        try {

            setLoading(true);

            const response =
                await api.get(
                    `/payments/report-summary?period=${period}`
                );

            console.log(
                "REPORT DATA:",
                response.data
            );

            setReport(response.data);

        } catch (error) {

            console.error(
                "REPORT ERROR:",
                error
            );

        } finally {

            setLoading(false);

        }
    };

    // =====================================================
    // LOAD WHEN PERIOD CHANGES
    // =====================================================

    useEffect(() => {

        fetchReport();

    }, [period]);

    // =====================================================
    // FORMAT MONEY
    // =====================================================

    const money = (value) => {

        return `₹${Number(
            value || 0
        ).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    };

    // =====================================================
    // PERIOD NAME
    // =====================================================

    const getPeriodName = () => {

        if (period === "week") {
            return "This Week";
        }

        if (period === "month") {
            return "This Month";
        }

        return "All Time";
    };

    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    {/* =====================================
                        PAGE HEADER
                    ====================================== */}

                    <div className="page-header">

                        <div>

                            <h2>
                                Reports
                            </h2>

                            <p>
                                Detailed fee collection
                                and payment reports
                            </p>

                        </div>

                        <div className="report-period">

                            <label>
                                Report Period
                            </label>

                            <select
                                value={period}
                                onChange={(e) =>
                                    setPeriod(
                                        e.target.value
                                    )
                                }
                            >

                                <option value="all">
                                    All Time
                                </option>

                                <option value="week">
                                    This Week
                                </option>

                                <option value="month">
                                    This Month
                                </option>

                            </select>

                        </div>

                    </div>

                    <div className="report-period-text">

                        Showing report for{" "}

                        <strong>
                            {getPeriodName()}
                        </strong>

                    </div>

                    {/* =====================================
                        SUMMARY CARDS
                    ====================================== */}

                    <div className="report-cards">

                        <div className="report-summary-card">

                            <span>
                                Total Students
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : report.totalStudents}
                            </strong>

                            <small>
                                Registered students
                            </small>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Payments
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : report.totalPayments}
                            </strong>

                            <small>
                                Transactions in period
                            </small>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Collection
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : money(
                                        report.totalCollection
                                    )}
                            </strong>

                            <small>
                                Total amount collected
                            </small>

                        </div>


                        <div className="report-summary-card pending">

                            <span>
                                Pending Fees
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : money(
                                        report.pendingFees
                                    )}
                            </strong>

                            <small>
                                Outstanding fees
                            </small>

                        </div>

                    </div>

                    {/* =====================================
                        SECONDARY SUMMARY
                    ====================================== */}

                    <div className="report-small-cards">

                        <div className="report-small-card">

                            <span>
                                Average Payment
                            </span>

                            <strong>
                                {money(
                                    report.averagePayment
                                )}
                            </strong>

                        </div>


                        <div className="report-small-card">

                            <span>
                                Highest Payment
                            </span>

                            <strong>
                                {money(
                                    report.highestPayment
                                )}
                            </strong>

                        </div>


                        <div className="report-small-card">

                            <span>
                                Payment Transactions
                            </span>

                            <strong>
                                {report.totalPayments}
                            </strong>

                        </div>

                    </div>

                    {/* =====================================
                        REPORT GRID
                    ====================================== */}

                    <div className="report-grid">

                        {/* PAYMENT MODE */}

                        <div className="report-panel">

                            <div className="report-panel-header">

                                <div>

                                    <h3>
                                        Collection by
                                        Payment Mode
                                    </h3>

                                    <p>
                                        Cash, UPI, card
                                        and bank payments
                                    </p>

                                </div>

                            </div>

                            {report.modeCollection.length === 0 ? (

                                <div className="report-empty">

                                    No payment data
                                    available

                                </div>

                            ) : (

                                <div className="report-list">

                                    {report.modeCollection.map(
                                        (item) => (

                                            <div
                                                className="report-list-row"
                                                key={item.mode}
                                            >

                                                <span>
                                                    {item.mode}
                                                </span>

                                                <strong>
                                                    {money(
                                                        item.amount
                                                    )}
                                                </strong>

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </div>


                        {/* CLASS-WISE */}

                        <div className="report-panel">

                            <div className="report-panel-header">

                                <div>

                                    <h3>
                                        Class-wise
                                        Collection
                                    </h3>

                                    <p>
                                        Fee collection
                                        by class
                                    </p>

                                </div>

                            </div>

                            {report.classCollection.length === 0 ? (

                                <div className="report-empty">

                                    No class data
                                    available

                                </div>

                            ) : (

                                <div className="report-list">

                                    {report.classCollection.map(
                                        (item) => (

                                            <div
                                                className="report-list-row"
                                                key={item.className}
                                            >

                                                <div>

                                                    <strong>
                                                        {item.className}
                                                    </strong>

                                                    <small>
                                                        {item.payments}
                                                        {" "}
                                                        payments
                                                    </small>

                                                </div>

                                                <strong>
                                                    {money(
                                                        item.collection
                                                    )}
                                                </strong>

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </div>

                    </div>

                    {/* =====================================
                        RECENT PAYMENTS
                    ====================================== */}

                    <div className="report-panel recent-payments">

                        <div className="report-panel-header">

                            <div>

                                <h3>
                                    Recent Payments
                                </h3>

                                <p>
                                    Latest fee transactions
                                </p>

                            </div>

                        </div>

                        {report.recentPayments.length === 0 ? (

                            <div className="report-empty">

                                No payments available
                                for this period.

                            </div>

                        ) : (

                            <div className="report-table-wrapper">

                                <table className="report-table">

                                    <thead>

                                        <tr>

                                            <th>
                                                Student
                                            </th>

                                            <th>
                                                Class
                                            </th>

                                            <th>
                                                Date
                                            </th>

                                            <th>
                                                Payment Mode
                                            </th>

                                            <th>
                                                Amount
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {report.recentPayments.map(
                                            (payment) => (

                                                <tr
                                                    key={payment.id}
                                                >

                                                    <td>
                                                        <strong>
                                                            {
                                                                payment.studentName
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {
                                                            payment.className
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            payment.paymentDate
                                                        }
                                                    </td>

                                                    <td>

                                                        <span className="payment-badge">
                                                            {
                                                                payment.paymentMode
                                                            }
                                                        </span>

                                                    </td>

                                                    <td>
                                                        <strong>
                                                            {money(
                                                                payment.amount
                                                            )}
                                                        </strong>
                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                </div>

            </div>

        </div>
    );
}

export default ReportsPage;