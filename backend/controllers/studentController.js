const db = require("../db");

// Get All Students
exports.getStudents = (req, res) => {
  db.all(
    "SELECT * FROM students ORDER BY id DESC",
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

// Get Student By Id
exports.getStudent = (req, res) => {
  db.get(
    "SELECT * FROM students WHERE id=?",
    [req.params.id],
    (err, row) => {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      res.json(row);
    }
  );
};

// Add Student
exports.addStudent = (req, res) => {
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

// Update Student
exports.updateStudent = (req, res) => {
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
SET studentName=?,
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
          success: false,
          message: err.message,
        });

      res.json({
        success: true,
        message: "Student Updated",
      });
    }
  );
};

// Delete Student
exports.deleteStudent = (req, res) => {
  db.run(
    "DELETE FROM students WHERE id=?",
    [req.params.id],
    function (err) {
      if (err)
        return res.status(500).json({
          success: false,
          message: err.message,
        });

      res.json({
        success: true,
        message: "Student Deleted",
      });
    }
  );
};