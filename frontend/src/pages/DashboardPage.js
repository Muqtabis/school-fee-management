import {
    useEffect,
    useState
} from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";

import api from "../services/api";


function DashboardPage() {

    const [
        summary,
        setSummary
    ] = useState({

        academicYear:
            "",

        totalStudents:
            0,

        totalPayments:
            0,

        totalFee:
            0,

        totalCollection:
            0,

        pendingFees:
            0,

        totalExpenses:
            0,

        totalExpenseAmount:
            0,

        netBalance:
            0

    });


    const [
        recentPayments,
        setRecentPayments
    ] = useState([]);


    const [
        recentExpenses,
        setRecentExpenses
    ] = useState([]);


    useEffect(
        () => {

            fetchDashboard();

        },
        []
    );


    const fetchDashboard =
        async () => {

            try {

                const [
                    paymentSummary,
                    expenseSummary,
                    payments,
                    expenses
                ] = await Promise.all([

                    api.get(
                        "/payments/summary"
                    ),

                    api.get(
                        "/expenses/summary"
                    ),

                    api.get(
                        "/payments"
                    ),

                    api.get(
                        "/expenses"
                    )

                ]);


                const totalCollection =
                    Number(
                        paymentSummary.data.totalCollection
                    ) || 0;


                const totalExpenseAmount =
                    Number(
                        expenseSummary.data.totalExpenseAmount
                    ) || 0;


                setSummary({

                    academicYear:
                        paymentSummary.data.academicYear?.name ||
                        "",

                    totalStudents:
                        Number(
                            paymentSummary.data.totalStudents ||
                            0
                        ),

                    totalPayments:
                        Number(
                            paymentSummary.data.totalPayments ||
                            0
                        ),

                    totalFee:
                        Number(
                            paymentSummary.data.totalFee ||
                            0
                        ),

                    totalCollection,

                    pendingFees:
                        Number(
                            paymentSummary.data.pendingFees ||
                            0
                        ),

                    totalExpenses:
                        Number(
                            expenseSummary.data.totalExpenses ||
                            0
                        ),

                    totalExpenseAmount,

                    netBalance:
                        totalCollection -
                        totalExpenseAmount

                });


                setRecentPayments(
                    Array.isArray(
                        payments.data
                    )
                        ? payments.data
                            .filter(
                                payment =>
                                    payment.status !==
                                    "reversed"
                            )
                            .slice(
                                0,
                                5
                            )
                        : []
                );


                setRecentExpenses(
                    Array.isArray(
                        expenses.data
                    )
                        ? expenses.data
                            .filter(
                                expense =>
                                    expense.status !==
                                    "reversed"
                            )
                            .slice(
                                0,
                                5
                            )
                        : []
                );

            } catch (error) {

                console.error(
                    "Dashboard Error:",
                    error
                );

            }

        };


    const money =
        value =>
            `₹ ${Number(
                value || 0
            ).toLocaleString(
                "en-IN"
            )}`;


    return (

        <div
            className="dashboard"
        >

            <Sidebar />


            <div
                className="main-content"
            >

                <Navbar />


                <div
                    className="page-content"
                >

                    <div
                        className="page-header"
                    >

                        <div>

                            <h2>
                                Dashboard
                            </h2>

                            <p>

                                Active Academic Year:
                                {" "}

                                <strong>
                                    {
                                        summary.academicYear ||
                                        "-"
                                    }
                                </strong>

                            </p>

                        </div>

                    </div>


                    <div
                        className="cards"
                    >

                        <DashboardCard
                            title="Students"
                            value={
                                summary.totalStudents
                            }
                            icon="👨‍🎓"
                            color="#2563EB"
                        />


                        <DashboardCard
                            title="Total Fees"
                            value={
                                money(
                                    summary.totalFee
                                )
                            }
                            icon="📚"
                            color="#7C3AED"
                        />


                        <DashboardCard
                            title="Fee Collection"
                            value={
                                money(
                                    summary.totalCollection
                                )
                            }
                            icon="💰"
                            color="#22C55E"
                        />


                        <DashboardCard
                            title="Pending Fees"
                            value={
                                money(
                                    summary.pendingFees
                                )
                            }
                            icon="⚠️"
                            color="#DC2626"
                        />

                    </div>


                    <div
                        className="cards"
                    >

                        <DashboardCard
                            title="School Expenses"
                            value={
                                money(
                                    summary.totalExpenseAmount
                                )
                            }
                            icon="💸"
                            color="#EF4444"
                        />


                        <DashboardCard
                            title="Net Balance"
                            value={
                                money(
                                    summary.netBalance
                                )
                            }
                            icon="💵"
                            color="#F59E0B"
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


                    {/* RECENT PAYMENTS */}

                    <div
                        className="dashboard-grid"
                    >

                        <div
                            className="dashboard-table"
                        >

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

                                    {
                                        recentPayments.length ===
                                        0 ? (

                                            <tr>

                                                <td
                                                    colSpan="4"
                                                >
                                                    No Payments Found
                                                </td>

                                            </tr>

                                        ) : (

                                            recentPayments.map(
                                                payment => (

                                                    <tr
                                                        key={
                                                            payment.id
                                                        }
                                                    >

                                                        <td>
                                                            {
                                                                payment.studentName
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                money(
                                                                    payment.amount
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                payment.paymentDate
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                payment.paymentMode
                                                            }
                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        )
                                    }

                                </tbody>

                            </table>

                        </div>

                    </div>


                    {/* RECENT EXPENSES */}

                    <div
                        className="dashboard-grid"
                    >

                        <div
                            className="dashboard-table"
                        >

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

                                    {
                                        recentExpenses.length ===
                                        0 ? (

                                            <tr>

                                                <td
                                                    colSpan="4"
                                                >
                                                    No Expenses Found
                                                </td>

                                            </tr>

                                        ) : (

                                            recentExpenses.map(
                                                expense => (

                                                    <tr
                                                        key={
                                                            expense.id
                                                        }
                                                    >

                                                        <td>
                                                            {
                                                                expense.expenseName
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                expense.category
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                money(
                                                                    expense.amount
                                                                )
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                expense.expenseDate
                                                            }
                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        )
                                    }

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