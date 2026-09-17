const db = require("../db");

// =====================================================
// HELPER FUNCTIONS
// =====================================================
const normalizeName = (value) => String(value ?? "").trim();
const normalizeSection = (value) => {
    const text = String(value ?? "").trim();
    return text === "" ? null : text;
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
        createdAt: row.createdAt
    };
};


// =====================================================
// CONTROLLER METHODS
// =====================================================

exports.getClasses = (req, res) => {
    db.all(
        `
        SELECT id, className, section, createdAt
        FROM classes
        ORDER BY className ASC, section ASC
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
        SELECT id, className, section, createdAt
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
                    SELECT id, className, section, createdAt
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

exports.updateClass = (req, res) => {
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

    db.get(
        `
        SELECT id
        FROM classes
        WHERE id = ?
        `,
        [id],
        (findErr, row) => {
            if (findErr) {
                console.error("Find Class Error:", findErr);
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

            db.get(
                `
                SELECT id
                FROM classes
                WHERE id != ? AND className = ? AND COALESCE(section, '') = COALESCE(?, '')
                `,
                [id, className, section],
                (duplicateErr, existingClass) => {
                    if (duplicateErr) {
                        console.error("Check Class Duplicate Error:", duplicateErr);
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
                        UPDATE classes
                        SET className = ?, section = ?
                        WHERE id = ?
                        `,
                        [className, section, id],
                        (updateErr) => {
                            if (updateErr) {
                                console.error("Update Class Error:", updateErr);
                                return res.status(500).json({
                                    success: false,
                                    message: "Unable to update class."
                                });
                            }

                            db.get(
                                `
                                SELECT id, className, section, createdAt
                                FROM classes
                                WHERE id = ?
                                `,
                                [id],
                                (selectErr, updatedRow) => {
                                    if (selectErr) {
                                        console.error("Read Updated Class Error:", selectErr);
                                        return res.status(500).json({
                                            success: false,
                                            message: "Class updated successfully, but could not be reloaded."
                                        });
                                    }

                                    return res.json({
                                        success: true,
                                        message: "Class updated successfully.",
                                        class: serializeClass(updatedRow)
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
};

exports.deleteClass = (req, res) => {
    const { id } = req.params;

    db.run(
        `DELETE FROM classes WHERE id = ?`,
        [id],
        function (err) {
            if (err) {
                console.error("Delete Class Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Unable to delete class."
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Class not found."
                });
            }

            return res.json({
                success: true,
                message: "Class deleted successfully."
            });
        }
    );
};