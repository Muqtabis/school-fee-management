const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all payments
router.get("/", (req, res) => {
  db.all(
    `
    SELECT
      payments.*,
      students.studentName,
      students.className
    FROM payments
    LEFT JOIN students
    ON students.id = payments.studentId
    ORDER BY payments.id DESC
    `,
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({
          message: err.message,
        });

      res.json(rows);
    }
  );
});

// Add payment
router.post("/", (req, res) => {
  const {
    studentId,
    paymentDate,
    amount,
    paymentMode,
  } = req.body;

  db.run(
    `
    INSERT INTO payments
    (studentId,paymentDate,amount,paymentMode)
    VALUES(?,?,?,?)
    `,
    [
      studentId,
      paymentDate,
      amount,
      paymentMode,
    ],
    function (err) {
      if (err)
        return res.status(500).json({
          message: err.message,
        });

      res.json({
        success: true,
        id: this.lastID,
      });
    }
  );
});

// Update payment
router.put("/:id", (req, res) => {
  const {
    studentId,
    paymentDate,
    amount,
    paymentMode,
  } = req.body;

  db.run(
    `
    UPDATE payments
    SET
      studentId=?,
      paymentDate=?,
      amount=?,
      paymentMode=?
    WHERE id=?
    `,
    [
      studentId,
      paymentDate,
      amount,
      paymentMode,
      req.params.id,
    ],
    function (err) {
      if (err)
        return res.status(500).json({
          message: err.message,
        });

      res.json({
        success: true,
      });
    }
  );
});

// Delete payment
router.delete("/:id", (req, res) => {
  db.run(
    "DELETE FROM payments WHERE id=?",
    [req.params.id],
    function (err) {
      if (err)
        return res.status(500).json({
          message: err.message,
        });

      res.json({
        success: true,
      });
    }
  );
});

// Dashboard & Reports Summary
router.get("/summary", (req, res) => {
  db.serialize(() => {
    db.get(
      "SELECT COUNT(*) AS totalStudents FROM students",
      [],
      (err, studentRow) => {
        if (err)
          return res.status(500).json({
            message: err.message,
          });

        db.get(
          "SELECT COUNT(*) AS totalPayments, IFNULL(SUM(amount),0) AS totalCollection FROM payments",
          [],
          (err, paymentRow) => {
            if (err)
              return res.status(500).json({
                message: err.message,
              });

            db.get(
              `
              SELECT
              IFNULL(SUM(previousDues + tuitionFee),0) -
              IFNULL((SELECT SUM(amount) FROM payments),0)
              AS pendingFees
              FROM students
              `,
              [],
              (err, pendingRow) => {
                if (err)
                  return res.status(500).json({
                    message: err.message,
                  });

                res.json({
                  totalStudents: studentRow.totalStudents,
                  totalPayments: paymentRow.totalPayments,
                  totalCollection: paymentRow.totalCollection,
                  pendingFees: pendingRow.pendingFees,
                });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;