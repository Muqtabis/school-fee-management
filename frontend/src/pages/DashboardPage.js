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

        totalExpenses: 0,

        totalExpenseAmount: 0,

        netBalance: 0

    });


    const [recentPayments, setRecentPayments] =
        useState([]);


    const [recentExpenses, setRecentExpenses] =
        useState([]);


    useEffect(() => {

        fetchDashboard();

    }, []);


    const fetchDashboard = async () => {

        try {


            // PAYMENT SUMMARY

            const paymentSummary =
                await api.get("/payments/summary");


            // EXPENSE SUMMARY

            const expenseSummary =
                await api.get("/expenses/summary");


            const totalCollection =
                Number(paymentSummary.data.totalCollection) || 0;


            const totalExpenseAmount =
                Number(expenseSummary.data.totalExpenseAmount) || 0;


            setSummary({

                totalStudents:
                    Number(paymentSummary.data.totalStudents) || 0,

                totalPayments:
                    Number(paymentSummary.data.totalPayments) || 0,

                totalCollection:
                    totalCollection,

                pendingFees:
                    Number(paymentSummary.data.pendingFees) || 0,

                totalExpenses:
                    Number(expenseSummary.data.totalExpenses) || 0,

                totalExpenseAmount:
                    totalExpenseAmount,

                netBalance:
                    totalCollection - totalExpenseAmount

            });


            // RECENT PAYMENTS

            const paymentRes =
                await api.get("/payments");


            setRecentPayments(
                paymentRes.data.slice(0, 5)
            );


            // RECENT EXPENSES

            const expenseRes =
                await api.get("/expenses");


            setRecentExpenses(
                expenseRes.data.slice(0, 5)
            );


        }

        catch (error) {

            console.error(
                "Dashboard Error:",
                error
            );

        }

    };


    return (

        <div className="dashboard">


            <Sidebar />


            <div className="main-content">


                <Navbar />


                <div className="page-content">


                    {/* ================================================= */}
                    {/* FINANCIAL CARDS */}
                    {/* ================================================= */}


                    <div className="cards">


                        <DashboardCard

                            title="Students"

                            value={
                                summary.totalStudents
                            }

                            icon="👨‍🎓"

                            color="#2563EB"

                        />


                        <DashboardCard

                            title="Fee Collection"

                            value={
                                `₹ ${summary.totalCollection.toLocaleString("en-IN")}`
                            }

                            icon="💰"

                            color="#22C55E"

                        />


                        <DashboardCard

                            title="School Expenses"

                            value={
                                `₹ ${summary.totalExpenseAmount.toLocaleString("en-IN")}`
                            }

                            icon="💸"

                            color="#EF4444"

                        />


                        <DashboardCard

                            title="Net Balance"

                            value={
                                `₹ ${summary.netBalance.toLocaleString("en-IN")}`
                            }

                            icon="💵"

                            color="#F59E0B"

                        />


                    </div>


                    {/* ================================================= */}
                    {/* PENDING FEES */}
                    {/* ================================================= */}


                    <div className="cards">


                        <DashboardCard

                            title="Pending Student Fees"

                            value={
                                `₹ ${summary.pendingFees.toLocaleString("en-IN")}`
                            }

                            icon="⚠️"

                            color="#DC2626"

                        />


                        <DashboardCard

                            title="Total Payments"

                            value={
                                summary.totalPayments
                            }

                            icon="🧾"

                            color="#7C3AED"

                        />


                        <DashboardCard

                            title="Expense Transactions"

                            value={
                                summary.totalExpenses
                            }

                            icon="📋"

                            color="#EA580C"

                        />


                    </div>


                    {/* ================================================= */}
                    {/* RECENT PAYMENTS */}
                    {/* ================================================= */}


                    <div className="dashboard-grid">


                        <div className="dashboard-table">


                            <h3>
                                Recent Payments
                            </h3>


                            <table>


                                <thead>

                                    <tr>

                                        <th>
                                            Student
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Mode
                                        </th>

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

                                        recentPayments.map(
                                            (payment) => (

                                                <tr
                                                    key={payment.id}
                                                >

                                                    <td>
                                                        {payment.studentName}
                                                    </td>

                                                    <td>
                                                        ₹ {payment.amount}
                                                    </td>

                                                    <td>
                                                        {payment.paymentDate}
                                                    </td>

                                                    <td>
                                                        {payment.paymentMode}
                                                    </td>

                                                </tr>

                                            )
                                        )

                                    )}


                                </tbody>


                            </table>


                        </div>


                    </div>


                    {/* ================================================= */}
                    {/* RECENT EXPENSES */}
                    {/* ================================================= */}


                    <div className="dashboard-grid">


                        <div className="dashboard-table">


                            <h3>
                                Recent School Expenses
                            </h3>


                            <table>


                                <thead>

                                    <tr>

                                        <th>
                                            Expense
                                        </th>

                                        <th>
                                            Category
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Date
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>


                                    {recentExpenses.length === 0 ? (

                                        <tr>

                                            <td colSpan="4">

                                                No Expenses Found

                                            </td>

                                        </tr>

                                    ) : (

                                        recentExpenses.map(
                                            (expense) => (

                                                <tr
                                                    key={expense.id}
                                                >

                                                    <td>
                                                        {expense.expenseName}
                                                    </td>

                                                    <td>
                                                        {expense.category}
                                                    </td>

                                                    <td>
                                                        ₹ {Number(
                                                            expense.amount
                                                        ).toLocaleString("en-IN")}
                                                    </td>

                                                    <td>
                                                        {expense.expenseDate}
                                                    </td>

                                                </tr>

                                            )
                                        )

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