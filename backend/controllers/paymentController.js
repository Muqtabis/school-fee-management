const db = require("../db");

const logAudit =
    require("../utils/auditLogger");


const activePaymentCondition = `
    (
        status IS NULL
        OR status != 'reversed'
    )
`;


// =====================================================
// GET PAYMENTS
// =====================================================

exports.getPayments = (
    req,
    res
) => {

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
            students.fatherName,

            ay.name AS academicYearName

        FROM payments

        LEFT JOIN students
            ON payments.studentId =
               students.id

        LEFT JOIN student_fee_accounts sfa
            ON payments.feeAccountId =
               sfa.id

        LEFT JOIN student_enrollments se
            ON sfa.enrollmentId =
               se.id

        LEFT JOIN academic_years ay
            ON se.academicYearId =
               ay.id

        WHERE 1 = 1
    `;


    const params = [];


    if (search) {

        sql += `
            AND (
                LOWER(
                    students.studentName
                ) LIKE LOWER(?)

                OR LOWER(
                    students.rollNumber
                ) LIKE LOWER(?)

                OR LOWER(
                    students.className
                ) LIKE LOWER(?)
            )
        `;

        const value =
            `%${search}%`;


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

        params.push(
            studentId
        );

    }


    if (
        className &&
        className !== "All"
    ) {

        sql += `
            AND students.className = ?
        `;

        params.push(
            className
        );

    }


    if (
        paymentMode &&
        paymentMode !== "All"
    ) {

        sql += `
            AND payments.paymentMode = ?
        `;

        params.push(
            paymentMode
        );

    }


    if (dateFrom) {

        sql += `
            AND payments.paymentDate >= ?
        `;

        params.push(
            dateFrom
        );

    }


    if (dateTo) {

        sql += `
            AND payments.paymentDate <= ?
        `;

        params.push(
            dateTo
        );

    }


    sql += `
        ORDER BY
            payments.paymentDate DESC,
            payments.id DESC
    `;


    db.all(
        sql,
        params,
        (
            err,
            rows
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        err.message

                });

            }


            res.json(rows);

        }
    );

};


// =====================================================
// ACTIVE ACADEMIC YEAR
// =====================================================

function getActiveYear() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            db.get(
                `
                SELECT *
                FROM academic_years
                WHERE status = 'active'
                LIMIT 1
                `,
                [],
                (
                    err,
                    year
                ) => {

                    if (err) {

                        reject(err);

                        return;

                    }

                    resolve(year);

                }
            );

        }
    );

}


// =====================================================
// GET SINGLE PAYMENT
// =====================================================

exports.getPayment = (
    req,
    res
) => {

    db.get(
        `
        SELECT

            payments.*,

            students.studentName,
            students.rollNumber,
            students.className,
            students.fatherName,
            students.contact1,

            ay.name AS academicYearName

        FROM payments

        LEFT JOIN students
            ON payments.studentId =
               students.id

        LEFT JOIN student_fee_accounts sfa
            ON payments.feeAccountId =
               sfa.id

        LEFT JOIN student_enrollments se
            ON sfa.enrollmentId =
               se.id

        LEFT JOIN academic_years ay
            ON se.academicYearId =
               ay.id

        WHERE payments.id = ?
        `,
        [
            req.params.id
        ],
        (
            err,
            payment
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        err.message

                });

            }


            if (!payment) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Payment not found."

                });

            }


            res.json(payment);

        }
    );

};


// =====================================================
// ADD PAYMENT
// =====================================================

exports.addPayment = async (
    req,
    res
) => {

    const {
        studentId,
        paymentDate,
        amount,
        paymentMode,
        remarks
    } = req.body;


    if (
        !studentId ||
        !paymentDate ||
        amount === undefined ||
        !paymentMode
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Student, date, amount and payment mode are required."

        });

    }


    const paymentAmount =
        Number(
            amount
        );


    if (
        !Number.isFinite(
            paymentAmount
        ) ||
        paymentAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Payment amount must be greater than zero."

        });

    }


    try {

        // =================================================
        // ONLY ACTIVE YEAR
        // =================================================

        const activeYear =
            await getActiveYear();


        if (!activeYear) {

            return res.status(409).json({

                success: false,

                message:
                    "No active academic year is configured."

            });

        }


        // =================================================
        // STUDENT
        // =================================================

        const student =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT *
                        FROM students
                        WHERE id = ?
                        `,
                        [
                            studentId
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(row);

                        }
                    );

                }
            );


        if (!student) {

            return res.status(404).json({

                success: false,

                message:
                    "Student not found."

            });

        }


        if (
            student.status ===
            "archived"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Archived students cannot receive payments."

            });

        }


        // =================================================
        // STUDENT FEE ACCOUNT
        // =================================================

        const feeAccount =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            sfa.id,

                            se.className,

                            se.rollNumber,

                            ay.name AS academicYearName

                        FROM student_fee_accounts sfa

                        INNER JOIN student_enrollments se
                            ON se.id =
                               sfa.enrollmentId

                        INNER JOIN academic_years ay
                            ON ay.id =
                               se.academicYearId

                        WHERE se.studentId = ?

                        AND se.academicYearId = ?

                        LIMIT 1
                        `,
                        [
                            studentId,
                            activeYear.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(row);

                        }
                    );

                }
            );


        if (!feeAccount) {

            return res.status(409).json({

                success: false,

                message:
                    "This student does not have a fee account for the active academic year."

            });

        }


        // =================================================
        // CURRENT FEE
        // =================================================

        const feeItems =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.all(
                        `
                        SELECT
                            sfi.amount,
                            fc.componentKey,
                            fc.componentName

                        FROM student_fee_items sfi

                        INNER JOIN fee_components fc
                            ON fc.id =
                               sfi.componentId

                        WHERE sfi.feeAccountId = ?
                        `,
                        [
                            feeAccount.id
                        ],
                        (
                            err,
                            rows
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(rows);

                        }
                    );

                }
            );


        const totalFee =
            feeItems.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.amount ||
                        0
                    ),
                0
            );


        const previousPaid =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            COALESCE(
                                SUM(amount),
                                0
                            ) AS total

                        FROM payments

                        WHERE feeAccountId = ?

                        AND ${activePaymentCondition}
                        `,
                        [
                            feeAccount.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(
                                Number(
                                    row.total ||
                                    0
                                )
                            );

                        }
                    );

                }
            );


        const totalPaid =
            previousPaid +
            paymentAmount;


        const balance =
            Math.max(
                0,
                totalFee -
                totalPaid
            );


        // =================================================
        // INSERT PAYMENT
        // =================================================

        const result =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.run(
                        `
                        INSERT INTO payments
                        (
                            studentId,
                            feeAccountId,
                            paymentDate,
                            amount,
                            paymentMode,
                            remarks,
                            status
                        )
                        VALUES (?, ?, ?, ?, ?, ?, 'completed')
                        `,
                        [
                            studentId,

                            feeAccount.id,

                            paymentDate,

                            paymentAmount,

                            paymentMode,

                            remarks || ""

                        ],
                        function (
                            err
                        ) {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(
                                this
                            );

                        }
                    );

                }
            );


        const paymentId =
            result.lastID;


        // =================================================
        // NOTIFICATION
        // =================================================

        if (
            student.contact1
        ) {

            const message =
                `Dear Parent, ` +
                `₹${paymentAmount.toFixed(2)} fee has been received ` +
                `for ${student.studentName}. ` +
                `Academic Year: ${activeYear.name}. ` +
                `Payment Mode: ${paymentMode}. ` +
                `Total Fee: ₹${totalFee.toFixed(2)}. ` +
                `Total Paid: ₹${totalPaid.toFixed(2)}. ` +
                `Remaining Fee: ₹${balance.toFixed(2)}. ` +
                `Thank you, THE AGE SCHOOL.`;


            await new Promise(
                resolve => {

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
                        () => {

                            resolve();

                        }
                    );

                }
            );

        }


        await logAudit({

            userId:
                req.user.id,

            action:
                "PAYMENT_CREATED",

            entityType:
                "payment",

            entityId:
                paymentId,

            details: {

                studentId:
                    student.id,

                studentName:
                    student.studentName,

                academicYear:
                    activeYear.name,

                feeAccountId:
                    feeAccount.id,

                amount:
                    paymentAmount,

                paymentDate,

                paymentMode,

                remarks:
                    remarks || ""

            }

        });


        res.status(201).json({

            success: true,

            id:
                paymentId,

            message:
                "Payment added successfully.",

            academicYear:
                activeYear.name,

            feeSummary: {

                totalFee,

                totalPaid,

                balance

            }

        });

    } catch (error) {

        console.error(
            "Add Payment Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to add payment."

        });

    }

};


