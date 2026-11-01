const db = require("../db");
const { runQuery, allQuery } = require("../db");
const logAudit = require("../utils/auditLogger");

// Promisified single-row read (db exports run/all but not get).
const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

// Fire-and-forget audit write; never breaks the request on failure.
const safeLogAudit = async (req, action, entityId, details, entityType = "class") => {
    try {
        if (typeof logAudit !== "function") return;
        await logAudit({
            userId: req.user?.id ?? null,
            action,
            entityType,
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


// =====================================================
// SUBJECTS — MASTER CATALOGUE + PER-CLASS SELECTION
//
// Mirrors the fee-structure flow: subjects are created in
// the catalogue FIRST, then a class's modal selects which
// of them are actually taught there.
//
// The per-class rows stay in the legacy `subjects` table
// (className + subjectName) — exams, subject-teacher
// assignments and progress cards reference those row ids,
// so saving a class's selection simply syncs that table:
//   - selected   -> ensure a row exists (default maxMarks)
//   - deselected -> remove the row ONLY if nothing
//                   (exam / teacher assignment) uses it
// =====================================================

const sanitizeSubjectName = (value) =>
    String(value ?? "").replace(/\s+/g, " ").trim();

// How much an individual legacy subject row is referenced.
const countSubjectUsage = async (subjectId) => {
    const row = await get(
        `
        SELECT
            (SELECT COUNT(*) FROM exam_subjects WHERE subjectId = ?) AS exams,
            (SELECT COUNT(*) FROM subject_teacher_assignments WHERE subjectId = ?) AS teachers
        `,
        [subjectId, subjectId]
    );
    return {
        exams: row ? Number(row.exams) : 0,
        teachers: row ? Number(row.teachers) : 0
    };
};

// -----------------------------------------------------
// MASTER SUBJECTS
// -----------------------------------------------------

exports.getMasterSubjects = async (req, res) => {
    try {
        const rows = await allQuery(
            `
            SELECT m.id, m.subjectName,
                   (SELECT COUNT(DISTINCT s.className)
                      FROM subjects s
                     WHERE s.subjectName = m.subjectName) AS classCount
            FROM subjects_master m
            ORDER BY m.subjectName ASC
            `
        );
        res.json({ success: true, subjects: rows });
    } catch (err) {
        console.error("Get Master Subjects Error:", err);
        res.status(500).json({ success: false, message: "Unable to load the subject catalogue." });
    }
};

exports.createMasterSubject = async (req, res) => {
    const subjectName = sanitizeSubjectName(req.body?.subjectName);

    if (!subjectName) {
        return res.status(400).json({ success: false, message: "Subject name is required." });
    }

    try {
        const duplicate = await get(
            `SELECT id FROM subjects_master WHERE LOWER(subjectName) = LOWER(?)`,
            [subjectName]
        );
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: `"${subjectName}" already exists in the catalogue.`
            });
        }

        const result = await runQuery(
            `INSERT INTO subjects_master (subjectName) VALUES (?)`,
            [subjectName]
        );

        const created = await get(
            `SELECT id, subjectName FROM subjects_master WHERE id = ?`,
            [result.lastID]
        );

        await safeLogAudit(req, "subject_master.create", result.lastID, { subjectName }, "subject");

        return res.status(201).json({
            success: true,
            message: `Subject "${subjectName}" added to the catalogue.`,
            subject: created
        });
    } catch (err) {
        console.error("Create Master Subject Error:", err);
        res.status(500).json({ success: false, message: "Unable to create subject." });
    }
};

exports.updateMasterSubject = async (req, res) => {
    const { id } = req.params;
    const subjectName = sanitizeSubjectName(req.body?.subjectName);

    if (!subjectName) {
        return res.status(400).json({ success: false, message: "Subject name is required." });
    }

    try {
        const existing = await get(
            `SELECT id, subjectName FROM subjects_master WHERE id = ?`,
            [id]
        );
        if (!existing) {
            return res.status(404).json({ success: false, message: "Subject not found." });
        }

        const duplicate = await get(
            `SELECT id FROM subjects_master WHERE id != ? AND LOWER(subjectName) = LOWER(?)`,
            [id, subjectName]
        );
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: `"${subjectName}" already exists in the catalogue.`
            });
        }

        // Renaming would collide with a per-class copy of the new name when
        // the same class offers both names (UNIQUE(className, subjectName)).
        const clash = await get(
            `
            SELECT s1.className
            FROM subjects s1
            JOIN subjects s2 ON s1.className = s2.className
            WHERE s1.subjectName = ? AND s2.subjectName = ?
            LIMIT 1
            `,
            [existing.subjectName, subjectName]
        );
        if (clash) {
            return res.status(409).json({
                success: false,
                message: `Class ${clash.className} already has "${subjectName}" — rename would clash there.`
            });
        }

        await runQuery("BEGIN");
        try {
            // Keep the master row and every per-class copy in step so the
            // class-selection mapping (joined on subjectName) keeps working.
            await runQuery(`UPDATE subjects_master SET subjectName = ? WHERE id = ?`, [subjectName, id]);
            await runQuery(`UPDATE subjects SET subjectName = ? WHERE subjectName = ?`, [subjectName, existing.subjectName]);
            await runQuery("COMMIT");
        } catch (txErr) {
            await runQuery("ROLLBACK").catch(() => {});
            throw txErr;
        }

        await safeLogAudit(req, "subject_master.rename", id, {
            from: existing.subjectName,
            to: subjectName
        }, "subject");

        return res.json({
            success: true,
            message: `Subject renamed to "${subjectName}".`
        });
    } catch (err) {
        console.error("Update Master Subject Error:", err);
        res.status(500).json({ success: false, message: "Unable to rename subject." });
    }
};

