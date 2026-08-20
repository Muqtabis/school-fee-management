const bcrypt = require("bcryptjs");

const db = require("../db");

const logAudit =
    require("../utils/auditLogger");


// =====================================================
// GET USERS
// ADMIN ONLY
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

                console.error(
                    "Get Users Error:",
                    err
                );

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
// CREATE RECEPTIONIST
// ADMIN ONLY
// =====================================================

exports.createUser = async (
    req,
    res
) => {

    const {
        name,
        email,
        password
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
        password.length < 8
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Password must contain at least 8 characters."
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

                console.error(
                    "Check User Error:",
                    checkErr
                );

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


            try {

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
                        "receptionist"
                    ],
                    function (
                        err
                    ) {

                        if (err) {

                            console.error(
                                "Create User Error:",
                                err
                            );

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

                                role:
                                    "receptionist"

                            }

                        })
                            .then(() => {

                                res.status(201).json({

                                    success: true,

                                    message:
                                        "Receptionist created successfully.",

                                    id:
                                        userId

                                });

                            })
                            .catch(
                                auditError => {

                                    console.error(
                                        "Audit Error:",
                                        auditError
                                    );

                                    res.status(201).json({

                                        success: true,

                                        message:
                                            "Receptionist created successfully.",

                                        id:
                                            userId

                                    });

                                }
                            );

                    }
                );

            } catch (error) {

                console.error(
                    "Password Hash Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create user."
                });

            }

        }
    );

};


// =====================================================
// RESET RECEPTIONIST PASSWORD
// ADMIN ONLY
// =====================================================

exports.resetPassword = async (
    req,
    res
) => {

    const userId =
        Number(
            req.params.id
        );


    if (
        !Number.isInteger(userId)
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Invalid user ID."
        });

    }


    const {
        password
    } = req.body;


    if (
        !password
    ) {

        return res.status(400).json({
            success: false,
            message:
                "New password is required."
        });

    }


    if (
        password.length < 8
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Password must contain at least 8 characters."
        });

    }


    db.get(
        `
        SELECT
            id,
            name,
            email,
            role
        FROM users
        WHERE id = ?
        `,
        [userId],
        async (
            err,
            user
        ) => {

            if (err) {

                console.error(
                    "Find User Error:",
                    err
                );

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


            // Admin cannot use this endpoint
            // to reset another admin's password.

            if (
                user.role !== "receptionist"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only receptionist passwords can be reset here."
                });

            }


            try {

                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        12
                    );


                db.run(
                    `
                    UPDATE users
                    SET password = ?
                    WHERE id = ?
                    `,
                    [
                        hashedPassword,
                        userId
                    ],
                    function (
                        updateErr
                    ) {

                        if (updateErr) {

                            console.error(
                                "Reset Password Error:",
                                updateErr
                            );

                            return res.status(500).json({
                                success: false,
                                message:
                                    "Unable to reset password."
                            });

                        }


                        logAudit({

                            userId:
                                req.user.id,

                            action:
                                "USER_PASSWORD_RESET",

                            entityType:
                                "user",

                            entityId:
                                userId,

                            details: {

                                email:
                                    user.email,

                                role:
                                    user.role

                            }

                        })
                            .then(() => {

                                res.json({

                                    success: true,

                                    message:
                                        "Receptionist password reset successfully."

                                });

                            })
                            .catch(
                                auditError => {

                                    console.error(
                                        "Audit Error:",
                                        auditError
                                    );

                                    res.json({

                                        success: true,

                                        message:
                                            "Receptionist password reset successfully."

                                    });

                                }
                            );

                    }
                );

            } catch (error) {

                console.error(
                    "Password Hash Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reset password."
                });

            }

        }
    );

};


// =====================================================
// DELETE RECEPTIONIST
// ADMIN ONLY
// =====================================================

exports.deleteUser = (
    req,
    res
) => {

    const userId =
        Number(
            req.params.id
        );


    if (
        !Number.isInteger(userId)
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Invalid user ID."
        });

    }


    if (
        userId ===
        req.user.id
    ) {

        return res.status(400).json({
            success: false,
            message:
                "You cannot delete your own account."
        });

    }


    db.get(
        `
        SELECT
            id,
            name,
            email,
            role
        FROM users
        WHERE id = ?
        `,
        [userId],
        (
            err,
            user
        ) => {

            if (err) {

                console.error(
                    "Find User Error:",
                    err
                );

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


            // Only receptionist accounts
            // can be deleted from Users page.

            if (
                user.role !== "receptionist"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only receptionist accounts can be deleted."
                });

            }


            db.run(
                `
                DELETE FROM users
                WHERE id = ?
                `,
                [userId],
                function (
                    deleteErr
                ) {

                    if (deleteErr) {

                        console.error(
                            "Delete User Error:",
                            deleteErr
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to delete user."
                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "USER_DELETED",

                        entityType:
                            "user",

                        entityId:
                            userId,

                        details: {

                            name:
                                user.name,

                            email:
                                user.email,

                            role:
                                user.role

                        }

                    })
                        .then(() => {

                            res.json({

                                success: true,

                                message:
                                    "Receptionist deleted successfully."

                            });

                        })
                        .catch(
                            auditError => {

                                console.error(
                                    "Audit Error:",
                                    auditError
                                );

                                res.json({

                                    success: true,

                                    message:
                                        "Receptionist deleted successfully."

                                });

                            }
                        );

                }
            );

        }
    );

};


// =====================================================
// CHANGE OWN PASSWORD
// ADMIN / LOGGED-IN USER
// =====================================================

exports.changeOwnPassword = async (
    req,
    res
) => {

    const {
        currentPassword,
        newPassword
    } = req.body;


    if (
        !currentPassword ||
        !newPassword
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Current password and new password are required."
        });

    }


    if (
        newPassword.length < 8
    ) {

        return res.status(400).json({
            success: false,
            message:
                "New password must contain at least 8 characters."
        });

    }


    db.get(
        `
        SELECT
            id,
            password,
            role
        FROM users
        WHERE id = ?
        `,
        [req.user.id],
        async (
            err,
            user
        ) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load account."
                });

            }


            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "User account not found."
                });

            }


            try {

                const validPassword =
                    await bcrypt.compare(
                        currentPassword,
                        user.password
                    );


                if (!validPassword) {

                    return res.status(401).json({
                        success: false,
                        message:
                            "Current password is incorrect."
                    });

                }


                const hashedPassword =
                    await bcrypt.hash(
                        newPassword,
                        12
                    );


                db.run(
                    `
                    UPDATE users
                    SET password = ?
                    WHERE id = ?
                    `,
                    [
                        hashedPassword,
                        req.user.id
                    ],
                    function (
                        updateErr
                    ) {

                        if (updateErr) {

                            return res.status(500).json({
                                success: false,
                                message:
                                    "Unable to change password."
                            });

                        }


                        logAudit({

                            userId:
                                req.user.id,

                            action:
                                "PASSWORD_CHANGED",

                            entityType:
                                "user",

                            entityId:
                                req.user.id,

                            details: {

                                role:
                                    user.role

                            }

                        })
                            .then(() => {

                                res.json({

                                    success: true,

                                    message:
                                        "Password changed successfully."

                                });

                            })
                            .catch(
                                () => {

                                    res.json({

                                        success: true,

                                        message:
                                            "Password changed successfully."

                                    });

                                }
                            );

                    }
                );

            } catch (error) {

                console.error(
                    "Change Password Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to change password."
                });

            }

        }
    );

};