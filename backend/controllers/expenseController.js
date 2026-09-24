const db =
    require("../db");

const logAudit =
    require("../utils/auditLogger");


const activeExpenseCondition = `
    (
        status IS NULL
        OR status != 'reversed'
    )
`;


// =====================================================
// GET ALL EXPENSES
// =====================================================

exports.getExpenses = (
    req,
    res
) => {

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


    if (
        category &&
        category !== "all"
    ) {

        query += `
            AND category = ?
        `;

        params.push(
            category
        );

    }


    if (search) {

        query += `
            AND (
                expenseName LIKE ?
                OR paidTo LIKE ?
                OR description LIKE ?
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


    if (startDate) {

        query += `
            AND expenseDate >= ?
        `;

        params.push(
            startDate
        );

    }


    if (endDate) {

        query += `
            AND expenseDate <= ?
        `;

        params.push(
            endDate
        );

    }


    query += `
        ORDER BY
            expenseDate DESC,
            id DESC
    `;


    // Optional LIMIT so the dashboard can fetch only recent rows.
    const limit = Number(req.query.limit);
    if (Number.isInteger(limit) && limit > 0) {
        query += ` LIMIT ?`;
        params.push(limit);
    }


    db.all(
        query,
        params,
        (
            err,
            rows
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to fetch expenses."

                });

            }


            res.json(rows);

        }
    );

};


// =====================================================
// GET SINGLE
// =====================================================

exports.getExpense = (
    req,
    res
) => {

    db.get(
        `
        SELECT *
        FROM expenses
        WHERE id = ?
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
                        "Unable to fetch expense."

                });

            }


            if (!row) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Expense not found."

                });

            }


            res.json(row);

        }
    );

};


// =====================================================
// ADD EXPENSE
// =====================================================