exports.deleteMasterSubject = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await get(
            `SELECT id, subjectName FROM subjects_master WHERE id = ?`,
            [id]
        );
        if (!existing) {
            return res.status(404).json({ success: false, message: "Subject not found." });
        }

        // A subject that is (still) offered in classes cannot be deleted from
        // the catalogue — remove it from the classes first.
        const usedIn = await allQuery(
            `SELECT DISTINCT className FROM subjects WHERE subjectName = ?`,
            [existing.subjectName]
        );
        if (usedIn.length > 0) {
            return res.status(409).json({
                success: false,
                message: `"${existing.subjectName}" is still used in ${usedIn.length} class(es). Remove it from those classes first.`
            });
        }

        const result = await runQuery(`DELETE FROM subjects_master WHERE id = ?`, [id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Subject not found." });
        }

        await safeLogAudit(req, "subject_master.delete", id, { subjectName: existing.subjectName }, "subject");

        return res.json({
            success: true,
            message: `Subject "${existing.subjectName}" deleted from the catalogue.`
        });
    } catch (err) {
        console.error("Delete Master Subject Error:", err);
        res.status(500).json({ success: false, message: "Unable to delete subject." });
    }
};

// -----------------------------------------------------
// PER-CLASS SELECTION (checkbox modal endpoints)
// -----------------------------------------------------

exports.getClassSubjects = async (req, res) => {
    const classId = Number(req.params.id);

    if (!Number.isInteger(classId)) {
        return res.status(400).json({ success: false, message: "A valid class id is required." });
    }

    try {
        const cls = await get(
            `SELECT id, className, section, isLocked FROM classes WHERE id = ?`,
            [classId]
        );
        if (!cls) {
            return res.status(404).json({ success: false, message: "Class not found." });
        }

        // Legacy rows store the display name ("10 - A") after renames and the
        // raw name before them — match either so old data still lines up.
        const display = classDisplay(cls.className, cls.section);
        const raw = normalizeName(cls.className);
        const classKeys = raw === display ? [raw] : [display, raw];
        const inClause = `(${classKeys.map(() => "?").join(",")})`;

        const subjects = await allQuery(
            `
            SELECT m.id, m.subjectName,
                   CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS selected,
                   s.id AS subjectRowId,
                   (SELECT COUNT(*) FROM exam_subjects es WHERE es.subjectId = s.id) AS examCount
            FROM subjects_master m
            LEFT JOIN subjects s
              ON s.subjectName = m.subjectName AND s.className IN ${inClause}
            ORDER BY m.subjectName ASC
            `,
            classKeys
        );

        res.json({
            success: true,
            class: serializeClass(cls),
            locked: cls.isLocked === undefined || cls.isLocked === null ? true : !!cls.isLocked,
            subjects
        });
    } catch (err) {
        console.error("Get Class Subjects Error:", err);
        res.status(500).json({ success: false, message: "Unable to load the class subjects." });
    }
};