// =====================================================
// REVERSE PAYMENT
// =====================================================

exports.reversePayment = (
    req,
    res
) => {

    const paymentId =
        Number(
            req.params.id
        );


    const reason =
        String(
            req.body?.reason ||
            ""
        ).trim();


    if (!reason) {

        return res.status(400).json({

            success: false,

            message:
                "A reversal reason is required."

        });

    }


    db.get(
        `
        SELECT *

        FROM payments

        WHERE id = ?
        `,
        [
            paymentId
        ],
        (
            err,
            payment
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find payment."

                });

            }


            if (!payment) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Payment not found."

                });

            }


            if (
                payment.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Payment is already reversed."

                });

            }


            const reversedAt =
                new Date().toISOString();


            db.run(
                `
                UPDATE payments

                SET

                    status = 'reversed',

                    voidedAt = ?,

                    voidedBy = ?,

                    voidReason = ?

                WHERE id = ?

                AND (
                    status IS NULL
                    OR status != 'reversed'
                )
                `,
                [
                    reversedAt,
                    req.user.id,
                    reason,
                    paymentId
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to reverse payment."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "PAYMENT_REVERSED",

                        entityType:
                            "payment",

                        entityId:
                            paymentId,

                        details: {

                            amount:
                                payment.amount,

                            studentId:
                                payment.studentId,

                            feeAccountId:
                                payment.feeAccountId,

                            reason,

                            reversedAt

                        }

                    }).then(() => {

                        res.json({

                            success: true,

                            message:
                                "Payment reversed successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// STUDENT FEE HISTORY
// =====================================================

exports.studentFeeHistory = async (
    req,
    res
) => {

    try {

        const studentId =
            Number(
                req.params.studentId
            );


        const year =
            await getActiveYear();


        if (!year) {

            return res.status(404).json({

                success: false,

                message:
                    "No active academic year."

            });

        }


        const account =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            sfa.id,

                            ay.name AS academicYearName,

                            se.className,

                            se.rollNumber,

                            s.studentName

                        FROM student_fee_accounts sfa

                        INNER JOIN student_enrollments se
                            ON se.id =
                               sfa.enrollmentId

                        INNER JOIN academic_years ay
                            ON ay.id =
                               se.academicYearId

                        INNER JOIN students s
                            ON s.id =
                               se.studentId

                        WHERE se.studentId = ?

                        AND se.academicYearId = ?

                        LIMIT 1
                        `,
                        [
                            studentId,
                            year.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(row);

                        }
                    );

                }
            );


        if (!account) {

            return res.status(404).json({

                success: false,

                message:
                    "Fee account not found for the active academic year."

            });

        }


        const items =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.all(
                        `
                        SELECT

                            sfi.*,

                            fc.componentName,
                            fc.componentKey,
                            fc.sortOrder

                        FROM student_fee_items sfi

                        INNER JOIN fee_components fc
                            ON fc.id =
                               sfi.componentId

                        WHERE sfi.feeAccountId = ?

                        ORDER BY
                            fc.sortOrder
                        `,
                        [
                            account.id
                        ],
                        (
                            err,
                            rows
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(rows);

                        }
                    );

                }
            );


        const payments =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.all(
                        `
                        SELECT *

                        FROM payments

                        WHERE feeAccountId = ?

                        ORDER BY
                            paymentDate DESC,
                            id DESC
                        `,
                        [
                            account.id
                        ],
                        (
                            err,
                            rows
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(rows);

                        }
                    );

                }
            );


        const totalFee =
            items.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.amount ||
                        0
                    ),
                0
            );


        const totalPaid =
            payments
                .filter(
                    payment =>
                        payment.status !==
                        "reversed"
                )
                .reduce(
                    (
                        total,
                        payment
                    ) =>
                        total +
                        Number(
                            payment.amount ||
                            0
                        ),
                    0
                );


        res.json({

            student: {

                id:
                    studentId,

                studentName:
                    account.studentName,

                className:
                    account.className,

                rollNumber:
                    account.rollNumber

            },

            academicYear: {

                id:
                    year.id,

                name:
                    year.name,

                status:
                    year.status

            },

            items,

            payments,

            totalFee,

            totalPaid,

            balance:
                Math.max(
                    0,
                    totalFee -
                    totalPaid
                )

        });

    } catch (error) {

        console.error(
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load fee history."

        });

    }

};


// =====================================================
// DASHBOARD SUMMARY
// =====================================================

exports.dashboardSummary = async (
    req,
    res
) => {

    try {

        const year =
            await getActiveYear();


        if (!year) {

            return res.status(404).json({

                success: false,

                message:
                    "No active academic year."

            });

        }


        const totalStudents =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT
                            COUNT(*) AS total

                        FROM student_enrollments

                        WHERE academicYearId = ?

                        AND status = 'active'
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(
                                Number(
                                    row.total ||
                                    0
                                )
                            );

                        }
                    );

                }
            );


        const feeData =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            COALESCE(
                                SUM(sfi.amount),
                                0
                            ) AS totalFee

                        FROM student_fee_items sfi

                        INNER JOIN student_fee_accounts sfa
                            ON sfa.id =
                               sfi.feeAccountId

                        INNER JOIN student_enrollments se
                            ON se.id =
                               sfa.enrollmentId

                        WHERE
                            se.academicYearId = ?

                        AND se.status = 'active'
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(
                                Number(
                                    row.totalFee ||
                                    0
                                )
                            );

                        }
                    );

                }
            );


        const paymentData =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            COUNT(*) AS totalPayments,

                            COALESCE(
                                SUM(amount),
                                0
                            ) AS totalCollection

                        FROM payments

                        WHERE feeAccountId IN (

                            SELECT
                                sfa.id

                            FROM student_fee_accounts sfa

                            INNER JOIN student_enrollments se
                                ON se.id =
                                   sfa.enrollmentId

                            WHERE
                                se.academicYearId = ?
                        )

                        AND ${activePaymentCondition}
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(row);

                        }
                    );

                }
            );


        res.json({

            academicYear: {

                id:
                    year.id,

                name:
                    year.name

            },

            totalStudents,

            totalPayments:
                Number(
                    paymentData.totalPayments ||
                    0
                ),

            totalCollection:
                Number(
                    paymentData.totalCollection ||
                    0
                ),

            totalFee:
                feeData,

            pendingFees:
                Math.max(
                    0,
                    feeData -
                    Number(
                        paymentData.totalCollection ||
                        0
                    )
                )

        });

    } catch (error) {

        console.error(
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load dashboard summary."

        });

    }

};


// =====================================================
// MONTHLY COLLECTION
// =====================================================

exports.monthlyCollection = async (
    req,
    res
) => {

    try {

        const year =
            await getActiveYear();


        if (!year) {

            return res.json([]);

        }


        db.all(
            `
            SELECT

                strftime(
                    '%Y-%m',
                    paymentDate
                ) AS month,

                COALESCE(
                    SUM(amount),
                    0
                ) AS collection

            FROM payments

            WHERE feeAccountId IN (

                SELECT
                    sfa.id

                FROM student_fee_accounts sfa

                INNER JOIN student_enrollments se
                    ON se.id =
                       sfa.enrollmentId

                WHERE
                    se.academicYearId = ?
            )

            AND ${activePaymentCondition}

            GROUP BY
                strftime(
                    '%Y-%m',
                    paymentDate
                )

            ORDER BY
                month ASC
            `,
            [
                year.id
            ],
            (
                err,
                rows
            ) => {

                if (err) {

                    return res.status(500).json({

                        success: false,

                        message:
                            err.message

                    });

                }


                res.json(rows);

            }
        );

    } catch (error) {

        res.status(500).json({

            success: false,

            message:
                "Unable to load monthly collection."

        });

    }

};


// =====================================================
// RECEIPT
// =====================================================

exports.getReceipt = (
    req,
    res
) => {

    db.get(
        `
        SELECT

            payments.*,

            students.studentName,
            students.rollNumber,
            students.className,
            students.fatherName,
            students.contact1,

            ay.name AS academicYearName

        FROM payments

        LEFT JOIN students
            ON payments.studentId =
               students.id

        LEFT JOIN student_fee_accounts sfa
            ON payments.feeAccountId =
               sfa.id

        LEFT JOIN student_enrollments se
            ON sfa.enrollmentId =
               se.id

        LEFT JOIN academic_years ay
            ON se.academicYearId =
               ay.id

        WHERE payments.id = ?
        `,
        [
            req.params.id
        ],
        (
            err,
            receipt
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load receipt."

                });

            }


            if (!receipt) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Receipt not found."

                });

            }


            if (
                receipt.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "A reversed payment cannot generate a receipt."

                });

            }


            res.json(receipt);

        }
    );

};


// =====================================================
// REPORT SUMMARY
// =====================================================

exports.reportSummary = async (
    req,
    res
) => {

    try {

        const year =
            await getActiveYear();


        if (!year) {

            return res.status(404).json({

                success: false,

                message:
                    "No active academic year."

            });

        }


        const students =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.all(
                        `
                        SELECT

                            se.studentId,
                            se.className,
                            se.rollNumber,
                            s.studentName

                        FROM student_enrollments se

                        INNER JOIN students s
                            ON s.id =
                               se.studentId

                        WHERE
                            se.academicYearId = ?

                        AND se.status = 'active'

                        ORDER BY
                            se.className,
                            se.rollNumber
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            rows
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(rows);

                        }
                    );

                }
            );


        const payments =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.all(
                        `
                        SELECT

                            p.id,
                            p.studentId,
                            p.paymentDate,
                            p.amount,
                            p.paymentMode,
                            p.status,
                            s.studentName,
                            se.className

                        FROM payments p

                        INNER JOIN student_fee_accounts sfa
                            ON sfa.id =
                               p.feeAccountId

                        INNER JOIN student_enrollments se
                            ON se.id =
                               sfa.enrollmentId

                        INNER JOIN students s
                            ON s.id =
                               p.studentId

                        WHERE se.academicYearId = ?

                        ORDER BY
                            p.paymentDate DESC,
                            p.id DESC
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            rows
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(rows);

                        }
                    );

                }
            );


        const activePayments =
            payments.filter(
                payment =>
                    payment.status !==
                    "reversed"
            );


        const totalCollection =
            activePayments.reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    Number(
                        payment.amount ||
                        0
                    ),
                0
            );


        const totalPayments =
            activePayments.length;


        const totalStudents =
            students.length;


        const feeTotal =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    db.get(
                        `
                        SELECT

                            COALESCE(
                                SUM(sfi.amount),
                                0
                            ) AS total

                        FROM student_fee_items sfi

                        INNER JOIN student_fee_accounts sfa
                            ON sfa.id =
                               sfi.feeAccountId

                        INNER JOIN student_enrollments se
                            ON se.id =
                               sfa.enrollmentId

                        WHERE
                            se.academicYearId = ?

                        AND se.status = 'active'
                        `,
                        [
                            year.id
                        ],
                        (
                            err,
                            row
                        ) => {

                            if (err) {

                                reject(err);

                                return;

                            }

                            resolve(
                                Number(
                                    row.total ||
                                    0
                                )
                            );

                        }
                    );

                }
            );


        const averagePayment =
            totalPayments > 0
                ? totalCollection /
                  totalPayments
                : 0;


        const highestPayment =
            totalPayments > 0
                ? Math.max(
                    ...activePayments.map(
                        payment =>
                            Number(
                                payment.amount ||
                                0
                            )
                    )
                )
                : 0;


        const modeMap =
            {};


        activePayments.forEach(
            payment => {

                const mode =
                    payment.paymentMode ||
                    "Other";


                modeMap[mode] =
                    (
                        modeMap[mode] ||
                        0
                    ) +
                    Number(
                        payment.amount ||
                        0
                    );

            }
        );


        const modeCollection =
            Object.entries(
                modeMap
            ).map(
                (
                    [
                        mode,
                        amount
                    ]
                ) => ({

                    mode,
                    amount

                })
            );


        const classMap =
            {};


        activePayments.forEach(
            payment => {

                const className =
                    payment.className ||
                    "Unknown";


                if (
                    !classMap[
                        className
                    ]
                ) {

                    classMap[
                        className
                    ] = {

                        className,

                        payments:
                            0,

                        collection:
                            0

                    };

                }


                classMap[
                    className
                ].payments += 1;


                classMap[
                    className
                ].collection +=
                    Number(
                        payment.amount ||
                        0
                    );

            }
        );


        const classCollection =
            Object.values(
                classMap
            );


        res.json({

            period:
                req.query.period ||
                "all",

            academicYear: {

                id:
                    year.id,

                name:
                    year.name

            },

            totalStudents,

            totalPayments,

            totalCollection,

            pendingFees:
                Math.max(
                    0,
                    feeTotal -
                    totalCollection
                ),

            totalFee:
                feeTotal,

            averagePayment,

            highestPayment,

            modeCollection,

            classCollection,

            recentPayments:
                activePayments.slice(
                    0,
                    10
                )

        });

    } catch (error) {

        console.error(
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to generate report."

        });

    }

};


// =====================================================
// EDIT / DELETE DISABLED
// =====================================================

exports.updatePayment = (
    req,
    res
) => {

    res.status(405).json({

        success: false,

        message:
            "Posted payments cannot be edited. Reverse the payment and create a corrected payment."

    });

};


exports.deletePayment = (
    req,
    res
) => {

    res.status(405).json({

        success: false,

        message:
            "Payments cannot be permanently deleted. Use reversal instead."

    });

};