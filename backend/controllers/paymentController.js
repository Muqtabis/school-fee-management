const db = require("../db");

// Get All Payments
exports.getPayments = (req, res) => {
  db.all(
    `
SELECT payments.*,
students.studentName
FROM payments
LEFT JOIN students
ON payments.studentId=students.id
ORDER BY payments.id DESC
`,
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      res.json(rows);
    }
  );
};

// Add Payment
exports.addPayment = (req, res) => {
  const {
    studentId,
    paymentDate,
    amount,
    paymentMode,
  } = req.body;

  db.run(
    `INSERT INTO payments
(studentId,paymentDate,amount,paymentMode)
VALUES(?,?,?,?)`,
    [
      studentId,
      paymentDate,
      amount,
      paymentMode,
    ],
    function (err) {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      res.status(201).json({
        success: true,
        id: this.lastID,
      });
    }
  );
};

// Delete Payment
exports.deletePayment = (req, res) => {
  db.run(
    "DELETE FROM payments WHERE id=?",
    [req.params.id],
    function (err) {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      res.json({
        success: true,
        message: "Payment Deleted",
      });
    }
  );
};

// Dashboard Summary
exports.dashboardSummary = (req, res) => {
  db.get(
    `
SELECT
COUNT(*) AS totalPayments,
SUM(amount) AS totalCollection
FROM payments
`,
    [],
    (err, paymentData) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      db.get(
        "SELECT COUNT(*) AS totalStudents FROM students",
        [],
        (err, studentData) => {
          if (err)
            return res.status(500).json({
              success: false,
              message: err.message,
            });

          res.json({
            totalStudents: studentData.totalStudents,
            totalPayments: paymentData.totalPayments || 0,
            totalCollection: paymentData.totalCollection || 0,
          });
        }
      );
    }
  );
};