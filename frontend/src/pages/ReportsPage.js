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

        recentPayments: [],

        totalExpenses: 0,
        totalExpenseAmount: 0,

        expenseCategories: [],
        recentExpenses: [],

        netBalance: 0

    });

    const [loading, setLoading] = useState(true);


    // =====================================================
    // MONEY FORMAT
    // =====================================================

    const money = (value) => {

        return `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

    };


    // =====================================================
    // EXPENSE PERIOD FILTER
    // =====================================================

    const isExpenseInPeriod = (expense) => {

        if (period === "all") {
            return true;
        }

        if (!expense.expenseDate) {
            return false;
        }

        const expenseDate = new Date(expense.expenseDate);

        const today = new Date();

        expenseDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);


        // -----------------------------
        // THIS MONTH
        // -----------------------------

        if (period === "month") {

            return (
                expenseDate.getMonth() === today.getMonth() &&
                expenseDate.getFullYear() === today.getFullYear()
            );

        }


        // -----------------------------
        // THIS WEEK
        // -----------------------------

        if (period === "week") {

            const day = today.getDay();

            const difference =
                day === 0 ? 6 : day - 1;

            const startOfWeek = new Date(today);

            startOfWeek.setDate(
                today.getDate() - difference
            );

            startOfWeek.setHours(0, 0, 0, 0);

            return (
                expenseDate >= startOfWeek &&
                expenseDate <= today
            );

        }


        return true;

    };


    // =====================================================
    // FETCH REPORT
    // =====================================================

    const fetchReport = async () => {

        try {

            setLoading(true);


            // =================================================
            // PAYMENT REPORT
            // =================================================

            const paymentResponse =
                await api.get(
                    `/payments/report-summary?period=${period}`
                );


            const paymentData =
                paymentResponse.data || {};


            // =================================================
            // EXPENSES
            // =================================================

            const expenseResponse =
                await api.get("/expenses");


            const allExpenses =
                Array.isArray(expenseResponse.data)
                    ? expenseResponse.data
                    : [];


            const filteredExpenses =
                allExpenses.filter(
                    isExpenseInPeriod
                );


            // =================================================
            // TOTAL EXPENSE
            // =================================================

            const totalExpenseAmount =
                filteredExpenses.reduce(
                    (total, expense) => {

                        return (
                            total +
                            Number(expense.amount || 0)
                        );

                    },
                    0
                );


            // =================================================
            // EXPENSE CATEGORIES
            // =================================================

            const categoryMap = {};


            filteredExpenses.forEach(
                (expense) => {

                    const category =
                        expense.category || "Other";


                    if (!categoryMap[category]) {

                        categoryMap[category] = {
                            category,
                            amount: 0,
                            count: 0
                        };

                    }


                    categoryMap[category].amount +=
                        Number(expense.amount || 0);


                    categoryMap[category].count += 1;

                }
            );


            const expenseCategories =
                Object.values(categoryMap).sort(
                    (a, b) =>
                        b.amount - a.amount
                );


            // =================================================
            // RECENT EXPENSES
            // =================================================

            const recentExpenses =
                [...filteredExpenses]
                    .sort(
                        (a, b) =>
                            new Date(b.expenseDate || 0) -
                            new Date(a.expenseDate || 0)
                    )
                    .slice(0, 10);


            // =================================================
            // COLLECTION
            // =================================================

            const totalCollection =
                Number(
                    paymentData.totalCollection
                ) || 0;


            // =================================================
            // NET BALANCE
            // =================================================

            const netBalance =
                totalCollection -
                totalExpenseAmount;


            // =================================================
            // UPDATE REPORT
            // =================================================

            setReport({

                totalStudents:
                    Number(
                        paymentData.totalStudents
                    ) || 0,

                totalPayments:
                    Number(
                        paymentData.totalPayments
                    ) || 0,

                totalCollection,

                pendingFees:
                    Number(
                        paymentData.pendingFees
                    ) || 0,

                averagePayment:
                    Number(
                        paymentData.averagePayment
                    ) || 0,

                highestPayment:
                    Number(
                        paymentData.highestPayment
                    ) || 0,

                modeCollection:
                    Array.isArray(
                        paymentData.modeCollection
                    )
                        ? paymentData.modeCollection
                        : [],

                classCollection:
                    Array.isArray(
                        paymentData.classCollection
                    )
                        ? paymentData.classCollection
                        : [],

                recentPayments:
                    Array.isArray(
                        paymentData.recentPayments
                    )
                        ? paymentData.recentPayments
                        : [],

                totalExpenses:
                    filteredExpenses.length,

                totalExpenseAmount,

                expenseCategories,

                recentExpenses,

                netBalance

            });

        }

        catch (error) {

            console.error(
                "REPORT ERROR:",
                error
            );

        }

        finally {

            setLoading(false);

        }

    };


    // =====================================================
    // LOAD REPORT
    // =====================================================

    useEffect(() => {

        fetchReport();

    }, [period]);


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


    // =====================================================
    // CHART VALUES
    // =====================================================

    const collection =
        Number(report.totalCollection) || 0;

    const expenses =
        Number(report.totalExpenseAmount) || 0;

    const maximum =
        Math.max(collection, expenses, 1);


    const collectionHeight =
        `${(collection / maximum) * 100}%`;

    const expenseHeight =
        `${(expenses / maximum) * 100}%`;


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="dashboard">

            <Sidebar />


            <div className="main-content">

                <Navbar />


                <div className="page-content">


                    {/* =================================================
                        HEADER
                    ================================================= */}

                    <div className="page-header">

                        <div>

                            <h2>
                                Reports
                            </h2>

                            <p>
                                Detailed fee collection,
                                expenses and financial reports
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


                    {/* =================================================
                        FEE COLLECTION
                    ================================================= */}

                    <h3 className="section-title">
                        Fee Collection
                    </h3>


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


                    {/* =================================================
                        PAYMENT DETAILS
                    ================================================= */}

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


                    {/* =================================================
                        SCHOOL EXPENSES
                    ================================================= */}

                    <h3 className="section-title">

                        School Expenses

                    </h3>


                    <div className="report-cards">


                        <div className="report-summary-card">

                            <span>
                                Expense Transactions
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : report.totalExpenses}
                            </strong>

                            <small>
                                Recorded expenses
                            </small>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Total Spent
                            </span>

                            <strong>
                                {loading
                                    ? "..."
                                    : money(
                                        report.totalExpenseAmount
                                    )}
                            </strong>

                            <small>
                                Total school spending
                            </small>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Net Balance
                            </span>

                            <strong
                                className={
                                    report.netBalance < 0
                                        ? "negative-balance"
                                        : "positive-balance"
                                }
                            >
                                {loading
                                    ? "..."
                                    : money(
                                        report.netBalance
                                    )}
                            </strong>

                            <small>
                                Collection minus expenses
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
                                Total fee income
                            </small>

                        </div>

                    </div>


                    {/* =================================================
                        COLLECTION VS EXPENSES
                    ================================================= */}

                    <div className="report-panel financial-chart-panel">


                        <div className="report-panel-header">

                            <div>

                                <h3>
                                    Collection vs Expenses
                                </h3>

                                <p>
                                    Overall financial comparison
                                    for {getPeriodName()}
                                </p>

                            </div>

                        </div>


                        <div className="financial-chart">


                            <div className="chart-value">

                                <span>
                                    Collection
                                </span>

                                <strong>
                                    {money(collection)}
                                </strong>

                            </div>


                            <div className="chart-area">


                                <div className="chart-column">

                                    <div className="chart-bar-wrapper">

                                        <div
                                            className="chart-bar collection-bar"
                                            style={{
                                                height:
                                                    collectionHeight
                                            }}
                                        />

                                    </div>

                                    <span>
                                        Collection
                                    </span>

                                </div>


                                <div className="chart-column">

                                    <div className="chart-bar-wrapper">

                                        <div
                                            className="chart-bar expense-bar"
                                            style={{
                                                height:
                                                    expenseHeight
                                            }}
                                        />

                                    </div>

                                    <span>
                                        Expenses
                                    </span>

                                </div>


                            </div>


                            <div className="chart-legend">


                                <div>

                                    <span className="legend-dot collection-dot" />

                                    <span>
                                        Collection
                                    </span>

                                </div>


                                <div>

                                    <span className="legend-dot expense-dot" />

                                    <span>
                                        Expenses
                                    </span>

                                </div>


                            </div>


                        </div>

                    </div>


                    {/* =================================================
                        FINANCIAL SUMMARY
                    ================================================= */}

                    <div className="report-small-cards">


                        <div className="report-small-card">

                            <span>
                                Total Collected
                            </span>

                            <strong>
                                {money(
                                    report.totalCollection
                                )}
                            </strong>

                        </div>


                        <div className="report-small-card">

                            <span>
                                Total Spent
                            </span>

                            <strong>
                                {money(
                                    report.totalExpenseAmount
                                )}
                            </strong>

                        </div>


                        <div className="report-small-card">

                            <span>
                                Balance After Expenses
                            </span>

                            <strong
                                className={
                                    report.netBalance < 0
                                        ? "negative-balance"
                                        : "positive-balance"
                                }
                            >
                                {money(
                                    report.netBalance
                                )}
                            </strong>

                        </div>

                    </div>


                    {/* =================================================
                        PAYMENT MODE + EXPENSE CATEGORY
                    ================================================= */}

                    <div className="report-grid">


                        {/* PAYMENT MODE */}

                        <div className="report-panel">


                            <div className="report-panel-header">

                                <h3>
                                    Collection by Payment Mode
                                </h3>

                                <p>
                                    Cash, UPI, card and bank payments
                                </p>

                            </div>


                            {report.modeCollection.length === 0 ? (

                                <div className="report-empty">
                                    No payment data available
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


                        {/* EXPENSE CATEGORY */}

                        <div className="report-panel">


                            <div className="report-panel-header">

                                <h3>
                                    Expenses by Category
                                </h3>

                                <p>
                                    School spending by category
                                </p>

                            </div>


                            {report.expenseCategories.length === 0 ? (

                                <div className="report-empty">
                                    No expense data available
                                </div>

                            ) : (

                                <div className="report-list">

                                    {report.expenseCategories.map(
                                        (item) => (

                                            <div
                                                className="report-list-row"
                                                key={item.category}
                                            >

                                                <div>

                                                    <strong>
                                                        {item.category}
                                                    </strong>

                                                    <small>
                                                        {item.count} expenses
                                                    </small>

                                                </div>

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

                    </div>


                    {/* =================================================
                        CLASS COLLECTION
                    ================================================= */}

                    <div className="report-panel">


                        <div className="report-panel-header">

                            <h3>
                                Class-wise Collection
                            </h3>

                            <p>
                                Fee collection by class
                            </p>

                        </div>


                        {report.classCollection.length === 0 ? (

                            <div className="report-empty">
                                No class data available
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
                                                    {item.payments} payments
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


                    {/* =================================================
                        RECENT PAYMENTS
                    ================================================= */}

                    <div className="report-panel recent-payments">


                        <div className="report-panel-header">

                            <h3>
                                Recent Payments
                            </h3>

                            <p>
                                Latest fee transactions
                            </p>

                        </div>


                        {report.recentPayments.length === 0 ? (

                            <div className="report-empty">
                                No payments available for this period.
                            </div>

                        ) : (

                            <div className="report-table-wrapper">

                                <table className="report-table">

                                    <thead>

                                        <tr>

                                            <th>Student</th>
                                            <th>Class</th>
                                            <th>Date</th>
                                            <th>Payment Mode</th>
                                            <th>Amount</th>

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


                    {/* =================================================
                        RECENT EXPENSES
                    ================================================= */}

                    <div className="report-panel recent-payments">


                        <div className="report-panel-header">

                            <h3>
                                Recent School Expenses
                            </h3>

                            <p>
                                Latest school expenses
                            </p>

                        </div>


                        {report.recentExpenses.length === 0 ? (

                            <div className="report-empty">
                                No expenses available for this period.
                            </div>

                        ) : (

                            <div className="report-table-wrapper">

                                <table className="report-table">

                                    <thead>

                                        <tr>

                                            <th>Expense</th>
                                            <th>Category</th>
                                            <th>Paid To</th>
                                            <th>Date</th>
                                            <th>Amount</th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {report.recentExpenses.map(
                                            (expense) => (

                                                <tr
                                                    key={expense.id}
                                                >

                                                    <td>
                                                        <strong>
                                                            {
                                                                expense.expenseName
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>

                                                        <span className="payment-badge">

                                                            {
                                                                expense.category ||
                                                                "Other"
                                                            }

                                                        </span>

                                                    </td>

                                                    <td>
                                                        {
                                                            expense.paidTo ||
                                                            "-"
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            expense.expenseDate
                                                        }
                                                    </td>

                                                    <td>

                                                        <strong>
                                                            {money(
                                                                expense.amount
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