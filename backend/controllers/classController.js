const db = require("../db");
const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");

// Promisified single-row read (db exports run/all but not get).
const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

// Fire-and-forget audit write; never breaks the request on failure.
const safeLogAudit = async (req, action, entityId, details) => {
    try {
        if (typeof logAudit !== "function") return;
        await logAudit({
            userId: req.user?.id ?? null,
            action,
            entityType: "class",
            entityId,
            details: details ? JSON.stringify(details) : null
        });
    } catch (err) {
        console.error("Audit log failed (non-fatal):", err.message);
    }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================
const normalizeName = (value) => String(value ?? "").trim();
const normalizeSection = (value) => {
    const text = String(value ?? "").trim();
    return text === "" ? null : text;
};

// The value students/enrollments actually store in their free-text className
// field is the class's DISPLAY name (e.g. "10 - A"), which is exactly what the
// student form's dropdown submits. Match on this when renaming/deleting so
// sectioned classes are handled correctly (not just section-less ones).
const classDisplay = (name, section) => {
    const n = normalizeName(name);
    const s = normalizeSection(section);
    return s ? `${n} - ${s}` : n;
};

const serializeClass = (row) => {
    if (!row) return null;

    const className = normalizeName(row.className);
    const section = normalizeSection(row.section);
    const displayName = section ? `${className} - ${section}` : className;

    return {
        id: row.id,
        className,
        section,
        name: displayName,
        displayName,
        isLocked: row.isLocked === undefined || row.isLocked === null ? true : !!row.isLocked,
        createdAt: row.createdAt
    };
};


// =====================================================
// CONTROLLER METHODS
// =====================================================

exports.getClasses = (req, res) => {
    db.all(
        `
        SELECT id, className, section, isLocked, createdAt
        FROM classes
        ORDER BY
            CASE
                WHEN className LIKE 'PG%' OR className LIKE 'Playgroup%' THEN 0
                WHEN className LIKE 'Nursery%' THEN 1
                WHEN className LIKE 'LKG%' THEN 2
                WHEN className LIKE 'UKG%' THEN 3
                WHEN className GLOB '[0-9]*' THEN 100 + CAST(className AS INTEGER)
                ELSE 9000
            END ASC,
            className ASC,
            section ASC
        `,
        [],
        (err, rows) => {
            if (err) {
                console.error("Get Classes Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Unable to load classes."
                });
            }

            res.json((rows || []).map(serializeClass));
        }
    );
};

exports.getClass = (req, res) => {
    const { id } = req.params;

    db.get(
        `
        SELECT id, className, section, isLocked, createdAt
        FROM classes
        WHERE id = ?
        `,
        [id],
        (err, row) => {
            if (err) {
                console.error("Get Class Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Unable to load class."
                });
            }

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Class not found."
                });
            }

            return res.json(serializeClass(row));
        }
    );
};

