const db = require("../db");

const logAudit =
    require("../utils/auditLogger");


// =====================================================
// GET ALL STUDENTS
// =====================================================
//
// Default:
// active students only
//
// ?status=archived
// archived only
//
// ?includeArchived=true
// active + archived
//
// =====================================================

exports.getStudents = (
    req,
    res
) => {

    const {
        className,
        search,
        status,
        includeArchived
    } = req.query;


    let sql = `
        SELECT *
        FROM students
        WHERE 1 = 1
    `;


    const params = [];


    // =================================================
    // STATUS
    // =================================================

    if (
        includeArchived !== "true"
    ) {

        if (
            status === "archived"
        ) {

            sql += `
                AND status = 'archived'
            `;

        } else {

            sql += `
                AND (
                    status IS NULL
                    OR status = 'active'
                )
            `;

        }

    } else {

        if (
            status === "active"
        ) {

            sql += `
                AND (
                    status IS NULL
                    OR status = 'active'
                )
            `;

        }


        if (
            status === "archived"
        ) {

            sql += `
                AND status = 'archived'
            `;

        }

    }


    // =================================================
    // CLASS FILTER
    // =================================================

    if (
        className &&
        className !== "All"
    ) {

        sql += `
            AND className = ?
        `;

        params.push(
            className
        );

    }


    // =================================================
    // SEARCH
    // =================================================

    if (search) {

        sql += `
            AND (
                LOWER(studentName)
                    LIKE LOWER(?)

                OR LOWER(rollNumber)
                    LIKE LOWER(?)

                OR LOWER(fatherName)
                    LIKE LOWER(?)

                OR LOWER(contact1)
                    LIKE LOWER(?)

                OR LOWER(className)
                    LIKE LOWER(?)
            )
        `;


        const searchValue =
            `%${search}%`;


        params.push(
            searchValue,
            searchValue,
            searchValue,
            searchValue,
            searchValue
        );

    }


    // =================================================
    // SORT
    // =================================================

    sql += `
        ORDER BY

            CASE

                WHEN className = 'LKG'
                    THEN 1

                WHEN className = 'UKG'
                    THEN 2

                WHEN className = '1'
                    THEN 3

                WHEN className = '2'
                    THEN 4

                WHEN className = '3'
                    THEN 5

                WHEN className = '4'
                    THEN 6

                WHEN className = '5'
                    THEN 7

                WHEN className = '6'
                    THEN 8

                WHEN className = '7'
                    THEN 9

                WHEN className = '8'
                    THEN 10

                WHEN className = '9'
                    THEN 11

                WHEN className = '10'
                    THEN 12

                ELSE 99

            END,

            rollNumber ASC
    `;


    db.all(
        sql,
        params,
        (
            err,
            rows
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to fetch students."

                });

            }


            res.json(rows);

        }
    );

};


// =====================================================
// GET SINGLE STUDENT
// =====================================================

exports.getStudent = (
    req,
    res
) => {

    db.get(
        `
        SELECT *
        FROM students
        WHERE id = ?
        `,
        [
            req.params.id
        ],
        (
            err,
            row
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to fetch student."

                });

            }


            if (!row) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student not found."

                });

            }


            res.json(row);

        }
    );

};


// =====================================================
// ADD STUDENT
// =====================================================

