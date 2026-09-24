const db = require("../db");
const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");
const xlsx = require("xlsx");
const fs = require("fs");

// =====================================================
// ENROLLMENT / FEE-ACCOUNT SYNC
//
// The dashboard counts students and fees through the
// student_enrollments -> student_fee_accounts -> student_fee_items
// chain, not the raw students table. Historically that chain was
// only filled by a manual "assess fees" batch on the Fees page,
// so freshly added/imported students were invisible on the
// dashboard until someone re-ran it. These helpers keep the chain
// in sync as students are added, imported, archived and restored.
// =====================================================

async function getActiveYearId() {
    const rows = await allQuery(
        `SELECT id FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1`
    );
    return rows.length ? rows[0].id : null;
}

// Ensure the student has an ACTIVE enrollment + fee account for the
// active academic year, on the given class, and apply that class's
// standard fee-structure items (if a structure exists). Idempotent.
async function ensureEnrollment(studentId, className, rollNumber) {
    const yearId = await getActiveYearId();
    if (!yearId) return; // no active year -> nothing the dashboard counts anyway

    const existing = await allQuery(
        `SELECT id FROM student_enrollments WHERE studentId = ? AND academicYearId = ?`,
        [studentId, yearId]
    );

    let enrollmentId;
    if (existing.length === 0) {
        const r = await runQuery(
            `INSERT INTO student_enrollments (studentId, academicYearId, className, rollNumber, status) VALUES (?, ?, ?, ?, 'active')`,
            [studentId, yearId, className, rollNumber || null]
        );
        enrollmentId = r.lastID;
    } else {
        enrollmentId = existing[0].id;
        await runQuery(
            `UPDATE student_enrollments SET status = 'active', className = ?, rollNumber = ? WHERE id = ?`,
            [className, rollNumber || null, enrollmentId]
        );
    }

    const acc = await allQuery(
        `SELECT id FROM student_fee_accounts WHERE enrollmentId = ?`,
        [enrollmentId]
    );
    let accountId;
    if (acc.length === 0) {
        const r = await runQuery(
            `INSERT INTO student_fee_accounts (enrollmentId, status) VALUES (?, 'active')`,
            [enrollmentId]
        );
        accountId = r.lastID;
    } else {
        accountId = acc[0].id;
    }

    // Apply the class fee structure's standard items, if defined for this
    // year + class. Existing items are left as-is (a full re-price is still
    // done by the Fees page batch); we only add missing standard items.
    const structs = await allQuery(
        `SELECT id FROM class_fee_structures WHERE academicYearId = ? AND className = ?`,
        [yearId, className]
    );
    if (structs.length > 0) {
        const items = await allQuery(
            `SELECT componentId, amount FROM class_fee_items WHERE structureId = ?`,
            [structs[0].id]
        );
        for (const it of items) {
            const has = await allQuery(
                `SELECT id FROM student_fee_items WHERE feeAccountId = ? AND componentId = ?`,
                [accountId, it.componentId]
            );
            if (has.length === 0) {
                await runQuery(
                    `INSERT INTO student_fee_items (feeAccountId, componentId, amount, itemType) VALUES (?, ?, ?, 'standard')`,
                    [accountId, it.componentId, it.amount]
                );
            }
        }
    }
}

// Flip the status of a student's enrollments (archive/restore) so the
// dashboard's active-enrollment count and fee totals track the roster.
async function setEnrollmentStatus(studentId, status) {
    await runQuery(
        `UPDATE student_enrollments SET status = ? WHERE studentId = ?`,
        [status, studentId]
    );
}

