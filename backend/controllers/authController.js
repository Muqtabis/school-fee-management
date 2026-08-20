const bcrypt =
    require("bcryptjs");

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

const db =
    require("../db");

const sendPasswordResetEmail =
    require("../utils/emailService");

const logAudit =
    require("../utils/auditLogger");


// =====================================================
// JWT SECRET
// =====================================================

const JWT_SECRET =
    process.env.JWT_SECRET;


if (!JWT_SECRET) {

    throw new Error(
        "JWT_SECRET is not configured in the environment."
    );

}


// =====================================================
// PUBLIC SIGNUP DISABLED
// =====================================================

exports.signup = (
    req,
    res
) => {

    return res.status(403).json({

        success: false,

        message:
            "Public signup is disabled. An administrator must create user accounts."

    });

};


// =====================================================
// LOGIN
// =====================================================

exports.login = (
    req,
    res
) => {

    const {
        email,
        password
    } = req.body;


    if (
        !email ||
        !password
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Email and password are required."

        });

    }


    const normalizedEmail =
        String(email)
            .trim()
            .toLowerCase();


    db.get(
        `
        SELECT
            id,
            name,
            email,
            password,
            role
        FROM users
        WHERE email = ?
        `,
        [
            normalizedEmail
        ],
        async (
            err,
            user
        ) => {

            if (err) {

                console.error(
                    "Login DB Error:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to login."

                });

            }


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid email or password."

                });

            }


            try {

                const validPassword =
                    await bcrypt.compare(
                        password,
                        user.password
                    );


                if (!validPassword) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "Invalid email or password."

                    });

                }


                // =================================================
                // VALID APPLICATION ROLES
                // =================================================

                if (
                    user.role !== "admin" &&
                    user.role !== "receptionist"
                ) {

                    return res.status(403).json({

                        success: false,

                        message:
                            "This account has an invalid role."

                    });

                }


                // =================================================
                // JWT
                // =================================================

                const token =
                    jwt.sign(
                        {
                            id:
                                user.id,

                            email:
                                user.email,

                            role:
                                user.role
                        },

                        JWT_SECRET,

                        {
                            expiresIn:
                                "7d"
                        }
                    );


                return res.json({

                    success: true,

                    token,

                    user: {

                        id:
                            user.id,

                        name:
                            user.name,

                        email:
                            user.email,

                        role:
                            user.role

                    }

                });


            } catch (error) {

                console.error(
                    "Login Error:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to login."

                });

            }

        }
    );

};


// =====================================================
// PROFILE
// =====================================================

exports.profile = (
    req,
    res
) => {

    db.get(
        `
        SELECT
            id,
            name,
            email,
            role,
            createdAt
        FROM users
        WHERE id = ?
        `,
        [
            req.user.id
        ],
        (
            err,
            user
        ) => {

            if (err) {

                console.error(
                    "Profile DB Error:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to load profile."

                });

            }


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User account no longer exists."

                });

            }


            // =================================================
            // PROTECT AGAINST INVALID DATABASE ROLE
            // =================================================

            if (
                user.role !== "admin" &&
                user.role !== "receptionist"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "This account has an invalid role."

                });

            }


            return res.json({

                success: true,

                user

            });

        }
    );

};


// =====================================================
// FORGOT PASSWORD
// ADMIN ONLY
// =====================================================

exports.forgotPassword = (
    req,
    res
) => {

    const {
        email
    } = req.body;


    if (!email) {

        return res.status(400).json({

            success: false,

            message:
                "Email is required."

        });

    }


    const normalizedEmail =
        String(email)
            .trim()
            .toLowerCase();


    // =================================================
    // IMPORTANT
    // Always return the same response.
    //
    // This prevents someone from checking which
    // emails are registered in the ERP.
    // =================================================

    const genericMessage =
        "If an administrator account exists for this email, a password reset link has been sent.";


    db.get(
        `
        SELECT
            id,
            name,
            email,
            role
        FROM users
        WHERE email = ?
        `,
        [
            normalizedEmail
        ],
        async (
            err,
            user
        ) => {

            if (err) {

                console.error(
                    "Forgot Password DB Error:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to process password reset."

                });

            }


            if (!user) {

                return res.json({

                    success: true,

                    message:
                        genericMessage

                });

            }


            // =================================================
            // ONLY ADMIN CAN USE EMAIL RESET
            // =================================================

            if (
                user.role !== "admin"
            ) {

                return res.json({

                    success: true,

                    message:
                        genericMessage

                });

            }


            try {

                // =================================================
                // REMOVE OLD RESET TOKENS
                // =================================================

                await new Promise(
                    (
                        resolve,
                        reject
                    ) => {

                        db.run(
                            `
                            DELETE FROM password_reset_tokens
                            WHERE userId = ?
                            `,
                            [
                                user.id
                            ],
                            (
                                deleteErr
                            ) => {

                                if (
                                    deleteErr
                                ) {

                                    reject(
                                        deleteErr
                                    );

                                    return;

                                }

                                resolve();

                            }
                        );

                    }
                );


                // =================================================
                // GENERATE SECURE TOKEN
                // =================================================

                const rawToken =
                    crypto
                        .randomBytes(
                            32
                        )
                        .toString(
                            "hex"
                        );


                // =================================================
                // HASH TOKEN BEFORE DATABASE STORAGE
                // =================================================

                const tokenHash =
                    crypto
                        .createHash(
                            "sha256"
                        )
                        .update(
                            rawToken
                        )
                        .digest(
                            "hex"
                        );


                // =================================================
                // 15 MINUTE EXPIRATION
                // =================================================

                const expiresAt =
                    new Date(
                        Date.now() +
                        15 * 60 * 1000
                    ).toISOString();


                // =================================================
                // STORE TOKEN HASH
                // =================================================

                await new Promise(
                    (
                        resolve,
                        reject
                    ) => {

                        db.run(
                            `
                            INSERT INTO password_reset_tokens
                            (
                                userId,
                                tokenHash,
                                expiresAt
                            )
                            VALUES (?, ?, ?)
                            `,
                            [
                                user.id,
                                tokenHash,
                                expiresAt
                            ],
                            (
                                insertErr
                            ) => {

                                if (
                                    insertErr
                                ) {

                                    reject(
                                        insertErr
                                    );

                                    return;

                                }

                                resolve();

                            }
                        );

                    }
                );


                // =================================================
                // RESET URL
                // =================================================

                const frontendUrl =
                    process.env.FRONTEND_URL ||
                    "http://localhost:3000";


                const resetUrl =
                    `${frontendUrl}/reset-password/${rawToken}`;


                // =================================================
                // SEND EMAIL
                // =================================================

                await sendPasswordResetEmail(
                    user.email,
                    resetUrl
                );


                // =================================================
                // AUDIT LOG
                // =================================================

                await logAudit({

                    userId:
                        user.id,

                    action:
                        "PASSWORD_RESET_REQUESTED",

                    entityType:
                        "user",

                    entityId:
                        user.id,

                    details: {

                        email:
                            user.email

                    }

                });


                return res.json({

                    success: true,

                    message:
                        genericMessage

                });


            } catch (error) {

                console.error(
                    "Forgot Password Error:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to send password reset email."

                });

            }

        }
    );

};


