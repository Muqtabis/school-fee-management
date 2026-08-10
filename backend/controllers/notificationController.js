const db = require("../db");

/*
====================================================
GET ALL NOTIFICATIONS
====================================================
*/

exports.getNotifications = (req, res) => {

    db.all(
        `
        SELECT
            notifications.*,

            students.studentName,
            students.rollNumber,
            students.className

        FROM notifications

        LEFT JOIN students
        ON notifications.studentId = students.id

        ORDER BY notifications.createdAt DESC
        `,
        [],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json(rows);

        }
    );

};


/*
====================================================
GET SINGLE NOTIFICATION
====================================================
*/

exports.getNotification = (req, res) => {

    db.get(
        `
        SELECT
            notifications.*,

            students.studentName,
            students.rollNumber,
            students.className

        FROM notifications

        LEFT JOIN students
        ON notifications.studentId = students.id

        WHERE notifications.id = ?
        `,
        [req.params.id],
        (err, row) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            if (!row) {

                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });

            }

            res.json(row);

        }
    );

};


/*
====================================================
CREATE NOTIFICATION
====================================================
*/

exports.createNotification = (req, res) => {

    const {
        studentId,
        paymentId,
        phoneNumber,
        message
    } = req.body;


    if (!studentId || !paymentId || !phoneNumber || !message) {

        return res.status(400).json({
            success: false,
            message:
                "Student, payment, phone number and message are required."
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
            phoneNumber,
            message,
            "SMS",
            "pending",
            "MSG91"
        ],
        function (err) {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            res.status(201).json({

                success: true,

                id: this.lastID,

                message:
                    "Notification created successfully."

            });

        }
    );

};


/*
====================================================
UPDATE NOTIFICATION STATUS
====================================================
*/

exports.updateNotificationStatus = (req, res) => {

    const {
        status,
        sentAt
    } = req.body;


    if (!status) {

        return res.status(400).json({
            success: false,
            message: "Notification status is required."
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
        function (err) {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
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