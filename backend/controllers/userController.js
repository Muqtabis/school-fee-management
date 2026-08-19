const bcrypt = require("bcryptjs");

const db = require("../db");

const logAudit =
    require("../utils/auditLogger");


// =====================================================
// GET USERS
// =====================================================

exports.getUsers = (
    req,
    res
) => {

    db.all(
        `
        SELECT
            id,
            name,
            email,
            role,
            createdAt
        FROM users
        ORDER BY id ASC
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
                        "Unable to load users."
                });

            }

            res.json(rows);

        }
    );

};


// =====================================================
// CREATE USER
// =====================================================

exports.createUser = async (
    req,
    res
) => {

    const {
        name,
        email,
        password,
        role
    } = req.body;


    if (
        !name ||
        !email ||
        !password
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Name, email and password are required."
        });

    }


    if (
        password.length < 6
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Password must contain at least 6 characters."
        });

    }


    if (
        !["admin", "receptionist"]
            .includes(role)
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Invalid user role."
        });

    }


    const normalizedEmail =
        String(email)
            .trim()
            .toLowerCase();


    db.get(
        `
        SELECT id
        FROM users
        WHERE email = ?
        `,
        [normalizedEmail],
        async (
            checkErr,
            existingUser
        ) => {

            if (checkErr) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check email."
                });

            }


            if (existingUser) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Email already registered."
                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );


            db.run(
                `
                INSERT INTO users
                (
                    name,
                    email,
                    password,
                    role
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    name.trim(),
                    normalizedEmail,
                    hashedPassword,
                    role
                ],
                function (
                    err
                ) {

                    if (err) {

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to create user."
                        });

                    }


                    const userId =
                        this.lastID;


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "USER_CREATED",

                        entityType:
                            "user",

                        entityId:
                            userId,

                        details: {

                            name:
                                name.trim(),

                            email:
                                normalizedEmail,

                            role

                        }

                    })
                        .then(() => {

                            res.status(201).json({

                                success: true,

                                message:
                                    "User created successfully.",

                                id:
                                    userId

                            });

                        });

                }
            );

        }
    );

};


// =====================================================
// CHANGE USER ROLE
// =====================================================

exports.changeRole = (
    req,
    res
) => {

    const userId =
        Number(
            req.params.id
        );

    const {
        role
    } = req.body;


    if (
        !["admin", "receptionist"]
            .includes(role)
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Invalid user role."
        });

    }


    if (
        userId ===
        req.user.id
    ) {

        return res.status(400).json({
            success: false,
            message:
                "You cannot change your own role."
        });

    }


    db.get(
        `
        SELECT id, name, email, role
        FROM users
        WHERE id = ?
        `,
        [userId],
        (
            err,
            user
        ) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find user."
                });

            }


            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User not found."
                });

            }


            db.run(
                `
                UPDATE users
                SET role = ?
                WHERE id = ?
                `,
                [
                    role,
                    userId
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to update role."
                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "USER_ROLE_CHANGED",

                        entityType:
                            "user",

                        entityId:
                            userId,

                        details: {

                            oldRole:
                                user.role,

                            newRole:
                                role

                        }

                    })
                        .then(() => {

                            res.json({

                                success: true,

                                message:
                                    "User role updated."

                            });

                        });

                }
            );

        }
    );

};