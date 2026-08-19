const db =
    require("../db");


// =====================================================
// GET ALL NOTIFICATIONS
// =====================================================

exports.getNotifications = (
    req,
    res
) => {

    db.all(
        `
        SELECT

            notifications.*,

            students.studentName,
            students.rollNumber,
            students.className

        FROM notifications

        LEFT JOIN students
            ON notifications.studentId =
               students.id

        ORDER BY
            notifications.createdAt DESC
        `,
        [],
        (
            err,
            rows
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load notifications."

                });

            }


            res.json(rows);

        }
    );

};


// =====================================================
// GET SINGLE
// =====================================================

exports.getNotification = (
    req,
    res
) => {

    db.get(
        `
        SELECT

            notifications.*,

            students.studentName,
            students.rollNumber,
            students.className

        FROM notifications

        LEFT JOIN students
            ON notifications.studentId =
               students.id

        WHERE notifications.id = ?
        `,
        [
            req.params.id
        ],
        (
            err,
            row
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load notification."

                });

            }


            if (!row) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Notification not found."

                });

            }


            res.json(row);

        }
    );

};


// =====================================================
// CREATE NOTIFICATION
// =====================================================

exports.createNotification = (
    req,
    res
) => {

    const {
        studentId,
        paymentId,
        phoneNumber,
        message
    } = req.body;


    if (
        !studentId ||
        !paymentId ||
        !phoneNumber ||
        !message
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Student, payment, phone number and message are required."

        });

    }


    db.get(
        `
        SELECT id
        FROM students
        WHERE id = ?
        `,
        [
            studentId
        ],
        (
            studentErr,
            student
        ) => {

            if (studentErr) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to verify student."

                });

            }


            if (!student) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student not found."

                });

            }


            db.get(
                `
                SELECT id
                FROM payments
                WHERE id = ?
                `,
                [
                    paymentId
                ],
                (
                    paymentErr,
                    payment
                ) => {

                    if (paymentErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to verify payment."

                        });

                    }


                    if (!payment) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "Payment not found."

                        });

                    }


                    db.run(
                        `
                        INSERT INTO notifications
                        (
                            studentId,
                            paymentId,
                            phoneNumber,
                            message,
                            notificationType,
                            status,
                            provider
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                            studentId,
                            paymentId,
                            String(
                                phoneNumber
                            ).trim(),
                            String(
                                message
                            ).trim(),
                            "SMS",
                            "pending",
                            "MSG91"
                        ],
                        function (
                            err
                        ) {

                            if (err) {

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Unable to create notification."

                                });

                            }


                            res.status(201).json({

                                success: true,

                                id:
                                    this.lastID,

                                message:
                                    "Notification created successfully."

                            });

                        }
                    );

                }
            );

        }
    );

};


// =====================================================
// UPDATE STATUS
// =====================================================

exports.updateNotificationStatus = (
    req,
    res
) => {

    const {
        status,
        sentAt
    } = req.body;


    const allowedStatuses = [
        "pending",
        "sent",
        "failed"
    ];


    if (
        !allowedStatuses.includes(
            status
        )
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid notification status."

        });

    }


    db.run(
        `
        UPDATE notifications

        SET
            status = ?,
            sentAt = ?

        WHERE id = ?
        `,
        [
            status,
            sentAt || null,
            req.params.id
        ],
        function (
            err
        ) {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to update notification."

                });

            }


            if (
                this.changes ===
                0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Notification not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Notification status updated successfully."

            });

        }
    );

};


// =====================================================
// RETRY
//
// This only puts the notification back into pending.
// It does not pretend that an SMS was actually sent.
// =====================================================

exports.retryNotification = (
    req,
    res
) => {

    db.get(
        `
        SELECT *
        FROM notifications
        WHERE id = ?
        `,
        [
            req.params.id
        ],
        (
            err,
            notification
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load notification."

                });

            }


            if (!notification) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Notification not found."

                });

            }


            if (
                notification.status !==
                    "failed" &&
                notification.status !==
                    "pending"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Only failed or pending notifications can be retried."

                });

            }


            db.run(
                `
                UPDATE notifications

                SET
                    status = 'pending',
                    sentAt = NULL

                WHERE id = ?
                `,
                [
                    req.params.id
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to retry notification."

                        });

                    }


                    res.json({

                        success: true,

                        message:
                            "Notification queued for retry.",

                        provider:
                            notification.provider

                    });

                }
            );

        }
    );

};