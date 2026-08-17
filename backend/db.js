const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./data/school.db", (err) => {
    if (err) {
        console.error("Database Connection Error:", err.message);
    } else {
        console.log("Connected to SQLite Database");
    }
});

db.serialize(() => {

    // =====================================================
    // STUDENTS TABLE
    // =====================================================

    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studentName TEXT NOT NULL,
            rollNumber TEXT,
            className TEXT NOT NULL,
            fatherName TEXT,
            contact1 TEXT,
            previousDues REAL DEFAULT 0,
            tuitionFee REAL DEFAULT 0
        )
    `);


    // =====================================================
    // PAYMENTS TABLE
    // =====================================================

    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studentId INTEGER,
            paymentDate TEXT,
            amount REAL,
            paymentMode TEXT,
            remarks TEXT,
            FOREIGN KEY(studentId) REFERENCES students(id)
        )
    `);


    // =====================================================
    // USERS TABLE
    // =====================================================

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);


    // =====================================================
    // NOTIFICATIONS TABLE
    // =====================================================

    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            studentId INTEGER,

            paymentId INTEGER,

            phoneNumber TEXT,

            message TEXT,

            notificationType TEXT DEFAULT 'SMS',

            status TEXT DEFAULT 'pending',

            provider TEXT DEFAULT 'MSG91',

            sentAt DATETIME,

            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY(studentId) REFERENCES students(id),

            FOREIGN KEY(paymentId) REFERENCES payments(id)
        )
    `);


    // =====================================================
    // EXPENSES TABLE
    // =====================================================

    db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            expenseName TEXT NOT NULL,

            category TEXT NOT NULL,

            amount REAL NOT NULL,

            expenseDate TEXT NOT NULL,

            paymentMode TEXT NOT NULL,

            paidTo TEXT,

            description TEXT,

            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

});


module.exports = db;