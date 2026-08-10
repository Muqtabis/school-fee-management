const db = require("../db");


/*
====================================================
GET ALL STUDENTS
Supports:

?className=LKG
?search=rahul
====================================================
*/

exports.getStudents = (req, res) => {

    const {
        className,
        search
    } = req.query;


    let sql = `
        SELECT *
        FROM students
        WHERE 1=1
    `;

    const params = [];


    if (className && className !== "All") {

        sql += ` AND className = ?`;

        params.push(className);

    }


    if (search) {

        sql += `
            AND (
                LOWER(studentName) LIKE LOWER(?)
                OR LOWER(rollNumber) LIKE LOWER(?)
                OR LOWER(fatherName) LIKE LOWER(?)
                OR LOWER(contact1) LIKE LOWER(?)
                OR LOWER(className) LIKE LOWER(?)
            )
        `;

        const searchValue = `%${search}%`;

        params.push(
            searchValue,
            searchValue,
            searchValue,
            searchValue,
            searchValue
        );

    }


    sql += `
        ORDER BY
        CASE
            WHEN className = 'LKG' THEN 1
            WHEN className = 'UKG' THEN 2
            WHEN className = '1' THEN 3
            WHEN className = '2' THEN 4
            WHEN className = '3' THEN 5
            WHEN className = '4' THEN 6
            WHEN className = '5' THEN 7
            WHEN className = '6' THEN 8
            WHEN className = '7' THEN 9
            WHEN className = '8' THEN 10
            WHEN className = '9' THEN 11
            WHEN className = '10' THEN 12
            ELSE 99
        END,
        rollNumber ASC
    `;


    db.all(
        sql,
        params,
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            res.json(rows);

        }
    );

};


/*
====================================================
GET SINGLE STUDENT
====================================================
*/

exports.getStudent = (req, res) => {

    db.get(
        `SELECT *
         FROM students
         WHERE id = ?`,
        [req.params.id],
        (err, row) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            if (!row) {

                return res.status(404).json({
                    success: false,
                    message: "Student not found"
                });

            }


            res.json(row);

        }
    );

};


/*
====================================================
ADD STUDENT
====================================================
*/

exports.addStudent = (req, res) => {

    const {
        studentName,
        rollNumber,
        className,
        fatherName,
        contact1,
        previousDues,
        tuitionFee
    } = req.body;


    if (!studentName || !rollNumber || !className) {

        return res.status(400).json({
            success: false,
            message:
                "Student name, roll number and class are required."
        });

    }


    db.get(
        `SELECT id
         FROM students
         WHERE rollNumber = ?`,
        [rollNumber],
        (checkErr, existingStudent) => {

            if (checkErr) {

                return res.status(500).json({
                    success: false,
                    message: checkErr.message
                });

            }


            if (existingStudent) {

                return res.status(409).json({
                    success: false,
                    message:
                        "This roll number is already assigned."
                });

            }


            db.run(
                `
                INSERT INTO students
                (
                    studentName,
                    rollNumber,
                    className,
                    fatherName,
                    contact1,
                    previousDues,
                    tuitionFee
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    studentName,
                    rollNumber,
                    className,
                    fatherName || "",
                    contact1 || "",
                    Number(previousDues) || 0,
                    Number(tuitionFee) || 0
                ],
                function (err) {

                    if (err) {

                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });

                    }


                    res.status(201).json({

                        success: true,

                        id: this.lastID,

                        message:
                            "Student added successfully."

                    });

                }
            );

        }
    );

};


/*
====================================================
UPDATE STUDENT
====================================================
*/

exports.updateStudent = (req, res) => {

    const {
        studentName,
        rollNumber,
        className,
        fatherName,
        contact1,
        previousDues,
        tuitionFee
    } = req.body;


    db.get(
        `
        SELECT id
        FROM students
        WHERE rollNumber = ?
        AND id != ?
        `,
        [
            rollNumber,
            req.params.id
        ],
        (checkErr, existingStudent) => {

            if (checkErr) {

                return res.status(500).json({
                    success: false,
                    message: checkErr.message
                });

            }


            if (existingStudent) {

                return res.status(409).json({
                    success: false,
                    message:
                        "This roll number is already assigned to another student."
                });

            }


            db.run(
                `
                UPDATE students
                SET
                    studentName = ?,
                    rollNumber = ?,
                    className = ?,
                    fatherName = ?,
                    contact1 = ?,
                    previousDues = ?,
                    tuitionFee = ?
                WHERE id = ?
                `,
                [
                    studentName,
                    rollNumber,
                    className,
                    fatherName || "",
                    contact1 || "",
                    Number(previousDues) || 0,
                    Number(tuitionFee) || 0,
                    req.params.id
                ],
                function (err) {

                    if (err) {

                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });

                    }


                    res.json({

                        success: true,

                        message:
                            "Student updated successfully."

                    });

                }
            );

        }
    );

};


/*
====================================================
DELETE STUDENT
====================================================
*/

exports.deleteStudent = (req, res) => {

    db.run(
        `DELETE FROM students
         WHERE id = ?`,
        [req.params.id],
        function (err) {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }


            res.json({

                success: true,

                message:
                    "Student deleted successfully."

            });

        }
    );

};