exports.addExpense = (
    req,
    res
) => {

    const {
        expenseName,
        category,
        amount,
        expenseDate,
        paymentMode,
        paidTo,
        description
    } = req.body;


    const numericAmount =
        Number(amount);


    if (
        !expenseName ||
        !category ||
        !expenseDate ||
        !paymentMode ||
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter valid expense details."

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
            description,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        `,
        [
            String(
                expenseName
            ).trim(),

            category,

            numericAmount,

            expenseDate,

            paymentMode,

            paidTo
                ? String(
                    paidTo
                ).trim()
                : "",

            description
                ? String(
                    description
                ).trim()
                : ""
        ],
        function (
            err
        ) {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to add expense."

                });

            }


            const expenseId =
                this.lastID;


            logAudit({

                userId:
                    req.user.id,

                action:
                    "EXPENSE_CREATED",

                entityType:
                    "expense",

                entityId:
                    expenseId,

                details: {

                    expenseName,

                    category,

                    amount:
                        numericAmount,

                    expenseDate,

                    paymentMode

                }

            }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                res.status(201).json({

                    success: true,

                    id:
                        expenseId,

                    message:
                        "Expense added successfully."

                });

            });

        }
    );

};


// =====================================================
// UPDATE EXPENSE
// =====================================================

exports.updateExpense = (
    req,
    res
) => {

    const {
        expenseName,
        category,
        amount,
        expenseDate,
        paymentMode,
        paidTo,
        description
    } = req.body;


    const numericAmount =
        Number(amount);


    if (
        !expenseName ||
        !category ||
        !expenseDate ||
        !paymentMode ||
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter valid expense details."

        });

    }


    db.get(
        `
        SELECT *
        FROM expenses
        WHERE id = ?
        `,
        [
            req.params.id
        ],
        (
            findErr,
            expense
        ) => {

            if (findErr) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find expense."

                });

            }


            if (!expense) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Expense not found."

                });

            }


            if (
                expense.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Reversed expenses cannot be edited."

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
                    String(
                        expenseName
                    ).trim(),

                    category,

                    numericAmount,

                    expenseDate,

                    paymentMode,

                    paidTo
                        ? String(
                            paidTo
                        ).trim()
                        : "",

                    description
                        ? String(
                            description
                        ).trim()
                        : "",

                    req.params.id
                ],
                function (
                    err
                ) {

                    if (err) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to update expense."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "EXPENSE_UPDATED",

                        entityType:
                            "expense",

                        entityId:
                            Number(
                                req.params.id
                            ),

                        details: {

                            expenseName,

                            category,

                            amount:
                                numericAmount

                        }

                    }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                        res.json({

                            success: true,

                            message:
                                "Expense updated successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// REVERSE EXPENSE
// =====================================================

exports.reverseExpense = (
    req,
    res
) => {

    const expenseId =
        Number(
            req.params.id
        );


    const reason =
        String(
            req.body?.reason || ""
        ).trim();


    if (
        !expenseId ||
        expenseId <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid expense ID."

        });

    }


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
        FROM expenses
        WHERE id = ?
        `,
        [
            expenseId
        ],
        (
            err,
            expense
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find expense."

                });

            }


            if (!expense) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Expense not found."

                });

            }


            if (
                expense.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This expense has already been reversed."

                });

            }


            const voidedAt =
                new Date().toISOString();


            db.run(
                `
                UPDATE expenses

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
                    voidedAt,
                    req.user.id,
                    reason,
                    expenseId
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to reverse expense."

                        });

                    }


                    if (
                        this.changes ===
                        0
                    ) {

                        return res.status(409).json({

                            success: false,

                            message:
                                "Expense could not be reversed."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "EXPENSE_REVERSED",

                        entityType:
                            "expense",

                        entityId:
                            expenseId,

                        details: {

                            expenseName:
                                expense.expenseName,

                            amount:
                                expense.amount,

                            category:
                                expense.category,

                            reason,

                            reversedAt:
                                voidedAt

                        }

                    }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                        res.json({

                            success: true,

                            message:
                                "Expense reversed successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// EXPENSE SUMMARY
// =====================================================

exports.expenseSummary = (
    req,
    res
) => {

    db.get(
        `
        SELECT
            COALESCE(
                SUM(amount),
                0
            ) AS totalAmount,

            COUNT(*) AS totalExpenses

        FROM expenses

        WHERE ${activeExpenseCondition}
        `,
        [],
        (
            err,
            summary
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to calculate expense summary."

                });

            }


            db.get(
                `
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total

                FROM expenses

                WHERE ${activeExpenseCondition}

                AND strftime(
                    '%Y-%m',
                    expenseDate
                ) =
                    strftime(
                        '%Y-%m',
                        'now'
                    )
                `,
                [],
                (
                    monthErr,
                    month
                ) => {

                    if (monthErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to calculate monthly expenses."

                        });

                    }


                    db.get(
                        `
                        SELECT
                            COALESCE(
                                SUM(amount),
                                0
                            ) AS total

                        FROM expenses

                        WHERE ${activeExpenseCondition}

                        AND strftime(
                            '%Y',
                            expenseDate
                        ) =
                            strftime(
                                '%Y',
                                'now'
                            )
                        `,
                        [],
                        (
                            yearErr,
                            year
                        ) => {

                            if (yearErr) {

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Unable to calculate yearly expenses."

                                });

                            }


                            res.json({

                                totalExpenseAmount:
                                    Number(
                                        summary.totalAmount ||
                                        0
                                    ),

                                totalExpenses:
                                    Number(
                                        summary.totalExpenses ||
                                        0
                                    ),

                                monthlyExpenses:
                                    Number(
                                        month.total ||
                                        0
                                    ),

                                yearlyExpenses:
                                    Number(
                                        year.total ||
                                        0
                                    )

                            });

                        }
                    );

                }
            );

        }
    );

};


// =====================================================
// DELETE DISABLED
// =====================================================

exports.deleteExpense = (
    req,
    res
) => {

    return res.status(405).json({

        success: false,

        message:
            "Expenses cannot be permanently deleted. Use reversal instead."

    });

};


// =====================================================
// EXPENSE CATEGORIES (dynamic, admin-managed)
// =====================================================

// LIST — available to staff for the dropdowns.
exports.getExpenseCategories = (req, res) => {
    db.all(
        `SELECT id, categoryName, sortOrder FROM expense_categories ORDER BY sortOrder ASC, categoryName ASC`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Unable to load expense categories." });
            }
            res.json(rows || []);
        }
    );
};

// CREATE — admin only.
exports.createExpenseCategory = (req, res) => {
    const name = String(req.body?.categoryName || "").trim();

    if (!name) {
        return res.status(400).json({ success: false, message: "Category name is required." });
    }

    db.get(
        `SELECT id FROM expense_categories WHERE LOWER(categoryName) = LOWER(?)`,
        [name],
        (findErr, existing) => {
            if (findErr) {
                return res.status(500).json({ success: false, message: "Unable to check category." });
            }
            if (existing) {
                return res.status(409).json({ success: false, message: "This category already exists." });
            }

            db.get(`SELECT MAX(sortOrder) AS maxSort FROM expense_categories`, [], (maxErr, row) => {
                const nextSort = (row?.maxSort || 0) + 1;

                db.run(
                    `INSERT INTO expense_categories (categoryName, sortOrder) VALUES (?, ?)`,
                    [name, nextSort],
                    function (insertErr) {
                        if (insertErr) {
                            return res.status(500).json({ success: false, message: "Unable to create category." });
                        }

                        logAudit({
                            userId: req.user?.id || null,
                            action: "EXPENSE_CATEGORY_CREATED",
                            entityType: "expense_category",
                            entityId: this.lastID,
                            details: { name }
                        }).catch(() => {});

                        res.status(201).json({ success: true, id: this.lastID, message: "Category created." });
                    }
                );
            });
        }
    );
};

// UPDATE — admin only. Renaming a category also re-tags existing expenses so
// their history and filters stay consistent.
exports.updateExpenseCategory = (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.categoryName || "").trim();

    if (!id || id <= 0) {
        return res.status(400).json({ success: false, message: "Invalid category." });
    }
    if (!name) {
        return res.status(400).json({ success: false, message: "Category name is required." });
    }

    db.get(`SELECT categoryName FROM expense_categories WHERE id = ?`, [id], (findErr, current) => {
        if (findErr) {
            return res.status(500).json({ success: false, message: "Unable to load category." });
        }
        if (!current) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        db.get(
            `SELECT id FROM expense_categories WHERE id != ? AND LOWER(categoryName) = LOWER(?)`,
            [id, name],
            (dupErr, dup) => {
                if (dupErr) {
                    return res.status(500).json({ success: false, message: "Unable to check category." });
                }
                if (dup) {
                    return res.status(409).json({ success: false, message: "Another category with this name already exists." });
                }

                const oldName = current.categoryName;

                db.run(`UPDATE expense_categories SET categoryName = ? WHERE id = ?`, [name, id], (updErr) => {
                    if (updErr) {
                        return res.status(500).json({ success: false, message: "Unable to update category." });
                    }

                    // Keep existing expense rows pointing at the renamed category.
                    db.run(`UPDATE expenses SET category = ? WHERE category = ?`, [name, oldName], () => {
                        logAudit({
                            userId: req.user?.id || null,
                            action: "EXPENSE_CATEGORY_UPDATED",
                            entityType: "expense_category",
                            entityId: id,
                            details: { from: oldName, to: name }
                        }).catch(() => {});

                        res.json({ success: true, message: "Category updated." });
                    });
                });
            }
        );
    });
};

// DELETE — admin only. Refused if any expense still uses the category.
exports.deleteExpenseCategory = (req, res) => {
    const id = Number(req.params.id);

    if (!id || id <= 0) {
        return res.status(400).json({ success: false, message: "Invalid category." });
    }

    db.get(`SELECT categoryName FROM expense_categories WHERE id = ?`, [id], (findErr, current) => {
        if (findErr) {
            return res.status(500).json({ success: false, message: "Unable to load category." });
        }
        if (!current) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        db.get(`SELECT COUNT(*) AS c FROM expenses WHERE category = ?`, [current.categoryName], (countErr, row) => {
            if (countErr) {
                return res.status(500).json({ success: false, message: "Unable to check category usage." });
            }
            if (row && row.c > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Cannot delete "${current.categoryName}" — it is used by ${row.c} expense(s). Re-categorize those first.`
                });
            }

            db.run(`DELETE FROM expense_categories WHERE id = ?`, [id], (delErr) => {
                if (delErr) {
                    return res.status(500).json({ success: false, message: "Unable to delete category." });
                }

                logAudit({
                    userId: req.user?.id || null,
                    action: "EXPENSE_CATEGORY_DELETED",
                    entityType: "expense_category",
                    entityId: id,
                    details: { name: current.categoryName }
                }).catch(() => {});

                res.json({ success: true, message: "Category deleted." });
            });
        });
    });
};