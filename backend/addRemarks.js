const db = require("./db");

db.run(
  `ALTER TABLE payments ADD COLUMN remarks TEXT`,
  (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("remarks column already exists.");
      } else {
        console.error("Error:", err.message);
      }
    } else {
      console.log("remarks column added successfully.");
    }

    db.close();
  }
);