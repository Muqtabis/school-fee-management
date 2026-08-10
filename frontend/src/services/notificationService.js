const db = require("../db");


// =====================================================
// CREATE NOTIFICATION RECORD
// =====================================================

const createNotification = ({
    studentId,
    paymentId,
    phoneNumber,
    message
}) => {

    return new Promise((resolve, reject) => {

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

                    return reject(err);

                }

                resolve({
                    id: this.lastID
                });

            }
        );

    });

};


// =====================================================
// CREATE PAYMENT SMS
// =====================================================

const createPaymentNotification = async ({
    studentId,
    paymentId,
    studentName,
    amount,
    paymentDate,
    phoneNumber
}) => {

    if (!phoneNumber) {

        console.log(
            `No mobile number found for ${studentName}`
        );

        return null;

    }


    const message =
        `Dear Parent, a fee payment of Rs.${amount} has been received for ${studentName} on ${paymentDate}. Thank you - The Age School.`;


    try {

        const notification =
            await createNotification({

                studentId,

                paymentId,

                phoneNumber,

                message

            });


        console.log(
            `Notification created for ${studentName}`
        );


        return notification;

    }

    catch (error) {

        console.error(
            "Notification creation failed:",
            error.message
        );

        return null;

    }

};


module.exports = {

    createNotification,

    createPaymentNotification

};