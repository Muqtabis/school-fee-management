const db = require("../db");


/*
====================================================
GET PAYMENTS

Supports:

search
studentId
className
paymentMode
dateFrom
dateTo
====================================================
*/

exports.getPayments = (req, res) => {

    const {
        search,
        studentId,
        className,
        paymentMode,
        dateFrom,
        dateTo
    } = req.query;


    let sql = `
        SELECT
            payments.*,
            students.studentName,
            students.rollNumber,
            students.className,
            students.fatherName
        FROM payments

        LEFT JOIN students
        ON payments.studentId = students.id

        WHERE 1=1
    `;


    const params = [];


    if (search) {

        sql += `
            AND (
                LOWER(students.studentName) LIKE LOWER(?)
                OR LOWER(students.rollNumber) LIKE LOWER(?)
                OR LOWER(students.className) LIKE LOWER(?)
            )
        `;

        const value = `%${search}%`;

        params.push(
            value,
            value,
            value
        );

    }


    if (studentId) {

        sql += `
            AND payments.studentId = ?
        `;

        params.push(studentId);

    }


    if (
        className &&
        className !== "All"
    ) {

        sql += `
            AND students.className = ?
        `;

        params.push(className);

    }


    if (paymentMode && paymentMode !== "All") {

        sql += `
            AND payments.paymentMode = ?
        `;

        params.push(paymentMode);

    }


    if (dateFrom) {

        sql += `
            AND payments.paymentDate >= ?
        `;

        params.push(dateFrom);

    }


    if (dateTo) {

        sql += `
            AND payments.paymentDate <= ?
        `;

        params.push(dateTo);

    }


    sql += `
        ORDER BY payments.paymentDate DESC,
        payments.id DESC
    `;


    db.all(
        sql,
        params,
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
GET SINGLE PAYMENT
====================================================
*/

exports.getPayment = (req, res) => {

    db.get(
        `
        SELECT
            payments.*,
            students.studentName,
            students.rollNumber,
            students.className,
            students.fatherName,
            students.contact1

        FROM payments

        LEFT JOIN students
        ON payments.studentId = students.id

        WHERE payments.id = ?
        `,
        [req.params.id],
        (err, payment) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            if (!payment) {

                return res.status(404).json({
                    success: false,
                    message: "Payment not found."
                });

            }


            res.json(payment);

        }
    );

};


/*
====================================================
ADD PAYMENT
====================================================
*/

exports.addPayment = (req, res) => {

    const {
        studentId,
        paymentDate,
        amount,
        paymentMode,
        remarks
    } = req.body;


    /*
    ================================================
    VALIDATION
    ================================================
    */

    if (
        !studentId ||
        !paymentDate ||
        !amount ||
        !paymentMode
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Student, date, amount and payment mode are required."
        });

    }


    const paymentAmount = Number(amount);


    if (paymentAmount <= 0) {

        return res.status(400).json({
            success: false,
            message:
                "Payment amount must be greater than zero."
        });

    }


    /*
    ================================================
    GET STUDENT
    ================================================
    */

    db.get(
        `
        SELECT
            id,
            studentName,
            rollNumber,
            className,
            fatherName,
            contact1,
            previousDues,
            tuitionFee

        FROM students

        WHERE id = ?
        `,
        [studentId],
        (studentErr, student) => {

            if (studentErr) {

                return res.status(500).json({
                    success: false,
                    message: studentErr.message
                });

            }


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Student not found."
                });

            }


            /*
            ========================================
            INSERT PAYMENT
            ========================================
            */

            db.run(
                `
                INSERT INTO payments
                (
                    studentId,
                    paymentDate,
                    amount,
                    paymentMode,
                    remarks
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    studentId,
                    paymentDate,
                    paymentAmount,
                    paymentMode,
                    remarks || ""
                ],
                function (paymentErr) {

                    if (paymentErr) {

                        return res.status(500).json({
                            success: false,
                            message: paymentErr.message
                        });

                    }


                    const paymentId = this.lastID;


                    /*
                    ====================================
                    GET TOTAL PAID INCLUDING NEW PAYMENT
                    ====================================
                    */

                    db.get(
                        `
                        SELECT
                            IFNULL(SUM(amount), 0)
                            AS totalPaid

                        FROM payments

                        WHERE studentId = ?
                        `,
                        [studentId],
                        (totalErr, paymentSummary) => {

                            if (totalErr) {

                                return res.status(500).json({
                                    success: false,
                                    message: totalErr.message
                                });

                            }


                            /*
                            ==================================
                            CALCULATE FEES
                            ==================================
                            */

                            const totalFee =
                                Number(student.previousDues || 0) +
                                Number(student.tuitionFee || 0);


                            const totalPaid =
                                Number(
                                    paymentSummary.totalPaid || 0
                                );


                            const balance =
                                Math.max(
                                    0,
                                    totalFee - totalPaid
                                );


                            /*
                            ==================================
                            CREATE SMS MESSAGE
                            ==================================
                            */

                            const message =

                                `Dear Parent, ` +
                                `₹${paymentAmount.toFixed(2)} fee has been received ` +
                                `for ${student.studentName}. ` +
                                `Payment Mode: ${paymentMode}. ` +
                                `Total Fee: ₹${totalFee.toFixed(2)}. ` +
                                `Total Paid: ₹${totalPaid.toFixed(2)}. ` +
                                `Remaining Fee: ₹${balance.toFixed(2)}. ` +
                                `Thank you, THE AGE SCHOOL.`;


                            /*
                            ==================================
                            CREATE NOTIFICATION
                            ==================================
                            */

                            if (student.contact1) {

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
                                        student.id,
                                        paymentId,
                                        student.contact1,
                                        message,
                                        "SMS",
                                        "pending",
                                        "MSG91"
                                    ],
                                    function (notificationErr) {

                                        if (notificationErr) {

                                            console.error(
                                                "Notification creation failed:",
                                                notificationErr.message
                                            );

                                        }

                                    }
                                );

                            }


                            /*
                            ==================================
                            RESPONSE
                            ==================================
                            */

                            res.status(201).json({

                                success: true,

                                id: paymentId,

                                message:
                                    "Payment added successfully.",

                                notification:
                                    student.contact1
                                        ? {
                                            status: "pending",
                                            phoneNumber:
                                                student.contact1
                                        }
                                        : {
                                            status: "not_created",
                                            message:
                                                "Student has no mobile number."
                                        },

                                feeSummary: {

                                    totalFee,

                                    totalPaid,

                                    balance

                                }

                            });

                        }
                    );

                }
            );

        }
    );

};


/*
====================================================
UPDATE PAYMENT
====================================================
*/

exports.updatePayment = (req, res) => {

    const {
        studentId,
        paymentDate,
        amount,
        paymentMode,
        remarks
    } = req.body;


    db.run(
        `
        UPDATE payments

        SET
            studentId = ?,
            paymentDate = ?,
            amount = ?,
            paymentMode = ?,
            remarks = ?

        WHERE id = ?
        `,
        [
            studentId,
            paymentDate,
            Number(amount),
            paymentMode,
            remarks || "",
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
                    "Payment updated successfully."

            });

        }
    );

};


/*
====================================================
DELETE PAYMENT
====================================================
*/

exports.deletePayment = (req, res) => {

    db.run(
        `
        DELETE FROM payments
        WHERE id = ?
        `,
        [req.params.id],
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
                    "Payment deleted successfully."

            });

        }
    );

};


/*
====================================================
DASHBOARD SUMMARY
====================================================
*/

exports.dashboardSummary = (req, res) => {

    db.get(
        `
        SELECT
            COUNT(*) AS totalPayments,
            IFNULL(SUM(amount), 0) AS totalCollection
        FROM payments
        `,
        [],
        (paymentErr, paymentData) => {

            if (paymentErr) {

                return res.status(500).json({
                    success: false,
                    message: paymentErr.message
                });

            }


            db.get(
                `
                SELECT
                    COUNT(*) AS totalStudents
                FROM students
                `,
                [],
                (studentErr, studentData) => {

                    if (studentErr) {

                        return res.status(500).json({
                            success: false,
                            message: studentErr.message
                        });

                    }


                    db.get(
                        `
                        SELECT
                            IFNULL(
                                SUM(
                                    previousDues +
                                    tuitionFee
                                ),
                                0
                            )
                            -
                            IFNULL(
                                (
                                    SELECT SUM(amount)
                                    FROM payments
                                ),
                                0
                            )
                            AS pendingFees

                        FROM students
                        `,
                        [],
                        (pendingErr, pendingData) => {

                            if (pendingErr) {

                                return res.status(500).json({
                                    success: false,
                                    message: pendingErr.message
                                });

                            }


                            res.json({

                                totalStudents:
                                    studentData.totalStudents,

                                totalPayments:
                                    paymentData.totalPayments || 0,

                                totalCollection:
                                    paymentData.totalCollection || 0,

                                pendingFees:
                                    Math.max(
                                        0,
                                        pendingData.pendingFees || 0
                                    )

                            });

                        }
                    );

                }
            );

        }
    );

};


/*
====================================================
MONTHLY COLLECTION

Returns last 12 months.
====================================================
*/

exports.monthlyCollection = (req, res) => {

    db.all(
        `
        SELECT
            strftime('%Y-%m', paymentDate) AS month,
            IFNULL(SUM(amount), 0) AS collection

        FROM payments

        WHERE paymentDate >=
            date('now', '-11 months', 'start of month')

        GROUP BY strftime('%Y-%m', paymentDate)

        ORDER BY month ASC
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
STUDENT FEE HISTORY
====================================================
*/

exports.studentFeeHistory = (req, res) => {

    const studentId = req.params.studentId;


    db.get(
        `
        SELECT
            id,
            studentName,
            rollNumber,
            className,
            fatherName,
            previousDues,
            tuitionFee

        FROM students

        WHERE id = ?
        `,
        [studentId],
        (studentErr, student) => {

            if (studentErr) {

                return res.status(500).json({
                    success: false,
                    message: studentErr.message
                });

            }


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message: "Student not found."
                });

            }


            db.all(
                `
                SELECT *
                FROM payments

                WHERE studentId = ?

                ORDER BY paymentDate DESC,
                id DESC
                `,
                [studentId],
                (paymentErr, payments) => {

                    if (paymentErr) {

                        return res.status(500).json({
                            success: false,
                            message: paymentErr.message
                        });

                    }


                    const totalPaid =
                        payments.reduce(
                            (total, payment) =>
                                total +
                                Number(payment.amount || 0),
                            0
                        );


                    const totalFee =
                        Number(student.previousDues || 0) +
                        Number(student.tuitionFee || 0);


                    const balance =
                        Math.max(
                            0,
                            totalFee - totalPaid
                        );


                    res.json({

                        student,

                        payments,

                        totalFee,

                        totalPaid,

                        balance

                    });

                }
            );

        }
    );

};


