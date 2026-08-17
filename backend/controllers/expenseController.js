const db = require("../db");


// =====================================================
// GET ALL EXPENSES
// =====================================================

exports.getExpenses = (req, res) => {

    const {
        category,
        search,
        startDate,
        endDate
    } = req.query;

    let query = `
        SELECT *
        FROM expenses
        WHERE 1 = 1
    `;

    const params = [];


    if (category && category !== "all") {

        query += ` AND category = ?`;

        params.push(category);

    }


    if (search) {

        query += `
            AND (
                expenseName LIKE ?
                OR paidTo LIKE ?
                OR description LIKE ?
            )
        `;

        const value = `%${search}%`;

        params.push(value, value, value);

    }


    if (startDate) {

        query += ` AND expenseDate >= ?`;

        params.push(startDate);

    }


    if (endDate) {

        query += ` AND expenseDate <= ?`;

        params.push(endDate);

    }


    query += `
        ORDER BY expenseDate DESC, id DESC
    `;


    db.all(
        query,
        params,
        (err, rows) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Unable to fetch expenses"
                });

            }

            res.json(rows);

        }
    );

};


// =====================================================
// GET SINGLE EXPENSE
// =====================================================

exports.getExpense = (req, res) => {

    const { id } = req.params;

    db.get(
        `SELECT * FROM expenses WHERE id = ?`,
        [id],
        (err, row) => {

            if (err) {

                return res.status(500).json({
                    message: "Unable to fetch expense"
                });

            }

            if (!row) {

                return res.status(404).json({
                    message: "Expense not found"
                });

            }

            res.json(row);

        }
    );

};


// =====================================================
// ADD EXPENSE
// =====================================================

exports.addExpense = (req, res) => {

    const {
        expenseName,
        category,
        amount,
        expenseDate,
        paymentMode,
        paidTo,
        description
    } = req.body;


    if (
        !expenseName ||
        !category ||
        !amount ||
        !expenseDate ||
        !paymentMode
    ) {

        return res.status(400).json({
            message: "Please fill all required fields"
        });

    }


    db.run(
        `
        INSERT INTO expenses
        (
            expenseName,
            category,
            amount,
            expenseDate,
            paymentMode,
            paidTo,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
            expenseName,
            category,
            Number(amount),
            expenseDate,
            paymentMode,
            paidTo || "",
            description || ""
        ],
        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Unable to add expense"
                });

            }


            res.status(201).json({

                success: true,

                message: "Expense added successfully",

                id: this.lastID

            });

        }
    );

};


// =====================================================
// UPDATE EXPENSE
// =====================================================

exports.updateExpense = (req, res) => {

    const { id } = req.params;

    const {
        expenseName,
        category,
        amount,
        expenseDate,
        paymentMode,
        paidTo,
        description
    } = req.body;


    if (
        !expenseName ||
        !category ||
        !amount ||
        !expenseDate ||
        !paymentMode
    ) {

        return res.status(400).json({
            message: "Please fill all required fields"
        });

    }


    db.run(
        `
        UPDATE expenses

        SET
            expenseName = ?,
            category = ?,
            amount = ?,
            expenseDate = ?,
            paymentMode = ?,
            paidTo = ?,
            description = ?

        WHERE id = ?
        `,
        [
            expenseName,
            category,
            Number(amount),
            expenseDate,
            paymentMode,
            paidTo || "",
            description || "",
            id
        ],
        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Unable to update expense"
                });

            }


            if (this.changes === 0) {

                return res.status(404).json({
                    message: "Expense not found"
                });

            }


            res.json({

                success: true,

                message: "Expense updated successfully"

            });

        }
    );

};


// =====================================================
// DELETE EXPENSE
// =====================================================

exports.deleteExpense = (req, res) => {

    const { id } = req.params;


    db.run(
        `
        DELETE FROM expenses
        WHERE id = ?
        `,
        [id],
        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    message: "Unable to delete expense"
                });

            }


            if (this.changes === 0) {

                return res.status(404).json({
                    message: "Expense not found"
                });

            }


            res.json({

                success: true,

                message: "Expense deleted successfully"

            });

        }
    );

};


// =====================================================
// EXPENSE SUMMARY
// =====================================================

exports.expenseSummary = (req, res) => {

    const queries = {

        // Total amount spent
        total: `
            SELECT
                COALESCE(SUM(amount), 0) AS total
            FROM expenses
        `,

        // Number of expense transactions
        count: `
            SELECT
                COUNT(*) AS total
            FROM expenses
        `,

        // Current month expenses
        month: `
            SELECT
                COALESCE(SUM(amount), 0) AS total
            FROM expenses
            WHERE strftime('%Y-%m', expenseDate) =
                  strftime('%Y-%m', 'now')
        `,

        // Current year expenses
        year: `
            SELECT
                COALESCE(SUM(amount), 0) AS total
            FROM expenses
            WHERE strftime('%Y', expenseDate) =
                  strftime('%Y', 'now')
        `
    };


    // =====================================================
    // TOTAL EXPENSE AMOUNT
    // =====================================================

    db.get(
        queries.total,
        [],
        (err, totalResult) => {

            if (err) {

                console.error(
                    "Total Expense Error:",
                    err
                );

                return res.status(500).json({
                    message:
                        "Unable to calculate total expenses"
                });

            }


            // =====================================================
            // EXPENSE TRANSACTION COUNT
            // =====================================================

            db.get(
                queries.count,
                [],
                (err, countResult) => {

                    if (err) {

                        console.error(
                            "Expense Count Error:",
                            err
                        );

                        return res.status(500).json({
                            message:
                                "Unable to calculate expense transactions"
                        });

                    }


                    // =====================================================
                    // MONTHLY EXPENSE
                    // =====================================================

                    db.get(
                        queries.month,
                        [],
                        (err, monthResult) => {

                            if (err) {

                                return res.status(500).json({
                                    message:
                                        "Unable to calculate monthly expenses"
                                });

                            }


                            // =====================================================
                            // YEARLY EXPENSE
                            // =====================================================

                            db.get(
                                queries.year,
                                [],
                                (err, yearResult) => {

                                    if (err) {

                                        return res.status(500).json({
                                            message:
                                                "Unable to calculate yearly expenses"
                                        });

                                    }


                                    // =====================================================
                                    // FINAL RESPONSE
                                    // =====================================================

                                    res.json({

                                        // Total money spent
                                        totalExpenseAmount:
                                            totalResult.total || 0,

                                        // Number of expense records
                                        totalExpenses:
                                            countResult.total || 0,

                                        // Current month
                                        monthlyExpenses:
                                            monthResult.total || 0,

                                        // Current year
                                        yearlyExpenses:
                                            yearResult.total || 0

                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );

};