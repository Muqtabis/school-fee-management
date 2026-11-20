const db =
    require("../db");

const logAudit =
    require("../utils/auditLogger");


// =====================================================
// INCOMES
//
// Non-fee money coming INTO the school (donations, grants,
// event collections, old-dues recoveries ...). Built as an
// exact mirror of the Expenses feature: dynamic admin-managed
// categories (NO hardcoded defaults for incomes), reversal
// instead of deletion, and audit logging. Active (non-reversed)
// incomes are added to the Net Balance on the dashboard.
// =====================================================

const activeIncomeCondition = `
    (
        status IS NULL
        OR status != 'reversed'
    )
`;


// =====================================================
// GET ALL INCOMES
// Same filter surface as expenses: category, search,
// date range, and an optional LIMIT for dashboard slices.
// =====================================================

exports.getIncomes = (
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
        FROM incomes
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
                incomeName LIKE ?
                OR receivedFrom LIKE ?
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
            AND incomeDate >= ?
        `;

        params.push(
            startDate
        );

    }


    if (endDate) {

        query += `
            AND incomeDate <= ?
        `;

        params.push(
            endDate
        );

    }


    query += `
        ORDER BY
            incomeDate DESC,
            id DESC
    `;


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
                        "Unable to fetch incomes."

                });

            }


            res.json(rows);

        }
    );

};


// =====================================================
// GET SINGLE
// =====================================================

exports.getIncome = (
    req,
    res
) => {

    db.get(
        `
        SELECT *
        FROM incomes
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
                        "Unable to fetch income."

                });

            }


            if (!row) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Income not found."

                });

            }


            res.json(row);

        }
    );

};


// =====================================================
// ADD INCOME
// =====================================================

exports.addIncome = (
    req,
    res
) => {

    const {
        incomeName,
        category,
        amount,
        incomeDate,
        paymentMode,
        receivedFrom,
        description
    } = req.body;


    const numericAmount =
        Number(amount);


    if (
        !incomeName ||
        !category ||
        !incomeDate ||
        !paymentMode ||
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter valid income details."

        });

    }


    db.run(
        `
        INSERT INTO incomes
        (
            incomeName,
            category,
            amount,
            incomeDate,
            paymentMode,
            receivedFrom,
            description,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        `,
        [
            String(
                incomeName
            ).trim(),

            category,

            numericAmount,

            incomeDate,

            paymentMode,

            receivedFrom
                ? String(
                    receivedFrom
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
                        "Unable to add income."

                });

            }


            const incomeId =
                this.lastID;


            logAudit({

                userId:
                    req.user.id,

                action:
                    "INCOME_CREATED",

                entityType:
                    "income",

                entityId:
                    incomeId,

                details: {

                    incomeName,

                    category,

                    amount:
                        numericAmount,

                    incomeDate,

                    paymentMode

                }

            }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                res.status(201).json({

                    success: true,

                    id:
                        incomeId,

                    message:
                        "Income added successfully."

                });

            });

        }
    );

};


// =====================================================
// UPDATE INCOME
// =====================================================