exports.addStudent = (
    req,
    res
) => {

    const {
        studentName,
        rollNumber,
        className,
        fatherName,
        contact1,
        previousDues,
        tuitionFee
    } = req.body;


    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (
        !studentName ||
        !rollNumber ||
        !className
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Student name, roll number and class are required."

        });

    }


    const cleanRollNumber =
        String(
            rollNumber
        ).trim();


    const cleanStudentName =
        String(
            studentName
        ).trim();


    const numericPreviousDues =
        Number(
            previousDues
        ) || 0;


    const numericTuitionFee =
        Number(
            tuitionFee
        ) || 0;


    if (
        numericPreviousDues < 0 ||
        numericTuitionFee < 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Fee values cannot be negative."

        });

    }


    // =================================================
    // IMPORTANT:
    // ROLL NUMBER IS UNIQUE WITHIN THE CLASS
    // =================================================

    db.get(
        `
        SELECT id

        FROM students

        WHERE rollNumber = ?

        AND className = ?

        AND (
            status IS NULL
            OR status = 'active'
        )
        `,
        [
            cleanRollNumber,
            className
        ],
        (
            checkErr,
            existingStudent
        ) => {

            if (checkErr) {

                console.error(
                    "Roll Number Check Error:",
                    checkErr
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to check roll number."

                });

            }


            if (existingStudent) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This roll number is already assigned to another active student in this class."

                });

            }


            // =================================================
            // INSERT STUDENT
            // =================================================

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
                    tuitionFee,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                `,
                [
                    cleanStudentName,

                    cleanRollNumber,

                    className,

                    fatherName
                        ? String(
                            fatherName
                        ).trim()
                        : "",

                    contact1
                        ? String(
                            contact1
                        ).trim()
                        : "",

                    numericPreviousDues,

                    numericTuitionFee
                ],
                function (
                    err
                ) {

                    if (err) {

                        console.error(
                            "Add Student Error:",
                            err
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to add student."

                        });

                    }


                    const studentId =
                        this.lastID;


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "STUDENT_CREATED",

                        entityType:
                            "student",

                        entityId:
                            studentId,

                        details: {

                            studentName:
                                cleanStudentName,

                            rollNumber:
                                cleanRollNumber,

                            className

                        }

                    }).then(() => {

                        res.status(201).json({

                            success: true,

                            id:
                                studentId,

                            message:
                                "Student added successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// UPDATE STUDENT
// =====================================================

exports.updateStudent = (
    req,
    res
) => {

    const {
        studentName,
        rollNumber,
        className,
        fatherName,
        contact1,
        previousDues,
        tuitionFee
    } = req.body;


    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (
        !studentName ||
        !rollNumber ||
        !className
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Student name, roll number and class are required."

        });

    }


    const cleanRollNumber =
        String(
            rollNumber
        ).trim();


    const cleanStudentName =
        String(
            studentName
        ).trim();


    const numericPreviousDues =
        Number(
            previousDues
        ) || 0;


    const numericTuitionFee =
        Number(
            tuitionFee
        ) || 0;


    if (
        numericPreviousDues < 0 ||
        numericTuitionFee < 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Fee values cannot be negative."

        });

    }


    // =================================================
    // FIND EXISTING STUDENT
    // =================================================

    db.get(
        `
        SELECT *

        FROM students

        WHERE id = ?
        `,
        [
            req.params.id
        ],
        (
            studentErr,
            currentStudent
        ) => {

            if (studentErr) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find student."

                });

            }


            if (!currentStudent) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student not found."

                });

            }


            // =================================================
            // ARCHIVED STUDENT
            // =================================================

            if (
                currentStudent.status ===
                "archived"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Archived students cannot be edited. Restore the student first."

                });

            }


            // =================================================
            // IMPORTANT:
            // ROLL NUMBER + CLASS MUST BE UNIQUE
            // =================================================

            db.get(
                `
                SELECT id

                FROM students

                WHERE rollNumber = ?

                AND className = ?

                AND id != ?

                AND (
                    status IS NULL
                    OR status = 'active'
                )
                `,
                [
                    cleanRollNumber,

                    className,

                    req.params.id
                ],
                (
                    checkErr,
                    existingStudent
                ) => {

                    if (checkErr) {

                        console.error(
                            "Update Roll Number Check Error:",
                            checkErr
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to check roll number."

                        });

                    }


                    if (existingStudent) {

                        return res.status(409).json({

                            success: false,

                            message:
                                "This roll number is already assigned to another active student in this class."

                        });

                    }


                    // =================================================
                    // UPDATE
                    // =================================================

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
                            cleanStudentName,

                            cleanRollNumber,

                            className,

                            fatherName
                                ? String(
                                    fatherName
                                ).trim()
                                : "",

                            contact1
                                ? String(
                                    contact1
                                ).trim()
                                : "",

                            numericPreviousDues,

                            numericTuitionFee,

                            req.params.id
                        ],
                        function (
                            err
                        ) {

                            if (err) {

                                console.error(
                                    "Update Student Error:",
                                    err
                                );

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Unable to update student."

                                });

                            }


                            if (
                                this.changes ===
                                0
                            ) {

                                return res.status(404).json({

                                    success: false,

                                    message:
                                        "Student not found."

                                });

                            }


                            logAudit({

                                userId:
                                    req.user.id,

                                action:
                                    "STUDENT_UPDATED",

                                entityType:
                                    "student",

                                entityId:
                                    Number(
                                        req.params.id
                                    ),

                                details: {

                                    studentName:
                                        cleanStudentName,

                                    rollNumber:
                                        cleanRollNumber,

                                    className

                                }

                            }).then(() => {

                                res.json({

                                    success: true,

                                    message:
                                        "Student updated successfully."

                                });

                            });

                        }
                    );

                }
            );

        }
    );

};


// =====================================================
// ARCHIVE STUDENT
// =====================================================

exports.archiveStudent = (
    req,
    res
) => {

    const studentId =
        Number(
            req.params.id
        );


    const reason =
        String(
            req.body?.reason || ""
        ).trim();


    if (
        !studentId ||
        studentId <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid student ID."

        });

    }


    if (!reason) {

        return res.status(400).json({

            success: false,

            message:
                "An archive reason is required."

        });

    }


    db.get(
        `
        SELECT *

        FROM students

        WHERE id = ?
        `,
        [
            studentId
        ],
        (
            err,
            student
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find student."

                });

            }


            if (!student) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student not found."

                });

            }


            if (
                student.status ===
                "archived"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Student is already archived."

                });

            }


            const archivedAt =
                new Date().toISOString();


            db.run(
                `
                UPDATE students

                SET

                    status = 'archived',

                    archivedAt = ?,

                    archivedBy = ?,

                    archiveReason = ?

                WHERE id = ?

                AND (
                    status IS NULL
                    OR status = 'active'
                )
                `,
                [
                    archivedAt,

                    req.user.id,

                    reason,

                    studentId
                ],
                function (
                    updateErr
                ) {

                    if (updateErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to archive student."

                        });

                    }


                    if (
                        this.changes ===
                        0
                    ) {

                        return res.status(409).json({

                            success: false,

                            message:
                                "Student could not be archived."

                        });

                    }


                    logAudit({

                        userId:
                            req.user.id,

                        action:
                            "STUDENT_ARCHIVED",

                        entityType:
                            "student",

                        entityId:
                            studentId,

                        details: {

                            studentName:
                                student.studentName,

                            rollNumber:
                                student.rollNumber,

                            className:
                                student.className,

                            reason,

                            archivedAt

                        }

                    }).then(() => {

                        res.json({

                            success: true,

                            message:
                                "Student archived successfully."

                        });

                    });

                }
            );

        }
    );

};


// =====================================================
// RESTORE STUDENT
// =====================================================

exports.restoreStudent = (
    req,
    res
) => {

    const studentId =
        Number(
            req.params.id
        );


    if (
        !studentId ||
        studentId <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid student ID."

        });

    }


    db.get(
        `
        SELECT *

        FROM students

        WHERE id = ?
        `,
        [
            studentId
        ],
        (
            err,
            student
        ) => {

            if (err) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to find student."

                });

            }


            if (!student) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student not found."

                });

            }


            if (
                student.status !==
                "archived"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Student is already active."

                });

            }


            // =================================================
            // IMPORTANT:
            // CLASS + ROLL NUMBER MUST BE UNIQUE
            // =================================================

            db.get(
                `
                SELECT id

                FROM students

                WHERE rollNumber = ?

                AND className = ?

                AND id != ?

                AND (
                    status IS NULL
                    OR status = 'active'
                )
                `,
                [
                    student.rollNumber,

                    student.className,

                    studentId
                ],
                (
                    conflictErr,
                    conflict
                ) => {

                    if (conflictErr) {

                        return res.status(500).json({

                            success: false,

                            message:
                                "Unable to check roll number."

                        });

                    }


                    if (conflict) {

                        return res.status(409).json({

                            success: false,

                            message:
                                "The student's roll number is already assigned to another active student in this class."

                        });

                    }


                    db.run(
                        `
                        UPDATE students

                        SET

                            status = 'active',

                            archivedAt = NULL,

                            archivedBy = NULL,

                            archiveReason = NULL

                        WHERE id = ?
                        `,
                        [
                            studentId
                        ],
                        function (
                            updateErr
                        ) {

                            if (updateErr) {

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Unable to restore student."

                                });

                            }


                            logAudit({

                                userId:
                                    req.user.id,

                                action:
                                    "STUDENT_RESTORED",

                                entityType:
                                    "student",

                                entityId:
                                    studentId,

                                details: {

                                    studentName:
                                        student.studentName,

                                    rollNumber:
                                        student.rollNumber,

                                    className:
                                        student.className

                                }

                            }).then(() => {

                                res.json({

                                    success: true,

                                    message:
                                        "Student restored successfully."

                                });

                            });

                        }
                    );

                }
            );

        }
    );

};


// =====================================================
// PERMANENT DELETE DISABLED
// =====================================================

exports.deleteStudent = (
    req,
    res
) => {

    return res.status(405).json({

        success: false,

        message:
            "Permanent student deletion is disabled. Use Archive instead."

    });

};