// =====================================================
// GET ALL STUDENTS
// =====================================================
exports.getStudents = (req, res) => {
    const { className, search, status, includeArchived } = req.query;

    let sql = `SELECT * FROM students WHERE 1 = 1`;
    const params = [];

    if (includeArchived !== "true") {
        if (status === "archived") {
            sql += ` AND status = 'archived'`;
        } else {
            sql += ` AND (status IS NULL OR status = 'active')`;
        }
    } else {
        if (status === "active") {
            sql += ` AND (status IS NULL OR status = 'active')`;
        }
        if (status === "archived") {
            sql += ` AND status = 'archived'`;
        }
    }

    if (className && className !== "All") {
        sql += ` AND className = ?`;
        params.push(className);
    }

    if (search) {
        sql += `
            AND (
                LOWER(studentName) LIKE LOWER(?)
                OR LOWER(rollNumber) LIKE LOWER(?)
                OR LOWER(admissionNumber) LIKE LOWER(?)
                OR LOWER(satsNumber) LIKE LOWER(?)
                OR LOWER(fatherName) LIKE LOWER(?)
                OR LOWER(contact1) LIKE LOWER(?)
                OR LOWER(className) LIKE LOWER(?)
            )
        `;
        const searchValue = `%${search}%`;
        params.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    sql += `
        ORDER BY
            CASE
                WHEN UPPER(className) LIKE 'LKG%' THEN 1
                WHEN UPPER(className) LIKE 'UKG%' THEN 2
                -- '10%' MUST be tested before '1%', or "10" falls into the "1"
                -- bucket (CASE stops at the first match).
                WHEN UPPER(className) LIKE '10%' THEN 12
                WHEN UPPER(className) LIKE '1%' THEN 3
                WHEN UPPER(className) LIKE '2%' THEN 4
                WHEN UPPER(className) LIKE '3%' THEN 5
                WHEN UPPER(className) LIKE '4%' THEN 6
                WHEN UPPER(className) LIKE '5%' THEN 7
                WHEN UPPER(className) LIKE '6%' THEN 8
                WHEN UPPER(className) LIKE '7%' THEN 9
                WHEN UPPER(className) LIKE '8%' THEN 10
                WHEN UPPER(className) LIKE '9%' THEN 11
                ELSE 99
            END,
            className ASC,
            CAST(NULLIF(rollNumber, '') AS INTEGER) ASC,
            rollNumber ASC
    `;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Unable to fetch students." });
        }
        res.json(rows);
    });
};

// =====================================================
// GET SINGLE STUDENT
// =====================================================
exports.getStudent = (req, res) => {
    db.get(
        `SELECT * FROM students WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Unable to fetch student." });
            }
            if (!row) {
                return res.status(404).json({ success: false, message: "Student not found." });
            }
            res.json(row);
        }
    );
};

// =====================================================
// ADD STUDENT
// =====================================================
exports.addStudent = (req, res) => {
    const {
        studentName, rollNumber, className, fatherName, contact1, contact2, previousDues, tuitionFee,
        admissionNumber, satsNumber, motherName, gender, dob, address, remark, concessionAmount, concessionReason
    } = req.body;

    if (!studentName || !rollNumber || !className) {
        return res.status(400).json({ success: false, message: "Student name, roll number and class are required." });
    }

    const cleanRollNumber = String(rollNumber).trim();
    const cleanStudentName = String(studentName).trim();
    const numericPreviousDues = Number(previousDues) || 0;
    const numericTuitionFee = Number(tuitionFee) || 0;
    const numericConcession = Number(concessionAmount) || 0;

    if (numericPreviousDues < 0 || numericTuitionFee < 0 || numericConcession < 0) {
        return res.status(400).json({ success: false, message: "Fee values cannot be negative." });
    }

    db.get(
        `SELECT id FROM students WHERE rollNumber = ? AND className = ? AND (status IS NULL OR status = 'active')`,
        [cleanRollNumber, className],
        (checkErr, existingStudent) => {
            if (checkErr) {
                return res.status(500).json({ success: false, message: "Unable to check roll number." });
            }

            if (existingStudent) {
                return res.status(409).json({ success: false, message: "This roll number is already assigned to another active student in this class." });
            }

            db.run(
                `
                INSERT INTO students (
                    studentName, rollNumber, className, fatherName, contact1, contact2,
                    previousDues, tuitionFee, status, admissionNumber, satsNumber,
                    motherName, gender, dob, address, remark, concessionAmount, concessionReason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    cleanStudentName, cleanRollNumber, className,
                    fatherName ? String(fatherName).trim() : "",
                    contact1 ? String(contact1).trim() : "",
                    contact2 ? String(contact2).trim() : "",
                    numericPreviousDues, numericTuitionFee,
                    admissionNumber ? String(admissionNumber).trim() : "",
                    satsNumber ? String(satsNumber).trim() : "",
                    motherName ? String(motherName).trim() : "",
                    gender ? String(gender).trim() : "",
                    dob ? String(dob).trim() : "",
                    address ? String(address).trim() : "",
                    remark ? String(remark).trim() : "",
                    numericConcession,
                    concessionReason ? String(concessionReason).trim() : ""
                ],
                function (err) {
                    if (err) {
                        return res.status(500).json({ success: false, message: "Unable to add student." });
                    }

                    const studentId = this.lastID;

                    // Create the enrollment/fee-account (and apply the class fee
                    // structure) so the student shows on the dashboard at once,
                    // then log + respond. Enrollment failure must not fail the add.
                    (async () => {
                        try {
                            await ensureEnrollment(studentId, className, cleanRollNumber);
                        } catch (enrErr) {
                            console.error("Enrollment sync (add) failed:", enrErr);
                        }
                        try {
                            await logAudit({
                                userId: req.user.id,
                                action: "STUDENT_CREATED",
                                entityType: "student",
                                entityId: studentId,
                                details: { studentName: cleanStudentName, rollNumber: cleanRollNumber, className }
                            });
                        } catch (auditErr) {
                            console.error("Audit log (STUDENT_CREATED) failed:", auditErr);
                        }
                        res.status(201).json({ success: true, id: studentId, message: "Student added successfully." });
                    })();
                }
            );
        }
    );
};