exports.updateIncome = (
    req,
    res
) => {

    const {
        incomeName,
        category,
        amount,
        incomeDate,
        paymentMode,
        receivedFrom,
        description
    } = req.body;


    const numericAmount =
        Number(amount);


    if (
        !incomeName ||
        !category ||
        !incomeDate ||
        !paymentMode ||
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter valid income details."

        });

    }


    db.get(
        `
        SELECT *
        FROM incomes
        WHERE id = ?
        `,
        [
            req.params.id
        ],
        (
            findErr,
            income
        ) => {

            if (findErr) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find income."

                });

            }


            if (!income) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Income not found."

                });

            }


            if (
                income.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Reversed incomes cannot be edited."

                });

            }


            if (
                Number(income.editCount || 0) >= 1
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This income has already been edited once."

                });

            }


            db.run(
                `
                UPDATE incomes

                SET
                    incomeName = ?,
                    category = ?,
                    amount = ?,
                    incomeDate = ?,
                    paymentMode = ?,
                    receivedFrom = ?,
                    description = ?,
                    editCount = COALESCE(editCount, 0) + 1

                WHERE id = ?
                `,
                [
                    String(
                        incomeName
                    ).trim(),

                    category,

                    numericAmount,

                    incomeDate,

                    paymentMode,

                    receivedFrom
                        ? String(
                            receivedFrom
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
                                "Unable to update income."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "INCOME_UPDATED",

                        entityType:
                            "income",

                        entityId:
                            Number(
                                req.params.id
                            ),

                        details: {

                            incomeName,

                            category,

                            amount:
                                numericAmount

                        }

                    }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                        res.json({

                            success: true,

                            message:
                                "Income updated successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// REVERSE INCOME
// =====================================================

exports.reverseIncome = (
    req,
    res
) => {

    const incomeId =
        Number(
            req.params.id
        );


    const reason =
        String(
            req.body?.reason || ""
        ).trim();


    if (
        !incomeId ||
        incomeId <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid income ID."

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
        FROM incomes
        WHERE id = ?
        `,
        [
            incomeId
        ],
        (
            err,
            income
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find income."

                });

            }


            if (!income) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Income not found."

                });

            }


            if (
                income.status ===
                "reversed"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This income has already been reversed."

                });

            }


            const voidedAt =
                new Date().toISOString();


            db.run(
                `
                UPDATE incomes

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
                    incomeId
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to reverse income."

                        });

                    }


                    if (
                        this.changes ===
                        0
                    ) {

                        return res.status(409).json({

                            success: false,

                            message:
                                "Income could not be reversed."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "INCOME_REVERSED",

                        entityType:
                            "income",

                        entityId:
                            incomeId,

                        details: {

                            incomeName:
                                income.incomeName,

                            amount:
                                income.amount,

                            category:
                                income.category,

                            reason,

                            reversedAt:
                                voidedAt

                        }

                    }).catch((auditErr) => console.error("Audit log failed:", auditErr)).finally(() => {

                        res.json({

                            success: true,

                            message:
                                "Income reversed successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// INCOME SUMMARY
// =====================================================

exports.incomeSummary = (
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

            COUNT(*) AS totalIncomes

        FROM incomes

        WHERE ${activeIncomeCondition}
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
                        "Unable to calculate income summary."

                });

            }


            db.get(
                `
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total

                FROM incomes

                WHERE ${activeIncomeCondition}

                AND strftime(
                    '%Y-%m',
                    incomeDate
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
                                "Unable to calculate monthly income."

                        });

                    }


                    db.get(
                        `
                        SELECT
                            COALESCE(
                                SUM(amount),
                                0
                            ) AS total

                        FROM incomes

                        WHERE ${activeIncomeCondition}

                        AND strftime(
                            '%Y',
                            incomeDate
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
                                        "Unable to calculate yearly income."

                                });

                            }


                            res.json({

                                totalIncomeAmount:
                                    Number(
                                        summary.totalAmount ||
                                        0
                                    ),

                                totalIncomes:
                                    Number(
                                        summary.totalIncomes ||
                                        0
                                    ),

                                monthlyIncomes:
                                    Number(
                                        month.total ||
                                        0
                                    ),

                                yearlyIncomes:
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

exports.deleteIncome = (
    req,
    res
) => {

    return res.status(405).json({

        success: false,

        message:
            "Incomes cannot be permanently deleted. Use reversal instead."

    });

};


// =====================================================
// INCOME CATEGORIES (dynamic, admin-managed)
// Deliberately NOT seeded — the admin creates every income
// category manually, exactly as they want it.
// =====================================================

// LIST — available to staff for the dropdowns.
exports.getIncomeCategories = (req, res) => {
    db.all(
        `SELECT id, categoryName, sortOrder FROM income_categories ORDER BY sortOrder ASC, categoryName ASC`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Unable to load income categories." });
            }
            res.json(rows || []);
        }
    );
};

// CREATE — admin only.
exports.createIncomeCategory = (req, res) => {
    const name = String(req.body?.categoryName || "").trim();

    if (!name) {
        return res.status(400).json({ success: false, message: "Category name is required." });
    }

    db.get(
        `SELECT id FROM income_categories WHERE LOWER(categoryName) = LOWER(?)`,
        [name],
        (findErr, existing) => {
            if (findErr) {
                return res.status(500).json({ success: false, message: "Unable to check category." });
            }
            if (existing) {
                return res.status(409).json({ success: false, message: "This category already exists." });
            }

            db.get(`SELECT MAX(sortOrder) AS maxSort FROM income_categories`, [], (maxErr, row) => {
                const nextSort = (row?.maxSort || 0) + 1;

                db.run(
                    `INSERT INTO income_categories (categoryName, sortOrder) VALUES (?, ?)`,
                    [name, nextSort],
                    function (insertErr) {
                        if (insertErr) {
                            return res.status(500).json({ success: false, message: "Unable to create category." });
                        }

                        logAudit({
                            userId: req.user?.id || null,
                            action: "INCOME_CATEGORY_CREATED",
                            entityType: "income_category",
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

// UPDATE — admin only. Renaming a category also re-tags existing incomes so
// their history and filters stay consistent.
exports.updateIncomeCategory = (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.categoryName || "").trim();

    if (!id || id <= 0) {
        return res.status(400).json({ success: false, message: "Invalid category." });
    }
    if (!name) {
        return res.status(400).json({ success: false, message: "Category name is required." });
    }

    db.get(`SELECT categoryName FROM income_categories WHERE id = ?`, [id], (findErr, current) => {
        if (findErr) {
            return res.status(500).json({ success: false, message: "Unable to load category." });
        }
        if (!current) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        db.get(
            `SELECT id FROM income_categories WHERE id != ? AND LOWER(categoryName) = LOWER(?)`,
            [id, name],
            (dupErr, dup) => {
                if (dupErr) {
                    return res.status(500).json({ success: false, message: "Unable to check category." });
                }
                if (dup) {
                    return res.status(409).json({ success: false, message: "Another category with this name already exists." });
                }

                const oldName = current.categoryName;

                db.run(`UPDATE income_categories SET categoryName = ? WHERE id = ?`, [name, id], (updErr) => {
                    if (updErr) {
                        return res.status(500).json({ success: false, message: "Unable to update category." });
                    }

                    // Keep existing income rows pointing at the renamed category.
                    db.run(`UPDATE incomes SET category = ? WHERE category = ?`, [name, oldName], () => {
                        logAudit({
                            userId: req.user?.id || null,
                            action: "INCOME_CATEGORY_UPDATED",
                            entityType: "income_category",
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

// DELETE — admin only. Refused if any income still uses the category.
exports.deleteIncomeCategory = (req, res) => {
    const id = Number(req.params.id);

    if (!id || id <= 0) {
        return res.status(400).json({ success: false, message: "Invalid category." });
    }

    db.get(`SELECT categoryName FROM income_categories WHERE id = ?`, [id], (findErr, current) => {
        if (findErr) {
            return res.status(500).json({ success: false, message: "Unable to load category." });
        }
        if (!current) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        db.get(`SELECT COUNT(*) AS c FROM incomes WHERE category = ?`, [current.categoryName], (countErr, row) => {
            if (countErr) {
                return res.status(500).json({ success: false, message: "Unable to check category usage." });
            }
            if (row && row.c > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Cannot delete "${current.categoryName}" — it is used by ${row.c} income(s). Re-categorize those first.`
                });
            }

            db.run(`DELETE FROM income_categories WHERE id = ?`, [id], (delErr) => {
                if (delErr) {
                    return res.status(500).json({ success: false, message: "Unable to delete category." });
                }

                logAudit({
                    userId: req.user?.id || null,
                    action: "INCOME_CATEGORY_DELETED",
                    entityType: "income_category",
                    entityId: id,
                    details: { name: current.categoryName }
                }).catch(() => {});

                res.json({ success: true, message: "Category deleted." });
            });
        });
    });
};