exports.saveClassSubjects = async (req, res) => {
    const classId = Number(req.params.id);
    const subjectIds = Array.isArray(req.body?.subjectIds)
        ? req.body.subjectIds.map(Number).filter(Number.isInteger)
        : null;

    if (!Number.isInteger(classId)) {
        return res.status(400).json({ success: false, message: "A valid class id is required." });
    }
    if (subjectIds === null) {
        return res.status(400).json({ success: false, message: "A subjectIds array is required." });
    }

    try {
        const cls = await get(
            `SELECT id, className, section, isLocked FROM classes WHERE id = ?`,
            [classId]
        );
        if (!cls) {
            return res.status(404).json({ success: false, message: "Class not found." });
        }

        // Same freeze rule as rename/delete: unknown lock state counts as locked.
        const locked = cls.isLocked === undefined || cls.isLocked === null
            ? true
            : !!cls.isLocked;
        if (locked) {
            return res.status(409).json({
                success: false,
                message: "This class is locked. Unlock it first to change its subjects."
            });
        }

        // Only subjects that really exist in the catalogue can be selected.
        const wantedNames = [...new Set(
            (subjectIds.length
                ? await allQuery(
                    `SELECT subjectName FROM subjects_master
                     WHERE id IN (${subjectIds.map(() => "?").join(",")})`,
                    subjectIds
                )
                : []
            ).map((r) => r.subjectName)
        )];

        const display = classDisplay(cls.className, cls.section);
        const raw = normalizeName(cls.className);
        const classKeys = raw === display ? [raw] : [display, raw];
        const inClause = `(${classKeys.map(() => "?").join(",")})`;

        const current = await allQuery(
            `SELECT id, subjectName FROM subjects WHERE className IN ${inClause}`,
            classKeys
        );
        const currentNames = new Set(current.map((r) => r.subjectName));

        let added = 0;
        let removed = 0;
        let kept = 0;

        await runQuery("BEGIN");
        try {
            // Select -> make sure the class has a row (default maxMarks 100).
            for (const subjectName of wantedNames) {
                if (currentNames.has(subjectName)) continue;
                await runQuery(
                    `INSERT INTO subjects (className, subjectName) VALUES (?, ?)`,
                    [display, subjectName]
                );
                added++;
            }

            // Deselect -> drop the row unless exams or teacher assignments use
            // it (those are protected so no marks/history can ever dangle).
            for (const row of current) {
                if (wantedNames.includes(row.subjectName)) continue;
                const usage = await countSubjectUsage(row.id);
                if (usage.exams > 0 || usage.teachers > 0) {
                    kept++;
                    continue;
                }
                await runQuery(`DELETE FROM subjects WHERE id = ?`, [row.id]);
                removed++;
            }

            await runQuery("COMMIT");
        } catch (txErr) {
            await runQuery("ROLLBACK").catch(() => {});
            throw txErr;
        }

        await safeLogAudit(req, "class.subjects.save", cls.id, {
            classDisplay: display,
            added,
            removed,
            kept
        });

        const keptNote = kept > 0
            ? ` ${kept} subject(s) were left in place because exams or teacher assignments already use them.`
            : "";

        return res.json({
            success: true,
            message: `Subjects for ${display} saved — added ${added}, removed ${removed}.${keptNote}`,
            added,
            removed,
            kept
        });
    } catch (err) {
        console.error("Save Class Subjects Error:", err);
        res.status(500).json({ success: false, message: "Unable to save the class subjects." });
    }
};