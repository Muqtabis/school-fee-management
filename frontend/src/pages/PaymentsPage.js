import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import PaymentForm from "../components/PaymentForm";
import SummaryTable from "../components/SummaryTable";

import api from "../services/api";

function PaymentsPage() {

    const [payments, setPayments] = useState([]);

    const [showForm, setShowForm] = useState(false);

    const [selectedPayment, setSelectedPayment] = useState(null);

    useEffect(() => {

        fetchPayments();

    }, []);

    const fetchPayments = async () => {

        try {

            const res = await api.get("/payments");

            setPayments(res.data);

        }

        catch (err) {

            console.log(err);

        }

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

        const confirmDelete = window.confirm(
            "Delete this payment?"
        );

        if (!confirmDelete) return;

        try {

            await api.delete(`/payments/${id}`);

            fetchPayments();

        }

        catch (err) {

            console.log(err);

        }

    };

    return (

        <div className="dashboard">

            <Sidebar />

            <div className="main-content">

                <Navbar />

                <div className="page-content">

                    <div className="page-header">

                        <h2>Payments</h2>

                        <button
                            className="primary-btn"
                            onClick={addPayment}
                        >
                            + Collect Fee
                        </button>

                    </div>

                    <SummaryTable
                        payments={payments}
                        onEdit={editPayment}
                        onDelete={deletePayment}
                    />

                </div>

            </div>

            {

                showForm &&

                <PaymentForm

                    payment={selectedPayment}

                    onClose={() => {

                        setShowForm(false);

                        fetchPayments();

                    }}

                />

            }

        </div>

    );

}

export default PaymentsPage;