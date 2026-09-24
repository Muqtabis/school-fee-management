const bcrypt = require("bcryptjs");

const db = require("../db");

const { runQuery, allQuery } = require("../db");

const { PAGES, isValidPageKey, grantablePagesForRole } = require("../config/pages");

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
            accessLocked,
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
        password.length < 8
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Password must contain at least 8 characters."
        });

    }


    // Admin may create receptionist or teacher accounts.
    // Absent role defaults to receptionist for backward compatibility
    // with the old create flow (which sent no role). An explicitly
    // supplied role that isn't allowed is rejected rather than silently
    // coerced, so callers aren't surprised by the account they got.
    const allowedRoles = ["receptionist", "teacher"];
    if (role !== undefined && role !== null && String(role).trim() !== "" &&
        !allowedRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}.`
        });
    }
    const newRole = allowedRoles.includes(role) ? role : "receptionist";


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
                        newRole
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


                        const roleLabel =
                            newRole === "teacher"
                                ? "Teacher"
                                : "Receptionist";


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
                                    newRole

                            }

                        })
                            .then(() => {

                                res.status(201).json({

                                    success: true,

                                    message:
                                        `${roleLabel} created successfully.`,

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
                                            `${roleLabel} created successfully.`,

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
                user.role !== "receptionist" &&
                user.role !== "teacher"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only receptionist or teacher passwords can be reset here."
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


            // Only receptionist and teacher accounts
            // can be deleted from Users page.

            if (
                user.role !== "receptionist" &&
                user.role !== "teacher"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only receptionist or teacher accounts can be deleted."
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


// =====================================================
// GET PAGE REGISTRY
// ADMIN ONLY
//
// The master list of pages admin can assign.
// =====================================================

exports.getPageRegistry = (req, res) => {

    res.json({
        success: true,
        pages: PAGES
    });

};


// =====================================================
// GET A USER'S PAGE ACCESS
// ADMIN ONLY
// =====================================================

exports.getUserPages = async (req, res) => {

    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID."
        });
    }

    try {

        const user = await allQuery(
            `SELECT id, role, accessLocked FROM users WHERE id = ?`,
            [userId]
        );

        if (!user || user.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const rows = await allQuery(
            `SELECT pageKey FROM user_page_access WHERE userId = ?`,
            [userId]
        );

        res.json({
            success: true,
            role: user[0].role,
            accessLocked: user[0].accessLocked === 1,
            pageKeys: rows.map((row) => row.pageKey),
            // Only these page keys make sense for this user's role; the admin
            // checklist renders from this so it can't grant a page the role's
            // API would reject.
            grantablePageKeys: grantablePagesForRole(user[0].role)
        });

    } catch (error) {

        console.error("Get User Pages Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load page access."
        });

    }

};


// =====================================================
// SET A USER'S PAGE ACCESS
// ADMIN ONLY
//
// Replaces the user's access set with the provided
// list of page keys. Blocked if the account is an
// admin (always full access) or currently locked.
// =====================================================

exports.setUserPages = async (req, res) => {

    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID."
        });
    }

    const { pageKeys } = req.body;

    if (!Array.isArray(pageKeys)) {
        return res.status(400).json({
            success: false,
            message: "pageKeys must be an array."
        });
    }

    // Reject any unknown page key so the table never
    // holds phantom permissions that nothing checks.
    const invalid = pageKeys.filter((key) => !isValidPageKey(key));

    if (invalid.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Unknown page keys: ${invalid.join(", ")}`
        });
    }

    // De-duplicate.
    const uniqueKeys = [...new Set(pageKeys)];

    try {

        const users = await allQuery(
            `SELECT id, name, role, accessLocked FROM users WHERE id = ?`,
            [userId]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = users[0];

        if (user.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin accounts always have full access and cannot be edited."
            });
        }

        if (user.accessLocked === 1) {
            return res.status(409).json({
                success: false,
                message: "This user's access is locked. Unlock it before making changes."
            });
        }

        // Reject pages this role's API cannot serve, so we never grant a page
        // that would 403 the moment the user opens it.
        const grantable = grantablePagesForRole(user.role);
        const notForRole = uniqueKeys.filter((key) => !grantable.includes(key));

        if (notForRole.length > 0) {
            return res.status(400).json({
                success: false,
                message: `These pages are not available for a ${user.role}: ${notForRole.join(", ")}`
            });
        }

        // Replace the access set.
        await runQuery(
            `DELETE FROM user_page_access WHERE userId = ?`,
            [userId]
        );

        for (const key of uniqueKeys) {
            await runQuery(
                `INSERT INTO user_page_access (userId, pageKey) VALUES (?, ?)`,
                [userId, key]
            );
        }

        await logAudit({
            userId: req.user.id,
            action: "USER_PAGE_ACCESS_UPDATED",
            entityType: "user",
            entityId: userId,
            details: {
                name: user.name,
                role: user.role,
                pageKeys: uniqueKeys
            }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            message: "Page access updated successfully.",
            pageKeys: uniqueKeys
        });

    } catch (error) {

        console.error("Set User Pages Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update page access."
        });

    }

};


// =====================================================
// LOCK / UNLOCK A USER'S PAGE ACCESS
// ADMIN ONLY
// =====================================================

const setAccessLock = (locked) => async (req, res) => {

    const userId = Number(req.params.id);

    if (!Number.isInteger(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID."
        });
    }

    try {

        const users = await allQuery(
            `SELECT id, name, role FROM users WHERE id = ?`,
            [userId]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (users[0].role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access cannot be locked or unlocked."
            });
        }

        await runQuery(
            `UPDATE users SET accessLocked = ? WHERE id = ?`,
            [locked ? 1 : 0, userId]
        );

        await logAudit({
            userId: req.user.id,
            action: locked ? "USER_ACCESS_LOCKED" : "USER_ACCESS_UNLOCKED",
            entityType: "user",
            entityId: userId,
            details: { name: users[0].name, role: users[0].role }
        }).catch((e) => console.error("Audit Error:", e));

        res.json({
            success: true,
            message: locked
                ? "Page access locked."
                : "Page access unlocked."
        });

    } catch (error) {

        console.error("Set Access Lock Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update lock state."
        });

    }

};

exports.lockUserAccess = setAccessLock(true);

exports.unlockUserAccess = setAccessLock(false);


// =====================================================
// GET MY OWN PAGE ACCESS
// ANY AUTHENTICATED USER
//
// The frontend loads this at login to build the
// sidebar and gate routes.
// =====================================================

exports.getMyPages = async (req, res) => {

    try {

        // Admin always sees everything.
        if (req.user.role === "admin") {
            return res.json({
                success: true,
                pageKeys: PAGES.map((page) => page.key)
            });
        }

        const rows = await allQuery(
            `SELECT pageKey FROM user_page_access WHERE userId = ?`,
            [req.user.id]
        );

        const pageKeys = rows.map((row) => row.pageKey);

        // Every teacher gets a read-only view of their own
        // attendance, with no admin grant required. This page
        // is intentionally kept out of the assignable registry.
        if (req.user.role === "teacher" && !pageKeys.includes("my_attendance")) {
            pageKeys.push("my_attendance");
        }

        // Every teacher also gets the Settings page (self-service
        // profile + change-own-password), no admin grant required.
        // Change-own-password is already open to any authenticated
        // user server-side; this only surfaces the frontend page.
        if (req.user.role === "teacher" && !pageKeys.includes("settings")) {
            pageKeys.push("settings");
        }

        res.json({
            success: true,
            pageKeys
        });

    } catch (error) {

        console.error("Get My Pages Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load your page access."
        });

    }

};