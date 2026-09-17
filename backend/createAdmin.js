const sqlite3 = require("sqlite3").verbose();
let bcrypt;
try {
    bcrypt = require("bcrypt");
} catch (e) {
    bcrypt = require("bcryptjs");
}

const db = new sqlite3.Database("./data/school.db");

async function forceResetAdmin() {
    try {
        const email = "theageschool.erp@gmail.com";
        const password = "Admin@2026"; 
        const hashedPassword = await bcrypt.hash(password, 10);

        // Force UPDATE the password for the existing user
        db.run(
            `UPDATE users SET password = ? WHERE email = ?`,
            [hashedPassword, email],
            function (err) {
                if (err) {
                    console.error("Error updating admin:", err.message);
                } else if (this.changes === 0) {
                    console.log("No user found with that email to update.");
                } else {
                    console.log(`✅ Admin password successfully FORCE RESET!`);
                    console.log(`✉️  Email: ${email}`);
                    console.log(`🔑 New Password: ${password}`);
                }
            }
        );
    } catch (error) {
        console.error("Script error:", error);
    }
}

forceResetAdmin();