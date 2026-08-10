const db = require("./db");

console.log("Running database feature migration...");

db.serialize(() => {

    // Add rollNumber to students table
    db.run(
        `ALTER TABLE students ADD COLUMN rollNumber TEXT`,
        (err) => {

            if (err) {

                if (err.message.includes("duplicate column name")) {

                    console.log("rollNumber column already exists.");

                } else {

                    console.log(
                        "rollNumber migration:",
                        err.message
                    );

                }

            } else {

                console.log(
                    "rollNumber column added successfully."
                );

            }

        }
    );


    // Add remarks to payments table
    db.run(
        `ALTER TABLE payments ADD COLUMN remarks TEXT`,
        (err) => {

            if (err) {

                if (err.message.includes("duplicate column name")) {

                    console.log("remarks column already exists.");

                } else {

                    console.log(
                        "remarks migration:",
                        err.message
                    );

                }

            } else {

                console.log(
                    "remarks column added successfully."
                );

            }

        }
    );


    // Create index for faster roll number searching
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_students_rollNumber
         ON students(rollNumber)`,
        (err) => {

            if (err) {

                console.log(
                    "Roll number index:",
                    err.message
                );

            } else {

                console.log(
                    "Roll number index ready."
                );

            }

        }
    );


    // Create index for class filtering
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_students_className
         ON students(className)`,
        (err) => {

            if (err) {

                console.log(
                    "Class index:",
                    err.message
                );

            } else {

                console.log(
                    "Class index ready."
                );

            }

        }
    );


    // Create payment date index
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_payments_date
         ON payments(paymentDate)`,
        (err) => {

            if (err) {

                console.log(
                    "Payment date index:",
                    err.message
                );

            } else {

                console.log(
                    "Payment date index ready."
                );

            }

        }
    );

});

setTimeout(() => {

    console.log(
        "Database migration completed."
    );

    process.exit(0);

}, 1000);