exports.createClass = (req, res) => {
    const rawName = req.body?.className ?? req.body?.name;
    const className = normalizeName(rawName);
    const section = normalizeSection(req.body?.section);

    if (!className) {
        return res.status(400).json({
            success: false,
            message: "Class name is required."
        });
    }

    const duplicateQuery = `
        SELECT id
        FROM classes
        WHERE className = ? AND COALESCE(section, '') = COALESCE(?, '')
    `;

    db.get(duplicateQuery, [className, section], (duplicateErr, existingClass) => {
        if (duplicateErr) {
            console.error("Check Class Error:", duplicateErr);
            return res.status(500).json({
                success: false,
                message: "Unable to check duplicate class."
            });
        }

        if (existingClass) {
            return res.status(409).json({
                success: false,
                message: "Class already exists."
            });
        }

        db.run(
            `
            INSERT INTO classes (className, section)
            VALUES (?, ?)
            `,
            [className, section],
            function (insertErr) {
                if (insertErr) {
                    console.error("Create Class Error:", insertErr);
                    return res.status(500).json({
                        success: false,
                        message: "Unable to create class."
                    });
                }

                db.get(
                    `
                    SELECT id, className, section, isLocked, createdAt
                    FROM classes
                    WHERE id = ?
                    `,
                    [this.lastID],
                    (selectErr, createdRow) => {
                        if (selectErr) {
                            console.error("Load Created Class Error:", selectErr);
                            return res.status(500).json({
                                success: false,
                                message: "Class created successfully, but could not be loaded."
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "Class created successfully.",
                            class: serializeClass(createdRow)
                        });
                    }
                );
            }
        );
    });
};

exports.updateClass = async (req, res) => {
    const { id } = req.params;
    const rawName = req.body?.className ?? req.body?.name;
    const className = normalizeName(rawName);
    const section = normalizeSection(req.body?.section);

    if (!className) {
        return res.status(400).json({
            success: false,
            message: "Class name is required."
        });
    }

    try {
        const existing = await get(
            `SELECT id, className, section, isLocked FROM classes WHERE id = ?`,
            [id]
        );

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // A locked class is frozen: block renames the same way deleteClass
        // blocks deletes. Treat unknown/NULL lock state as locked (safe default).
        const locked = existing.isLocked === undefined || existing.isLocked === null
            ? true
            : !!existing.isLocked;
        if (locked) {
            return res.status(409).json({
                success: false,
                message: "This class is locked. Unlock it first to rename."
            });
        }

        const duplicate = await get(
            `
            SELECT id
            FROM classes
            WHERE id != ? AND className = ? AND COALESCE(section, '') = COALESCE(?, '')
            `,
            [id, className, section]
        );

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Class already exists."
            });
        }

        // Students/enrollments store the DISPLAY name; match & rewrite on that
        // so both section-less ("10") and sectioned ("10 - A") classes follow.
        const oldDisplay = classDisplay(existing.className, existing.section);
        const newDisplay = classDisplay(className, section);
        const nameChanged = oldDisplay !== newDisplay;

        // Rename inside a transaction so students / enrollments follow the
        // class name (both store className as free text, not a class id).
        await runQuery("BEGIN");
        try {
            await runQuery(
                `UPDATE classes SET className = ?, section = ? WHERE id = ?`,
                [className, section, id]
            );

            if (nameChanged) {
                // Every table that stores the class as free text must follow the
                // rename, or fee preparation / marks / assignments silently break
                // (they match on className and would no longer find this class).
                await runQuery(
                    `UPDATE students SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
                await runQuery(
                    `UPDATE student_enrollments SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
                await runQuery(
                    `UPDATE class_fee_structures SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
                await runQuery(
                    `UPDATE subjects SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
                await runQuery(
                    `UPDATE exams SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
                await runQuery(
                    `UPDATE teacher_assignments SET className = ? WHERE className = ?`,
                    [newDisplay, oldDisplay]
                );
            }

            await runQuery("COMMIT");
        } catch (txErr) {
            await runQuery("ROLLBACK").catch(() => {});
            throw txErr;
        }

        if (nameChanged) {
            await safeLogAudit(req, "class.rename", id, {
                from: oldDisplay,
                to: newDisplay
            });
        }

        const updatedRow = await get(
            `SELECT id, className, section, isLocked, createdAt FROM classes WHERE id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Class updated successfully.",
            class: serializeClass(updatedRow)
        });
    } catch (err) {
        console.error("Update Class Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to update class."
        });
    }
};

