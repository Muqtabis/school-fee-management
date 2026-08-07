const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./data/school.db", (err) => {
  if (err) {
    console.error("Database Connection Error:", err.message);
  } else {
    console.log("Connected to SQLite Database");
  }
});

db.serialize(() => {
  // Students Table
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentName TEXT NOT NULL,
      className TEXT NOT NULL,
      fatherName TEXT,
      contact1 TEXT,
      previousDues REAL DEFAULT 0,
      tuitionFee REAL DEFAULT 0
    )
  `);

  // Payments Table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER,
      paymentDate TEXT,
      amount REAL,
      paymentMode TEXT,
      FOREIGN KEY(studentId) REFERENCES students(id)
    )
  `);

  // Users Table
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
});

module.exports = db;