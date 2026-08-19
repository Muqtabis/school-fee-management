const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        "JWT_SECRET is not configured in the environment."
    );
}


// =====================================================
// PUBLIC SIGNUP DISABLED
// =====================================================
// Kept only for compatibility with any old frontend
// code that might still call /auth/signup.
// New users must be created by an administrator.
// =====================================================

exports.signup = (req, res) => {

    return res.status(403).json({

        success: false,

        message:
            "Public signup is disabled. An administrator must create user accounts."

    });

};


// =====================================================
// LOGIN
// =====================================================

exports.login = (req, res) => {

    const {
        email,
        password
    } = req.body;


    if (!email || !password) {

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
        [normalizedEmail],
        async (err, user) => {

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
                // ONLY VALID APPLICATION ROLES
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
        [req.user.id],
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


            return res.json({

                success: true,

                user

            });

        }
    );

};