exports.deleteClass = async (req, res) => {
    const { id } = req.params;

    try {
        const cls = await get(
            `SELECT id, className, section, isLocked FROM classes WHERE id = ?`,
            [id]
        );

        if (!cls) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // Locked classes are protected: admin must unlock first.
        const locked = cls.isLocked === undefined || cls.isLocked === null
            ? true
            : !!cls.isLocked;

        if (locked) {
            return res.status(409).json({
                success: false,
                message: "This class is locked. Unlock it first to delete."
            });
        }

        // Students store the DISPLAY name ("10 - A" / "10"); match on that.
        const className = classDisplay(cls.className, cls.section);

        // Collect the students that belong to this class (free-text match).
        const students = await allQuery(
            `SELECT id FROM students WHERE className = ?`,
            [className]
        );
        const studentIds = students.map((s) => s.id);

        // Cascade hard-delete everything tied to these students, in FK-safe
        // order, inside a single transaction. Dropping the students makes the
        // dashboard enrollment count fall immediately.
        await runQuery("BEGIN");
        try {
            if (studentIds.length > 0) {
                const placeholders = studentIds.map(() => "?").join(",");

                // payment_line_items -> via payments of these students
                await runQuery(
                    `
                    DELETE FROM payment_line_items
                    WHERE paymentId IN (
                        SELECT id FROM payments WHERE studentId IN (${placeholders})
                    )
                    `,
                    studentIds
                );

                // notifications tied to these students
                await runQuery(
                    `DELETE FROM notifications WHERE studentId IN (${placeholders})`,
                    studentIds
                );

                // payments of these students
                await runQuery(
                    `DELETE FROM payments WHERE studentId IN (${placeholders})`,
                    studentIds
                );

                // student_fee_items -> via fee accounts -> via enrollments
                await runQuery(
                    `
                    DELETE FROM student_fee_items
                    WHERE feeAccountId IN (
                        SELECT sfa.id
                        FROM student_fee_accounts sfa
                        JOIN student_enrollments se ON se.id = sfa.enrollmentId
                        WHERE se.studentId IN (${placeholders})
                    )
                    `,
                    studentIds
                );

                // student_fee_accounts -> via enrollments
                await runQuery(
                    `
                    DELETE FROM student_fee_accounts
                    WHERE enrollmentId IN (
                        SELECT id FROM student_enrollments WHERE studentId IN (${placeholders})
                    )
                    `,
                    studentIds
                );

                // student_enrollments
                await runQuery(
                    `DELETE FROM student_enrollments WHERE studentId IN (${placeholders})`,
                    studentIds
                );

                // exam marks + result notifications
                await runQuery(
                    `DELETE FROM exam_marks WHERE studentId IN (${placeholders})`,
                    studentIds
                );
                await runQuery(
                    `DELETE FROM result_notifications WHERE studentId IN (${placeholders})`,
                    studentIds
                );

                // finally the students themselves
                await runQuery(
                    `DELETE FROM students WHERE id IN (${placeholders})`,
                    studentIds
                );
            }

            // Also drop any orphan enrollments that still reference this class
            // name (defensive: enrollments whose student row was already gone).
            await runQuery(
                `DELETE FROM student_enrollments WHERE className = ?`,
                [className]
            );

            // Class-scoped records keyed by the free-text className. None of these
            // are FK-linked to classes, so deleting the class row alone would leave
            // them orphaned (the rename path already keeps them in sync). Remove the
            // fee structures for EVERY academic year. class_fee_items has ON DELETE
            // CASCADE on structureId, but we delete the items explicitly first so
            // cleanup does not depend on the foreign_keys PRAGMA being active on
            // this connection.
            await runQuery(
                `
                DELETE FROM class_fee_items
                WHERE structureId IN (
                    SELECT id FROM class_fee_structures WHERE className = ?
                )
                `,
                [className]
            );
            await runQuery(
                `DELETE FROM class_fee_structures WHERE className = ?`,
                [className]
            );

            // Exam scaffolding for this class (exam rows, subjects, teacher links).
            // Per-student exam_marks/result_notifications were already removed above.
            await runQuery(`DELETE FROM exams WHERE className = ?`, [className]);
            await runQuery(`DELETE FROM subjects WHERE className = ?`, [className]);
            await runQuery(
                `DELETE FROM teacher_assignments WHERE className = ?`,
                [className]
            );

            // Finally the class row.
            await runQuery(`DELETE FROM classes WHERE id = ?`, [id]);

            await runQuery("COMMIT");
        } catch (txErr) {
            await runQuery("ROLLBACK").catch(() => {});
            throw txErr;
        }

        await safeLogAudit(req, "class.delete", id, {
            className,
            studentsDeleted: studentIds.length
        });

        return res.json({
            success: true,
            message: `Class deleted. ${studentIds.length} student(s) and their records were removed.`,
            studentsDeleted: studentIds.length
        });
    } catch (err) {
        console.error("Delete Class Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to delete class."
        });
    }
};

// Lock / unlock a class. Locking guards it against accidental deletion.
const setClassLock = async (req, res, lockValue) => {
    const { id } = req.params;

    try {
        const result = await runQuery(
            `UPDATE classes SET isLocked = ? WHERE id = ?`,
            [lockValue, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        const row = await get(
            `SELECT id, className, section, isLocked, createdAt FROM classes WHERE id = ?`,
            [id]
        );

        await safeLogAudit(req, lockValue ? "class.lock" : "class.unlock", id, null);

        return res.json({
            success: true,
            message: lockValue ? "Class locked." : "Class unlocked.",
            class: serializeClass(row)
        });
    } catch (err) {
        console.error("Set Class Lock Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to update class lock state."
        });
    }
};

exports.lockClass = (req, res) => setClassLock(req, res, 1);
exports.unlockClass = (req, res) => setClassLock(req, res, 0);