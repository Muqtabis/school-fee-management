import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

import api from "../services/api";


function NotificationsPage() {

    const [notifications, setNotifications] =
        useState([]);

    const [loading, setLoading] =
        useState(true);


    // ==========================================
    // FETCH NOTIFICATIONS
    // ==========================================

    const fetchNotifications = async () => {

        try {

            setLoading(true);

            const response =
                await api.get("/notifications");

            setNotifications(response.data);

        } catch (error) {

            console.error(
                "Notification Error:",
                error
            );

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        fetchNotifications();

    }, []);


    // ==========================================
    // RETRY NOTIFICATION
    // ==========================================

    const retryNotification = async (id) => {

        try {

            await api.post(
                `/notifications/${id}/retry`
            );

            fetchNotifications();

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Unable to retry notification."
            );

        }

    };


    // ==========================================
    // FORMAT DATE
    // ==========================================

    const formatDate = (date) => {

        if (!date) return "-";

        return new Date(date)
            .toLocaleString("en-IN");

    };


    // ==========================================
    // STATUS CLASS
    // ==========================================

    const getStatusClass = (status) => {

        switch (
            status?.toLowerCase()
        ) {

            case "sent":
                return "notification-status sent";

            case "failed":
                return "notification-status failed";

            case "pending":
                return "notification-status pending";

            default:
                return "notification-status";

        }

    };


    return (

        <div className="dashboard">

            <Sidebar />


            <div className="main-content">

                <Navbar />


                <div className="page-content">


                    {/* ========================= */}
                    {/* PAGE HEADER */}
                    {/* ========================= */}

                    <div className="page-header">

                        <div>

                            <h2>
                                Notifications
                            </h2>

                            <p>
                                Manage fee payment
                                notifications.
                            </p>

                        </div>


                        <button
                            className="primary-btn"
                            onClick={
                                fetchNotifications
                            }
                        >

                            Refresh

                        </button>

                    </div>


                    {/* ========================= */}
                    {/* SUMMARY */}
                    {/* ========================= */}

                    <div className="notification-summary">

                        <div className="notification-summary-card">

                            <span>
                                Total
                            </span>

                            <strong>
                                {notifications.length}
                            </strong>

                        </div>


                        <div className="notification-summary-card">

                            <span>
                                Pending
                            </span>

                            <strong>

                                {
                                    notifications.filter(
                                        notification =>
                                            notification.status ===
                                            "pending"
                                    ).length
                                }

                            </strong>

                        </div>


                        <div className="notification-summary-card">

                            <span>
                                Sent
                            </span>

                            <strong>

                                {
                                    notifications.filter(
                                        notification =>
                                            notification.status ===
                                            "sent"
                                    ).length
                                }

                            </strong>

                        </div>


                        <div className="notification-summary-card">

                            <span>
                                Failed
                            </span>

                            <strong>

                                {
                                    notifications.filter(
                                        notification =>
                                            notification.status ===
                                            "failed"
                                    ).length
                                }

                            </strong>

                        </div>

                    </div>


                    {/* ========================= */}
                    {/* TABLE */}
                    {/* ========================= */}

                    <div className="table-container">

                        {loading ? (

                            <div className="loading-message">

                                Loading notifications...

                            </div>

                        ) : (

                            <table>

                                <thead>

                                    <tr>

                                        <th>#</th>

                                        <th>
                                            Student
                                        </th>

                                        <th>
                                            Class
                                        </th>

                                        <th>
                                            Mobile
                                        </th>

                                        <th>
                                            Message
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Action
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {
                                        notifications.length ===
                                        0 ? (

                                            <tr>

                                                <td
                                                    colSpan="8"
                                                    className="empty-row"
                                                >

                                                    No notifications
                                                    found.

                                                </td>

                                            </tr>

                                        ) : (

                                            notifications.map(
                                                (
                                                    notification,
                                                    index
                                                ) => (

                                                    <tr
                                                        key={
                                                            notification.id
                                                        }
                                                    >

                                                        <td>
                                                            {index + 1}
                                                        </td>


                                                        <td>

                                                            <strong>

                                                                {
                                                                    notification.studentName ||
                                                                    "-"
                                                                }

                                                            </strong>

                                                            <small>

                                                                Roll:
                                                                {
                                                                    " "
                                                                }

                                                                {
                                                                    notification.rollNumber ||
                                                                    "-"
                                                                }

                                                            </small>

                                                        </td>


                                                        <td>

                                                            {
                                                                notification.className ||
                                                                "-"
                                                            }

                                                        </td>


                                                        <td>

                                                            {
                                                                notification.mobileNumber ||
                                                                "-"
                                                            }

                                                        </td>


                                                        <td>

                                                            <div className="notification-message">

                                                                {
                                                                    notification.message
                                                                }

                                                            </div>

                                                        </td>


                                                        <td>

                                                            <span
                                                                className={
                                                                    getStatusClass(
                                                                        notification.status
                                                                    )
                                                                }
                                                            >

                                                                {
                                                                    notification.status
                                                                }

                                                            </span>

                                                        </td>


                                                        <td>

                                                            {
                                                                formatDate(
                                                                    notification.createdAt
                                                                )
                                                            }

                                                        </td>


                                                        <td>

                                                            {
                                                                notification.status ===
                                                                "failed" ? (

                                                                    <button
                                                                        className="edit-btn"
                                                                        onClick={() =>
                                                                            retryNotification(
                                                                                notification.id
                                                                            )
                                                                        }
                                                                    >

                                                                        Retry

                                                                    </button>

                                                                ) : (

                                                                    <span>
                                                                        -
                                                                    </span>

                                                                )
                                                            }

                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        )
                                    }

                                </tbody>

                            </table>

                        )}

                    </div>

                </div>

            </div>

        </div>

    );

}


export default NotificationsPage;