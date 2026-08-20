const bcrypt = require("bcryptjs");
const readline = require("readline");
const db = require("./db");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const email = "theageschool.erp@gmail.com";

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function createAdmin() {

    try {

        console.log("");
        console.log("====================================");
        console.log("CREATE PRODUCTION ADMIN");
        console.log("====================================");
        console.log("");

        const name = await ask(
            "Admin name: "
        );

        const password = await ask(
            "ERP password: "
        );

        const confirmPassword = await ask(
            "Confirm ERP password: "
        );

        console.log("");

        if (!name.trim()) {

            throw new Error(
                "Admin name is required."
            );

        }

        if (!password) {

            throw new Error(
                "Password is required."
            );

        }

        if (password !== confirmPassword) {

            throw new Error(
                "Passwords do not match."
            );

        }

        if (password.length < 8) {

            throw new Error(
                "Password must be at least 8 characters."
            );

        }

        // =====================================================
        // CHECK EXISTING USER
        // =====================================================

        const existingUser =
            await db.allQuery(
                `
                SELECT id, email, role
                FROM users
                WHERE email = ?
                `,
                [email]
            );

        if (existingUser.length > 0) {

            throw new Error(
                "An account with this email already exists."
            );

        }

        // =====================================================
        // HASH PASSWORD
        // =====================================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );

        // =====================================================
        // CREATE ADMIN
        // =====================================================

        await db.runQuery(
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
                email,
                hashedPassword,
                "admin"
            ]
        );

        console.log("");
        console.log("====================================");
        console.log("ADMIN CREATED SUCCESSFULLY");
        console.log("====================================");
        console.log("");
        console.log("Email:", email);
        console.log("Role: admin");
        console.log("");
        console.log(
            "The ERP password has been securely hashed."
        );
        console.log("");
        console.log(
            "Do NOT use your Gmail password as the ERP password."
        );
        console.log("");

    } catch (error) {

        console.error("");
        console.error(
            "ADMIN CREATION FAILED:"
        );
        console.error(
            error.message
        );
        console.error("");

    } finally {

        rl.close();

        // Give SQLite time to finish
        setTimeout(() => {
            process.exit(0);
        }, 300);

    }
}

createAdmin();