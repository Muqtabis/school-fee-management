import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PaymentForm from "../components/PaymentForm";
import SummaryTable from "../components/SummaryTable";

import api from "../services/api";


function PaymentsPage() {

    const [payments, setPayments] =
        useState([]);

    const [showForm, setShowForm] =
        useState(false);

    const [selectedPayment, setSelectedPayment] =
        useState(null);


    const [filters, setFilters] =
        useState({

            search: "",

            className: "All",

            paymentMode: "All",

            dateFrom: "",

            dateTo: ""

        });


    const classes = [

        "LKG",
        "UKG",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"

    ];


    useEffect(() => {

        fetchPayments();

    }, []);


    const fetchPayments = async (
        customFilters = filters
    ) => {

        try {

            const params = {};


            if (customFilters.search) {

                params.search =
                    customFilters.search;

            }


            if (
                customFilters.className !==
                "All"
            ) {

                params.className =
                    customFilters.className;

            }


            if (
                customFilters.paymentMode !==
                "All"
            ) {

                params.paymentMode =
                    customFilters.paymentMode;

            }


            if (customFilters.dateFrom) {

                params.dateFrom =
                    customFilters.dateFrom;

            }


            if (customFilters.dateTo) {

                params.dateTo =
                    customFilters.dateTo;

            }


            const res =
                await api.get(
                    "/payments",
                    { params }
                );


            setPayments(res.data);

        } catch (error) {

            console.error(error);

        }

    };


    const handleFilterChange = (e) => {

        const newFilters = {

            ...filters,

            [e.target.name]:
                e.target.value

        };


        setFilters(newFilters);

        fetchPayments(newFilters);

    };


    const clearFilters = () => {

        const cleared = {

            search: "",

            className: "All",

            paymentMode: "All",

            dateFrom: "",

            dateTo: ""

        };


        setFilters(cleared);

        fetchPayments(cleared);

    };


    const addPayment = () => {

        setSelectedPayment(null);

        setShowForm(true);

    };


    const editPayment = (payment) => {

        setSelectedPayment(payment);

        setShowForm(true);

    };


    const deletePayment = async (id) => {

        const confirmDelete =
            window.confirm(
                "Delete this payment?"
            );


        if (!confirmDelete) return;


        try {

            await api.delete(
                `/payments/${id}`
            );

            fetchPayments();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to delete payment."
            );

        }

    };


    return (

        <div className="dashboard">

            <Sidebar />


            <div className="main-content">

                <Navbar />


                <div className="page-content">

                    <div className="page-header">

                        <div>

                            <h2>
                                Payments
                            </h2>

                            <p>
                                Manage and track
                                school fee collections.
                            </p>

                        </div>


                        <button
                            className="primary-btn"
                            onClick={addPayment}
                        >

                            + Collect Fee

                        </button>

                    </div>


                    <div className="payment-filters">

                        <input
                            type="text"
                            name="search"
                            value={
                                filters.search
                            }
                            onChange={
                                handleFilterChange
                            }
                            placeholder="Search student, roll number or class..."
                            className="search-input"
                        />


                        <select
                            name="className"
                            value={
                                filters.className
                            }
                            onChange={
                                handleFilterChange
                            }
                            className="filter-select"
                        >

                            <option value="All">
                                All Classes
                            </option>


                            {classes.map(
                                (className) => (

                                    <option
                                        key={
                                            className
                                        }
                                        value={
                                            className
                                        }
                                    >

                                        {
                                            className ===
                                            "LKG" ||
                                            className ===
                                            "UKG"
                                                ? className
                                                : `${className} Standard`
                                        }

                                    </option>

                                )
                            )}

                        </select>


                        <select
                            name="paymentMode"
                            value={
                                filters.paymentMode
                            }
                            onChange={
                                handleFilterChange
                            }
                            className="filter-select"
                        >

                            <option value="All">
                                All Modes
                            </option>

                            <option value="Cash">
                                Cash
                            </option>

                            <option value="UPI">
                                UPI
                            </option>

                            <option value="Card">
                                Card
                            </option>

                            <option value="Bank Transfer">
                                Bank Transfer
                            </option>

                        </select>


                        <input
                            type="date"
                            name="dateFrom"
                            value={
                                filters.dateFrom
                            }
                            onChange={
                                handleFilterChange
                            }
                            className="filter-date"
                        />


                        <input
                            type="date"
                            name="dateTo"
                            value={
                                filters.dateTo
                            }
                            onChange={
                                handleFilterChange
                            }
                            className="filter-date"
                        />


                        <button
                            className="clear-btn"
                            onClick={
                                clearFilters
                            }
                        >

                            Clear

                        </button>

                    </div>


                    <SummaryTable
                        payments={payments}
                        onEdit={editPayment}
                        onDelete={deletePayment}
                    />

                </div>

            </div>


            {showForm && (

                <PaymentForm

                    payment={
                        selectedPayment
                    }

                    onClose={() => {

                        setShowForm(false);

                        fetchPayments();

                    }}

                />

            )}

        </div>

    );

}


export default PaymentsPage;