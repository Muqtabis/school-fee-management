const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all students
router.get("/", (req, res) => {
  db.all("SELECT * FROM students ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

// Add student
router.post("/", (req, res) => {
  const {
    studentName,
    className,
    fatherName,
    contact1,
    previousDues,
    tuitionFee,
  } = req.body;

  db.run(
    `INSERT INTO students
    (studentName,className,fatherName,contact1,previousDues,tuitionFee)
    VALUES(?,?,?,?,?,?)`,
    [
      studentName,
      className,
      fatherName,
      contact1,
      previousDues,
      tuitionFee,
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

// Update student
router.put("/:id", (req, res) => {
  const {
    studentName,
    className,
    fatherName,
    contact1,
    previousDues,
    tuitionFee,
  } = req.body;

  db.run(
    `UPDATE students
     SET
     studentName=?,
     className=?,
     fatherName=?,
     contact1=?,
     previousDues=?,
     tuitionFee=?
     WHERE id=?`,
    [
      studentName,
      className,
      fatherName,
      contact1,
      previousDues,
      tuitionFee,
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

// Delete student
router.delete("/:id", (req, res) => {
  db.run(
    "DELETE FROM students WHERE id=?",
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

module.exports = router;