// =====================================================
// RESET PASSWORD
// ADMIN ONLY
// =====================================================

exports.resetPassword = (
    req,
    res
) => {

    const {
        token
    } = req.params;


    const {
        password
    } = req.body;


    if (!token) {

        return res.status(400).json({

            success: false,

            message:
                "Reset token is required."

        });

    }


    if (!password) {

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


    const tokenHash =
        crypto
            .createHash(
                "sha256"
            )
            .update(
                token
            )
            .digest(
                "hex"
            );


    db.get(
        `
        SELECT
            id,
            userId,
            expiresAt,
            usedAt
        FROM password_reset_tokens
        WHERE tokenHash = ?
        `,
        [
            tokenHash
        ],
        async (
            err,
            resetToken
        ) => {

            if (err) {

                console.error(
                    "Reset Token DB Error:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to reset password."

                });

            }


            if (!resetToken) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid or expired reset link."

                });

            }


            if (
                resetToken.usedAt
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This reset link has already been used."

                });

            }


            if (
                new Date(
                    resetToken.expiresAt
                ) < new Date()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This reset link has expired."

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
                [
                    resetToken.userId
                ],
                async (
                    userErr,
                    user
                ) => {

                    if (userErr) {

                        console.error(
                            "Reset User DB Error:",
                            userErr
                        );

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


                    // =================================================
                    // ONLY ADMIN
                    // =================================================

                    if (
                        user.role !== "admin"
                    ) {

                        return res.status(403).json({

                            success: false,

                            message:
                                "Password reset is not available for this account."

                        });

                    }


                    try {

                        const hashedPassword =
                            await bcrypt.hash(
                                password,
                                12
                            );


                        // =================================================
                        // UPDATE PASSWORD
                        // =================================================

                        db.run(
                            `
                            UPDATE users
                            SET password = ?
                            WHERE id = ?
                            `,
                            [
                                hashedPassword,
                                user.id
                            ],
                            async (
                                updateErr
                            ) => {

                                if (
                                    updateErr
                                ) {

                                    console.error(
                                        "Reset Password Update Error:",
                                        updateErr
                                    );

                                    return res.status(500).json({

                                        success: false,

                                        message:
                                            "Unable to reset password."

                                    });

                                }


                                // =================================================
                                // MARK TOKEN USED
                                // =================================================

                                db.run(
                                    `
                                    UPDATE password_reset_tokens
                                    SET usedAt = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                    `,
                                    [
                                        resetToken.id
                                    ],
                                    async (
                                        tokenErr
                                    ) => {

                                        if (
                                            tokenErr
                                        ) {

                                            console.error(
                                                "Token Update Error:",
                                                tokenErr
                                            );

                                        }


                                        // =================================================
                                        // AUDIT LOG
                                        // =================================================

                                        try {

                                            await logAudit({

                                                userId:
                                                    user.id,

                                                action:
                                                    "PASSWORD_RESET_COMPLETED",

                                                entityType:
                                                    "user",

                                                entityId:
                                                    user.id,

                                                details: {

                                                    email:
                                                        user.email

                                                }

                                            });

                                        } catch (
                                            auditError
                                        ) {

                                            console.error(
                                                "Password Reset Audit Error:",
                                                auditError
                                            );

                                        }


                                        return res.json({

                                            success: true,

                                            message:
                                                "Password reset successfully."

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

        }
    );

};