// =====================================================
// UPDATE STUDENT
// =====================================================
exports.updateStudent = (req, res) => {
    const {
        studentName, rollNumber, className, fatherName, contact1, contact2, previousDues, tuitionFee,
        admissionNumber, satsNumber, motherName, gender, dob, address, remark, concessionAmount, concessionReason
    } = req.body;

    if (!studentName || !rollNumber || !className) {
        return res.status(400).json({ success: false, message: "Student name, roll number and class are required." });
    }

    const cleanRollNumber = String(rollNumber).trim();
    const cleanStudentName = String(studentName).trim();
    const numericPreviousDues = Number(previousDues) || 0;
    const numericTuitionFee = Number(tuitionFee) || 0;
    const numericConcession = Number(concessionAmount) || 0;

    if (numericPreviousDues < 0 || numericTuitionFee < 0 || numericConcession < 0) {
        return res.status(400).json({ success: false, message: "Fee values cannot be negative." });
    }

    db.get(
        `SELECT * FROM students WHERE id = ?`,
        [req.params.id],
        (studentErr, currentStudent) => {
            if (studentErr) {
                return res.status(500).json({ success: false, message: "Unable to find student." });
            }
            if (!currentStudent) {
                return res.status(404).json({ success: false, message: "Student not found." });
            }
            if (currentStudent.status === "archived") {
                return res.status(409).json({ success: false, message: "Archived students cannot be edited. Restore the student first." });
            }

            db.get(
                `SELECT id FROM students WHERE rollNumber = ? AND className = ? AND id != ? AND (status IS NULL OR status = 'active')`,
                [cleanRollNumber, className, req.params.id],
                (checkErr, existingStudent) => {
                    if (checkErr) {
                        return res.status(500).json({ success: false, message: "Unable to check roll number." });
                    }
                    if (existingStudent) {
                        return res.status(409).json({ success: false, message: "This roll number is already assigned to another active student in this class." });
                    }

                    db.run(
                        `
                        UPDATE students SET
                            studentName = ?, rollNumber = ?, className = ?, fatherName = ?, contact1 = ?, contact2 = ?,
                            previousDues = ?, tuitionFee = ?, admissionNumber = ?, satsNumber = ?,
                            motherName = ?, gender = ?, dob = ?, address = ?, remark = ?,
                            concessionAmount = ?, concessionReason = ?
                        WHERE id = ?
                        `,
                        [
                            cleanStudentName, cleanRollNumber, className,
                            fatherName ? String(fatherName).trim() : "",
                            contact1 ? String(contact1).trim() : "",
                            contact2 ? String(contact2).trim() : "",
                            numericPreviousDues, numericTuitionFee,
                            admissionNumber ? String(admissionNumber).trim() : "",
                            satsNumber ? String(satsNumber).trim() : "",
                            motherName ? String(motherName).trim() : "",
                            gender ? String(gender).trim() : "",
                            dob ? String(dob).trim() : "",
                            address ? String(address).trim() : "",
                            remark ? String(remark).trim() : "",
                            numericConcession,
                            concessionReason ? String(concessionReason).trim() : "",
                            req.params.id
                        ],
                        function (err) {
                            if (err) {
                                return res.status(500).json({ success: false, message: "Unable to update student." });
                            }
                            if (this.changes === 0) {
                                return res.status(404).json({ success: false, message: "Student not found." });
                            }

                            (async () => {
                                // Keep the active-year enrollment's class/roll in sync
                                // with the edited student (and apply the new class's
                                // structure if the class changed).
                                try {
                                    await ensureEnrollment(Number(req.params.id), className, cleanRollNumber);
                                } catch (enrErr) {
                                    console.error("Enrollment sync (update) failed:", enrErr);
                                }
                                try {
                                    await logAudit({
                                        userId: req.user.id,
                                        action: "STUDENT_UPDATED",
                                        entityType: "student",
                                        entityId: Number(req.params.id),
                                        details: { studentName: cleanStudentName, rollNumber: cleanRollNumber, className }
                                    });
                                } catch (auditErr) {
                                    console.error("Audit log (STUDENT_UPDATED) failed:", auditErr);
                                }
                                res.json({ success: true, message: "Student updated successfully." });
                            })();
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
exports.archiveStudent = (req, res) => {
    const studentId = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();

    if (!studentId || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });
    if (!reason) return res.status(400).json({ success: false, message: "An archive reason is required." });

    db.get(
        `SELECT * FROM students WHERE id = ?`,
        [studentId],
        (err, student) => {
            if (err) return res.status(500).json({ success: false, message: "Unable to find student." });
            if (!student) return res.status(404).json({ success: false, message: "Student not found." });
            if (student.status === "archived") return res.status(409).json({ success: false, message: "Student is already archived." });

            const archivedAt = new Date().toISOString();

            db.run(
                `UPDATE students SET status = 'archived', archivedAt = ?, archivedBy = ?, archiveReason = ? WHERE id = ? AND (status IS NULL OR status = 'active')`,
                [archivedAt, req.user.id, reason, studentId],
                function (updateErr) {
                    if (updateErr) return res.status(500).json({ success: false, message: "Unable to archive student." });
                    if (this.changes === 0) return res.status(409).json({ success: false, message: "Student could not be archived." });

                    (async () => {
                        // Deactivate the student's enrollments so they drop out of
                        // the dashboard head-count and fee totals.
                        try {
                            await setEnrollmentStatus(studentId, "archived");
                        } catch (enrErr) {
                            console.error("Enrollment sync (archive) failed:", enrErr);
                        }
                        try {
                            await logAudit({
                                userId: req.user.id,
                                action: "STUDENT_ARCHIVED",
                                entityType: "student",
                                entityId: studentId,
                                details: { studentName: student.studentName, rollNumber: student.rollNumber, className: student.className, reason, archivedAt }
                            });
                        } catch (auditErr) {
                            console.error("Audit log (STUDENT_ARCHIVED) failed:", auditErr);
                        }
                        res.json({ success: true, message: "Student archived successfully." });
                    })();
                }
            );
        }
    );
};

// =====================================================
// RESTORE STUDENT
// =====================================================
exports.restoreStudent = (req, res) => {
    const studentId = Number(req.params.id);

    if (!studentId || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    db.get(
        `SELECT * FROM students WHERE id = ?`,
        [studentId],
        (err, student) => {
            if (err) return res.status(500).json({ success: false, message: "Unable to find student." });
            if (!student) return res.status(404).json({ success: false, message: "Student not found." });
            if (student.status !== "archived") return res.status(409).json({ success: false, message: "Student is already active." });

            db.get(
                `SELECT id FROM students WHERE rollNumber = ? AND className = ? AND id != ? AND (status IS NULL OR status = 'active')`,
                [student.rollNumber, student.className, studentId],
                (conflictErr, conflict) => {
                    if (conflictErr) return res.status(500).json({ success: false, message: "Unable to check roll number." });
                    if (conflict) return res.status(409).json({ success: false, message: "The student's roll number is already assigned to another active student in this class." });

                    db.run(
                        `UPDATE students SET status = 'active', archivedAt = NULL, archivedBy = NULL, archiveReason = NULL WHERE id = ?`,
                        [studentId],
                        function (updateErr) {
                            if (updateErr) return res.status(500).json({ success: false, message: "Unable to restore student." });

                            (async () => {
                                // Reactivate (or recreate) the enrollment so the
                                // student re-enters the dashboard totals.
                                try {
                                    await ensureEnrollment(studentId, student.className, student.rollNumber);
                                } catch (enrErr) {
                                    console.error("Enrollment sync (restore) failed:", enrErr);
                                }
                                try {
                                    await logAudit({
                                        userId: req.user.id,
                                        action: "STUDENT_RESTORED",
                                        entityType: "student",
                                        entityId: studentId,
                                        details: { studentName: student.studentName, rollNumber: student.rollNumber, className: student.className }
                                    });
                                } catch (auditErr) {
                                    console.error("Audit log (STUDENT_RESTORED) failed:", auditErr);
                                }
                                res.json({ success: true, message: "Student restored successfully." });
                            })();
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
exports.deleteStudent = (req, res) => {
    return res.status(405).json({ success: false, message: "Permanent student deletion is disabled. Use Archive instead." });
};

// =====================================================
// IMPORT STUDENTS FROM EXCEL (EXACT MATCH & AUTO-CREATE)
// =====================================================
exports.importStudents = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No Excel file uploaded." });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        let importedCount = 0;
        let skippedCount = 0;
        let classesCreated = 0;

        for (const rawSheetName of workbook.SheetNames) {
            // Ignore unused sheets
            if (['Discontinue', 'SWA', 'TC Out 2026-27'].includes(rawSheetName)) {
                continue;
            }

            const sheet = workbook.Sheets[rawSheetName];
            
            // RTE Std has 3 title rows (headers on row 4 -> range: 3), others have 2 title rows (headers on row 3 -> range: 2)
            const headerRange = rawSheetName === 'RTE Std' ? 3 : 2;
            const rows = xlsx.utils.sheet_to_json(sheet, { range: headerRange, defval: "" });

            for (const row of rows) {
                const studentName = String(row["STUDENT NAME "] || row["STUDENT NAME"] || "").trim();
                const rollNumber = String(row["Sl. No"] || row["Sl.No"] || row["SL.NO."] || row["SL NO"] || row["Roll No"] || "").trim();
                
                if (!studentName || !rollNumber) continue;

                // Grab the exact class name
                let className = "";
                if (rawSheetName === 'RTE Std') {
                    className = "RTE Std"; // Force ALL students on this sheet into the RTE Std class
                } else {
                    // Use the exact Excel tab name directly since you formatted it
                    className = rawSheetName.trim();
                }

                // Auto-create the exact class in SQLite if it doesn't exist yet
                await new Promise((resolve) => {
                    db.get(`SELECT id FROM classes WHERE className = ?`, [className], (err, row) => {
                        if (err) {
                            console.error("Select class error:", err);
                            resolve();
                        } else if (!row) {
                            // Insert the class safely
                            db.run(`INSERT INTO classes (className, section) VALUES (?, '')`, [className], function(insertErr) {
                                if (insertErr) {
                                    console.error(`Failed to create class ${className}:`, insertErr.message);
                                } else {
                                    classesCreated++;
                                }
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    });
                });

                const admissionNumber = String(row["ADM .NO"] || row["ADM.NO"] || "").trim();
                const satsNumber = String(row["SATS NO."] || row["SATS NO"] || "").trim();
                const fatherName = String(row["FATHER NAME"] || "").trim();
                const motherName = String(row["MOTHER NAME "] || row["MOTHER NAME"] || "").trim();
                const gender = String(row["GENDER"] || "").trim();
                const address = String(row["ADDRESS"] || "").trim();
                const contact1 = String(row["CONTACT"] || row["CONTACT "] || "").trim();
                const remark = String(row["REMARK"] || "").trim();

                let dob = row["DOB"] || "";
                if (typeof dob === 'number') {
                    const date = new Date(Math.round((dob - 25569) * 86400 * 1000));
                    dob = date.toISOString().split('T')[0];
                } else {
                    dob = String(dob).trim();
                }

                const existing = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT id FROM students WHERE rollNumber = ? AND className = ? AND (status IS NULL OR status = 'active')`,
                        [rollNumber, className],
                        (err, conflictRow) => {
                            if (err) reject(err);
                            else resolve(conflictRow);
                        }
                    );
                });

                if (existing) {
                    skippedCount++;
                    continue;
                }

                const newStudentId = await new Promise((resolve, reject) => {
                    db.run(
                        `
                        INSERT INTO students (
                            studentName, rollNumber, className, fatherName, contact1,
                            previousDues, tuitionFee, status, admissionNumber, satsNumber,
                            motherName, gender, dob, address, remark, concessionAmount, concessionReason
                        ) VALUES (?, ?, ?, ?, ?, 0, 0, 'active', ?, ?, ?, ?, ?, ?, ?, 0, '')
                        `,
                        [
                            studentName, rollNumber, className, fatherName, contact1,
                            admissionNumber, satsNumber, motherName, gender, dob, address, remark
                        ],
                        function (err) {
                            if (err) reject(err);
                            else {
                                importedCount++;
                                resolve(this.lastID);
                            }
                        }
                    );
                });

                // Enroll the imported student for the active year so the dashboard
                // counts them. A sync failure must not abort the whole import.
                try {
                    await ensureEnrollment(newStudentId, className, rollNumber);
                } catch (enrErr) {
                    console.error(`Enrollment sync (import) failed for student ${newStudentId}:`, enrErr);
                }
            }
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: `Import complete! Successfully added ${importedCount} students and auto-created ${classesCreated} exact classes.`
        });

    } catch (error) {
        console.error("Excel Import Error:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: "Failed to process the Excel file." });
    }
};