/*
====================================================
RECEIPT DATA
====================================================
*/

exports.getReceipt = (req, res) => {

    db.get(
        `
        SELECT
            payments.*,

            students.studentName,
            students.rollNumber,
            students.className,
            students.fatherName,
            students.contact1,
            students.tuitionFee,
            students.previousDues

        FROM payments

        LEFT JOIN students
        ON payments.studentId = students.id

        WHERE payments.id = ?
        `,
        [req.params.id],
        (err, receipt) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            if (!receipt) {

                return res.status(404).json({
                    success: false,
                    message: "Receipt not found."
                });

            }


            res.json(receipt);

        }
    );

};
// =========================================================
// DETAILED REPORT
// Weekly / Monthly / All Time
// =========================================================

exports.detailedReport = (req, res) => {

    const db = require("../db");

    const period = req.query.period || "monthly";

    let dateCondition = "";
    let dateParams = [];

    // -----------------------------------------------------
    // DATE FILTER
    // -----------------------------------------------------

    if (period === "weekly") {

        dateCondition = `
            AND date(paymentDate) >= date('now', '-6 days')
            AND date(paymentDate) <= date('now')
        `;

    } else if (period === "monthly") {

        dateCondition = `
            AND strftime('%Y-%m', paymentDate)
            = strftime('%Y-%m', 'now')
        `;

    } else {

        dateCondition = "";

    }

    // -----------------------------------------------------
    // MAIN REPORT
    // -----------------------------------------------------

    const reportQuery = `
        SELECT

            COUNT(*) AS totalPayments,

            COALESCE(SUM(amount), 0) AS totalCollection,

            COALESCE(AVG(amount), 0) AS averagePayment,

            COALESCE(MAX(amount), 0) AS highestPayment

        FROM payments

        WHERE 1 = 1

        ${dateCondition}
    `;

    db.get(
        reportQuery,
        dateParams,
        (err, report) => {

            if (err) {

                console.error("Report error:", err);

                return res.status(500).json({
                    message: "Failed to generate report"
                });

            }

            // -------------------------------------------------
            // TOTAL STUDENTS + PENDING FEES
            // -------------------------------------------------

            const studentQuery = `
                SELECT

                    COUNT(*) AS totalStudents,

                    COALESCE(
                        SUM(
                            COALESCE(previousDues, 0)
                            +
                            COALESCE(tuitionFee, 0)
                        ),
                        0
                    ) AS totalFee

                FROM students
            `;

            db.get(
                studentQuery,
                [],
                (studentErr, studentData) => {

                    if (studentErr) {

                        console.error(
                            "Student report error:",
                            studentErr
                        );

                        return res.status(500).json({
                            message:
                                "Failed to calculate student report"
                        });

                    }

                    // -------------------------------------------------
                    // PAYMENT MODE BREAKDOWN
                    // -------------------------------------------------

                    const modeQuery = `
                        SELECT

                            paymentMode,

                            COUNT(*) AS count,

                            COALESCE(SUM(amount), 0) AS amount

                        FROM payments

                        WHERE 1 = 1

                        ${dateCondition}

                        GROUP BY paymentMode

                        ORDER BY amount DESC
                    `;

                    db.all(
                        modeQuery,
                        dateParams,
                        (modeErr, modes) => {

                            if (modeErr) {

                                console.error(
                                    "Payment mode error:",
                                    modeErr
                                );

                                return res.status(500).json({
                                    message:
                                        "Failed to load payment modes"
                                });

                            }

                            // -------------------------------------------------
                            // CLASS-WISE COLLECTION
                            // -------------------------------------------------

                            const classQuery = `
                                SELECT

                                    s.className AS className,

                                    COUNT(p.id) AS payments,

                                    COALESCE(
                                        SUM(p.amount),
                                        0
                                    ) AS collection

                                FROM payments p

                                LEFT JOIN students s
                                    ON s.id = p.studentId

                                WHERE 1 = 1

                                ${dateCondition}

                                GROUP BY s.className

                                ORDER BY collection DESC
                            `;

                            db.all(
                                classQuery,
                                dateParams,
                                (classErr, classes) => {

                                    if (classErr) {

                                        console.error(
                                            "Class report error:",
                                            classErr
                                        );

                                        return res.status(500).json({
                                            message:
                                                "Failed to load class report"
                                        });

                                    }

                                    // -------------------------------------------------
                                    // RECENT PAYMENTS
                                    // -------------------------------------------------

                                    const recentQuery = `
                                        SELECT

                                            p.id,

                                            p.paymentDate,

                                            p.amount,

                                            p.paymentMode,

                                            s.studentName,

                                            s.className

                                        FROM payments p

                                        LEFT JOIN students s
                                            ON s.id = p.studentId

                                        WHERE 1 = 1

                                        ${dateCondition}

                                        ORDER BY
                                            date(p.paymentDate) DESC,
                                            p.id DESC

                                        LIMIT 10
                                    `;

                                    db.all(
                                        recentQuery,
                                        dateParams,
                                        (recentErr, recentPayments) => {

                                            if (recentErr) {

                                                console.error(
                                                    "Recent payment error:",
                                                    recentErr
                                                );

                                                return res.status(500).json({
                                                    message:
                                                        "Failed to load recent payments"
                                                });

                                            }

                                            // -------------------------------------------------
                                            // CALCULATE PENDING
                                            // -------------------------------------------------

                                            const totalFee =
                                                Number(
                                                    studentData.totalFee || 0
                                                );

                                            const totalPaid =
                                                Number(
                                                    report.totalCollection || 0
                                                );

                                            const pendingFees =
                                                Math.max(
                                                    0,
                                                    totalFee - totalPaid
                                                );

                                            // -------------------------------------------------
                                            // RESPONSE
                                            // -------------------------------------------------

                                            res.json({

                                                period,

                                                summary: {

                                                    totalStudents:
                                                        Number(
                                                            studentData.totalStudents || 0
                                                        ),

                                                    totalPayments:
                                                        Number(
                                                            report.totalPayments || 0
                                                        ),

                                                    totalCollection:
                                                        Number(
                                                            report.totalCollection || 0
                                                        ),

                                                    averagePayment:
                                                        Number(
                                                            report.averagePayment || 0
                                                        ),

                                                    highestPayment:
                                                        Number(
                                                            report.highestPayment || 0
                                                        ),

                                                    pendingFees:
                                                        pendingFees
                                                },

                                                paymentModes:
                                                    modes || [],

                                                classWise:
                                                    classes || [],

                                                recentPayments:
                                                    recentPayments || []

                                            });

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }
    );
};
// =====================================================
// DETAILED REPORT SUMMARY
// =====================================================

exports.reportSummary = (req, res) => {

    const period = req.query.period || "all";

    const db = require("../db");

    // -------------------------------------------------
    // Get all students
    // -------------------------------------------------

    const studentsQuery = `
        SELECT
            id,
            studentName,
            className,
            COALESCE(previousDues, 0) AS previousDues,
            COALESCE(tuitionFee, 0) AS tuitionFee
        FROM students
        ORDER BY className, studentName
    `;

    db.all(studentsQuery, [], (studentError, students) => {

        if (studentError) {

            console.error(
                "REPORT STUDENTS ERROR:",
                studentError
            );

            return res.status(500).json({
                message: "Failed to load students report"
            });
        }

        // -------------------------------------------------
        // Get all payments
        // -------------------------------------------------

        const paymentsQuery = `
            SELECT
                p.id,
                p.studentId,
                p.paymentDate,
                COALESCE(p.amount, 0) AS amount,
                p.paymentMode,
                s.studentName,
                s.className
            FROM payments p
            LEFT JOIN students s
                ON s.id = p.studentId
            ORDER BY p.id DESC
        `;

        db.all(paymentsQuery, [], (paymentError, payments) => {

            if (paymentError) {

                console.error(
                    "REPORT PAYMENTS ERROR:",
                    paymentError
                );

                return res.status(500).json({
                    message: "Failed to load payments report"
                });
            }

            // -------------------------------------------------
            // Date helper
            // Supports:
            // YYYY-MM-DD
            // DD-MM-YYYY
            // DD/MM/YYYY
            // -------------------------------------------------

            const parsePaymentDate = (value) => {

                if (!value) {
                    return null;
                }

                const stringValue = String(value).trim();

                // YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {

                    const [year, month, day] =
                        stringValue.split("-").map(Number);

                    return new Date(
                        year,
                        month - 1,
                        day
                    );
                }

                // DD-MM-YYYY
                if (/^\d{2}-\d{2}-\d{4}$/.test(stringValue)) {

                    const [day, month, year] =
                        stringValue.split("-").map(Number);

                    return new Date(
                        year,
                        month - 1,
                        day
                    );
                }

                // DD/MM/YYYY
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(stringValue)) {

                    const [day, month, year] =
                        stringValue.split("/").map(Number);

                    return new Date(
                        year,
                        month - 1,
                        day
                    );
                }

                const parsed = new Date(stringValue);

                if (isNaN(parsed.getTime())) {
                    return null;
                }

                return parsed;
            };

            // -------------------------------------------------
            // Today
            // -------------------------------------------------

            const today = new Date();

            today.setHours(23, 59, 59, 999);

            // -------------------------------------------------
            // Start date according to period
            // -------------------------------------------------

            let startDate = null;

            if (period === "week") {

                startDate = new Date(today);

                startDate.setDate(
                    today.getDate() - 6
                );

                startDate.setHours(0, 0, 0, 0);
            }

            if (period === "month") {

                startDate = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    1
                );

                startDate.setHours(0, 0, 0, 0);
            }

            // -------------------------------------------------
            // Filter payments
            // -------------------------------------------------

            const filteredPayments = payments.filter(
                (payment) => {

                    if (period === "all") {
                        return true;
                    }

                    const paymentDate =
                        parsePaymentDate(
                            payment.paymentDate
                        );

                    if (!paymentDate) {
                        return false;
                    }

                    return (
                        paymentDate >= startDate &&
                        paymentDate <= today
                    );
                }
            );

            // -------------------------------------------------
            // Basic calculations
            // -------------------------------------------------

            const totalStudents =
                students.length;

            const totalPayments =
                filteredPayments.length;

            const totalCollection =
                filteredPayments.reduce(
                    (total, payment) =>
                        total +
                        Number(payment.amount || 0),
                    0
                );

            // -------------------------------------------------
            // Pending fees
            //
            // Pending fees should NOT depend on selected
            // weekly/monthly period.
            // It represents current outstanding fees.
            // -------------------------------------------------

            const studentPaidMap = {};

            payments.forEach((payment) => {

                const studentId =
                    payment.studentId;

                if (!studentPaidMap[studentId]) {
                    studentPaidMap[studentId] = 0;
                }

                studentPaidMap[studentId] +=
                    Number(payment.amount || 0);
            });

            let pendingFees = 0;

            students.forEach((student) => {

                const totalFee =
                    Number(student.tuitionFee || 0) +
                    Number(student.previousDues || 0);

                const totalPaid =
                    Number(
                        studentPaidMap[student.id] || 0
                    );

                const remaining =
                    totalFee - totalPaid;

                if (remaining > 0) {
                    pendingFees += remaining;
                }
            });

            // -------------------------------------------------
            // Average payment
            // -------------------------------------------------

            const averagePayment =
                totalPayments > 0
                    ? totalCollection / totalPayments
                    : 0;

            // -------------------------------------------------
            // Highest payment
            // -------------------------------------------------

            const highestPayment =
                totalPayments > 0
                    ? Math.max(
                        ...filteredPayments.map(
                            payment =>
                                Number(
                                    payment.amount || 0
                                )
                        )
                    )
                    : 0;

            // -------------------------------------------------
            // Payment mode collection
            // -------------------------------------------------

            const paymentModes = {};

            filteredPayments.forEach((payment) => {

                const mode =
                    payment.paymentMode ||
                    "Other";

                if (!paymentModes[mode]) {
                    paymentModes[mode] = 0;
                }

                paymentModes[mode] +=
                    Number(payment.amount || 0);
            });

            const modeCollection =
                Object.entries(paymentModes)
                    .map(([mode, amount]) => ({
                        mode,
                        amount
                    }))
                    .sort(
                        (a, b) =>
                            b.amount - a.amount
                    );

            // -------------------------------------------------
            // Class-wise collection
            // -------------------------------------------------

            const classMap = {};

            filteredPayments.forEach((payment) => {

                const className =
                    payment.className ||
                    "Unknown";

                if (!classMap[className]) {

                    classMap[className] = {
                        className,
                        payments: 0,
                        collection: 0
                    };
                }

                classMap[className].payments += 1;

                classMap[className].collection +=
                    Number(payment.amount || 0);
            });

            const classCollection =
                Object.values(classMap)
                    .sort(
                        (a, b) =>
                            b.collection -
                            a.collection
                    );

            // -------------------------------------------------
            // Recent payments
            // -------------------------------------------------

            const recentPayments =
                filteredPayments
                    .slice(0, 10)
                    .map((payment) => ({
                        id: payment.id,
                        studentId: payment.studentId,
                        studentName:
                            payment.studentName ||
                            "Unknown Student",
                        className:
                            payment.className ||
                            "-",
                        paymentDate:
                            payment.paymentDate,
                        amount:
                            Number(payment.amount || 0),
                        paymentMode:
                            payment.paymentMode ||
                            "-"
                    }));

            // -------------------------------------------------
            // Response
            // -------------------------------------------------

            res.json({

                period,

                totalStudents,

                totalPayments,

                totalCollection,

                pendingFees,

                averagePayment,

                highestPayment,

                modeCollection,

                classCollection,

                recentPayments

            });

        });

    });

};