const db = require("../db");
const logAudit = require("../utils/auditLogger");

// =====================================================
// HELPERS
// =====================================================

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

async function safeLogAudit(auditData) {
    try {
        if (typeof logAudit === "function") {
            if (auditData.details && typeof auditData.details === "object") {
                auditData.details = JSON.stringify(auditData.details);
            }
            await logAudit(auditData);
        }
    } catch (err) {
        console.error("Audit log failed (non-fatal):", err.message);
    }
}

// =====================================================
// GET ACADEMIC YEARS
// =====================================================

exports.getAcademicYears = async (req, res) => {
    try {
        const years = await all(`
            SELECT *
            FROM academic_years
            ORDER BY id DESC
        `);
        res.json(years);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load academic years." });
    }
};

// =====================================================
// CREATE ACADEMIC YEAR
// =====================================================

exports.createAcademicYear = async (req, res) => {
    const { name, startDate, endDate } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Academic year name is required." });
    }

    try {
        const cleanName = name.trim();
        const existing = await get(`SELECT id FROM academic_years WHERE name = ?`, [cleanName]);

        if (existing) {
            return res.status(409).json({ success: false, message: "This academic year already exists." });
        }

        const result = await run(
            `INSERT INTO academic_years (name, status, startDate, endDate) VALUES (?, 'upcoming', ?, ?)`,
            [cleanName, startDate || null, endDate || null]
        );

        await safeLogAudit({
            userId: req.user?.id || null,
            action: "ACADEMIC_YEAR_CREATED",
            entityType: "academic_year",
            entityId: result.lastID,
            details: { name: cleanName, startDate: startDate || null, endDate: endDate || null }
        });

        res.status(201).json({ success: true, id: result.lastID, message: "Academic year created successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to create academic year." });
    }
};

// =====================================================
// ACTIVATE ACADEMIC YEAR
// =====================================================

exports.activateAcademicYear = async (req, res) => {
    const yearId = Number(req.params.id);

    if (!yearId || yearId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid academic year." });
    }

    try {
        const year = await get(`SELECT * FROM academic_years WHERE id = ?`, [yearId]);

        if (!year) {
            return res.status(404).json({ success: false, message: "Academic year not found." });
        }

        if (year.status === "active") {
            return res.json({ success: true, message: `${year.name} is already the active academic year.` });
        }

        await run(`UPDATE academic_years SET status = 'closed' WHERE status = 'active'`);
        await run(`UPDATE academic_years SET status = 'active' WHERE id = ?`, [yearId]);

        await safeLogAudit({
            userId: req.user?.id || null,
            action: "ACADEMIC_YEAR_ACTIVATED",
            entityType: "academic_year",
            entityId: yearId,
            details: { name: year.name }
        });

        res.json({ success: true, message: `${year.name} is now the active academic year.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to activate academic year." });
    }
};

// =====================================================
// GET FEE STRUCTURES
// =====================================================

exports.getStructures = async (req, res) => {
    const academicYearId = Number(req.query.academicYearId);

    if (!academicYearId || academicYearId <= 0) {
        return res.status(400).json({ success: false, message: "Academic year is required." });
    }

    try {
        const structures = await all(
            `
            SELECT
                cfs.id,
                cfs.academicYearId,
                cfs.className,
                COALESCE(SUM(cfi.amount), 0) AS totalAmount
            FROM class_fee_structures cfs
            LEFT JOIN class_fee_items cfi ON cfi.structureId = cfs.id
            WHERE cfs.academicYearId = ?
            GROUP BY cfs.id, cfs.academicYearId, cfs.className
            ORDER BY
                CASE
                    WHEN cfs.className = 'LKG' THEN 1
                    WHEN cfs.className = 'UKG' THEN 2
                    WHEN cfs.className = '1' THEN 3
                    WHEN cfs.className = '2' THEN 4
                    WHEN cfs.className = '3' THEN 5
                    WHEN cfs.className = '4' THEN 6
                    WHEN cfs.className = '5' THEN 7
                    WHEN cfs.className = '6' THEN 8
                    WHEN cfs.className = '7' THEN 9
                    WHEN cfs.className = '8' THEN 10
                    WHEN cfs.className = '9' THEN 11
                    WHEN cfs.className = '10' THEN 12
                    ELSE 99
                END
            `,
            [academicYearId]
        );
        res.json(structures);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load fee structures." });
    }
};

// =====================================================
// CREATE CLASS FEE STRUCTURE
// =====================================================

exports.createStructure = async (req, res) => {
    const { academicYearId, className } = req.body;

    if (!academicYearId || !className || !className.trim()) {
        return res.status(400).json({ success: false, message: "Academic year and class name are required." });
    }

    try {
        const cleanName = className.trim();
        const existing = await get(
            `SELECT id FROM class_fee_structures WHERE academicYearId = ? AND className = ?`,
            [academicYearId, cleanName]
        );

        if (existing) {
            return res.status(409).json({ success: false, message: "Fee structure for this class already exists." });
        }

        const result = await run(
            `INSERT INTO class_fee_structures (academicYearId, className) VALUES (?, ?)`,
            [academicYearId, cleanName]
        );

        const newStructure = await get(
            `SELECT id, academicYearId, className, 0 AS totalAmount FROM class_fee_structures WHERE id = ?`,
            [result.lastID]
        );

        res.status(201).json({ success: true, structure: newStructure, message: "Fee structure created." });
    } catch (error) {
        console.error("Error creating structure:", error);
        res.status(500).json({ success: false, message: "Unable to create fee structure." });
    }
};

// =====================================================
// GET SINGLE STRUCTURE
// =====================================================

exports.getStructure = async (req, res) => {
    const id = Number(req.params.id);

    if (!id || id <= 0) {
        return res.status(400).json({ success: false, message: "Invalid fee structure." });
    }

    try {
        const structure = await get(
            `
            SELECT cfs.*, ay.name AS academicYearName, ay.status AS academicYearStatus
            FROM class_fee_structures cfs
            INNER JOIN academic_years ay ON ay.id = cfs.academicYearId
            WHERE cfs.id = ?
            `,
            [id]
        );

        if (!structure) {
            return res.status(404).json({ success: false, message: "Fee structure not found." });
        }

        // Pulls all fee components so you can see them even if they are empty
        const items = await all(
            `
            SELECT 
                cfi.id, 
                COALESCE(cfi.amount, 0) AS amount, 
                fc.id AS componentId, 
                fc.componentKey, 
                fc.componentName, 
                fc.sortOrder, 
                fc.isOptional
            FROM fee_components fc
            LEFT JOIN class_fee_items cfi 
                ON cfi.componentId = fc.id AND cfi.structureId = ?
            ORDER BY fc.sortOrder
            `,
            [id]
        );

        res.json({ structure, items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load fee structure." });
    }
};

// =====================================================
// UPDATE CLASS FEE STRUCTURE
// =====================================================

exports.updateStructure = async (req, res) => {
    const structureId = Number(req.params.id);

    if (!structureId || structureId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid fee structure." });
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];

    try {
        const structure = await get(
            `
            SELECT cfs.*, ay.status AS yearStatus, ay.name AS yearName
            FROM class_fee_structures cfs
            INNER JOIN academic_years ay ON ay.id = cfs.academicYearId
            WHERE cfs.id = ?
            `,
            [structureId]
        );

        if (!structure) {
            return res.status(404).json({ success: false, message: "Fee structure not found." });
        }

        if (structure.yearStatus === "closed") {
            return res.status(409).json({ success: false, message: "Closed fee structures cannot be modified." });
        }

        for (const item of items) {
            const componentId = Number(item.componentId);
            const amount = Number(item.amount);

            if (!componentId || !Number.isFinite(amount) || amount < 0) continue;

            await run(
                `
                INSERT INTO class_fee_items (structureId, componentId, amount) 
                VALUES (?, ?, ?)
                ON CONFLICT(structureId, componentId) 
                DO UPDATE SET amount = excluded.amount
                `,
                [structureId, componentId, amount]
            );
        }

        await run(`UPDATE class_fee_structures SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [structureId]);

        await safeLogAudit({
            userId: req.user?.id || null,
            action: "FEE_STRUCTURE_UPDATED",
            entityType: "fee_structure",
            entityId: structureId,
            details: { academicYear: structure.yearName, className: structure.className }
        });

        res.json({ success: true, message: "Fee structure updated successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to update fee structure." });
    }
};

// =====================================================
// COPY STRUCTURE TO ANOTHER YEAR
// =====================================================

exports.copyStructure = async (req, res) => {
    const structureId = Number(req.params.id);
    const targetYearId = Number(req.params.targetYearId);

    if (!structureId || !targetYearId) return res.status(400).json({ success: false, message: "Invalid data." });

    try {
        const source = await get(`SELECT * FROM class_fee_structures WHERE id = ?`, [structureId]);
        const targetYear = await get(`SELECT * FROM academic_years WHERE id = ?`, [targetYearId]);

        if (!source || !targetYear) return res.status(404).json({ success: false, message: "Record not found." });
        if (targetYear.status === "closed") return res.status(409).json({ success: false, message: "Target year closed." });
        if (source.academicYearId === targetYearId) return res.status(400).json({ success: false, message: "Same year." });

        const existing = await get(
            `SELECT id FROM class_fee_structures WHERE academicYearId = ? AND className = ?`,
            [targetYearId, source.className]
        );

        let targetId = existing?.id;

        if (!targetId) {
            const result = await run(
                `INSERT INTO class_fee_structures (academicYearId, className) VALUES (?, ?)`,
                [targetYearId, source.className]
            );
            targetId = result.lastID;
        }

        const sourceItems = await all(`SELECT componentId, amount FROM class_fee_items WHERE structureId = ?`, [structureId]);

        for (const item of sourceItems) {
            await run(
                `INSERT INTO class_fee_items (structureId, componentId, amount) VALUES (?, ?, ?)
                 ON CONFLICT(structureId, componentId) DO UPDATE SET amount = excluded.amount`,
                [targetId, item.componentId, item.amount]
            );
        }

        await safeLogAudit({
            userId: req.user?.id || null,
            action: "FEE_STRUCTURE_COPIED",
            entityType: "fee_structure",
            entityId: targetId,
            details: { sourceStructureId: structureId, targetYear: targetYear.name, className: source.className }
        });

        res.json({ success: true, id: targetId, message: "Fee structure copied." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to copy fee structure." });
    }
};

// =====================================================
// PREPARE STUDENTS FOR AN ACADEMIC YEAR
// =====================================================

exports.prepareAcademicYear = async (req, res) => {
    const academicYearId = Number(req.params.id);

    if (!academicYearId || academicYearId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid academic year." });
    }

    try {
        const year = await get(`SELECT * FROM academic_years WHERE id = ?`, [academicYearId]);
        if (!year) return res.status(404).json({ success: false, message: "Academic year not found." });
        if (year.status === "closed") return res.status(409).json({ success: false, message: "Year closed." });

        const students = await all(`SELECT * FROM students WHERE (status IS NULL OR status = 'active')`);
        let created = 0;
        let updated = 0;

        for (const student of students) {
            let enrollment = await get(
                `SELECT id FROM student_enrollments WHERE studentId = ? AND academicYearId = ?`,
                [student.id, academicYearId]
            );
            
            let accountId;

            // 1. Create enrollment and account if they don't exist
            if (!enrollment) {
                if (student.rollNumber) {
                    const conflict = await get(
                        `SELECT id FROM student_enrollments WHERE academicYearId = ? AND className = ? AND rollNumber = ?`,
                        [academicYearId, student.className, student.rollNumber]
                    );
                    if (conflict) continue;
                }

                const enrollmentResult = await run(
                    `INSERT INTO student_enrollments (studentId, academicYearId, className, rollNumber, status) VALUES (?, ?, ?, ?, 'active')`,
                    [student.id, academicYearId, student.className, student.rollNumber || null]
                );

                const accountResult = await run(
                    `INSERT INTO student_fee_accounts (enrollmentId, status) VALUES (?, 'active')`,
                    [enrollmentResult.lastID]
                );
                accountId = accountResult.lastID;
                created++;
            } else {
                const account = await get(`SELECT id FROM student_fee_accounts WHERE enrollmentId = ?`, [enrollment.id]);
                if (account) accountId = account.id;
            }

            // 2. SYNC FEES: Ensure the student has the latest class fee items
            if (accountId) {
                const structure = await get(
                    `SELECT id FROM class_fee_structures WHERE academicYearId = ? AND className = ?`,
                    [academicYearId, student.className]
                );

                if (structure) {
                    const structureItems = await all(`SELECT componentId, amount FROM class_fee_items WHERE structureId = ?`, [structure.id]);
                    
                    for (const item of structureItems) {
                        const existingItem = await get(
                            `SELECT id FROM student_fee_items WHERE feeAccountId = ? AND componentId = ?`,
                            [accountId, item.componentId]
                        );

                        if (!existingItem) {
                            await run(
                                `INSERT INTO student_fee_items (feeAccountId, componentId, amount, itemType) VALUES (?, ?, ?, 'standard')`,
                                [accountId, item.componentId, item.amount]
                            );
                        } else {
                            // Update existing standard fees in case the master price changed
                            await run(
                                `UPDATE student_fee_items SET amount = ? WHERE id = ? AND itemType = 'standard'`,
                                [item.amount, existingItem.id]
                            );
                        }
                    }
                    updated++;
                }
            }
        }

        await safeLogAudit({
            userId: req.user?.id || null,
            action: "ACADEMIC_YEAR_PREPARED",
            entityType: "academic_year",
            entityId: academicYearId,
            details: { year: year.name, accountsCreated: created, accountsSynced: updated }
        });

        res.json({ success: true, created, message: `System prepared ${created} new accounts and synced prices for existing accounts.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to prepare academic year." });
    }
};

// =====================================================
// STUDENT FEE ACCOUNT
// =====================================================

exports.getStudentFeeAccount = async (req, res) => {
    const studentId = Number(req.params.studentId);
    const requestedYearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;

    if (!studentId || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student." });

    try {
        let year;
        if (requestedYearId) {
            year = await get(`SELECT * FROM academic_years WHERE id = ?`, [requestedYearId]);
        } else {
            year = await get(`SELECT * FROM academic_years WHERE status = 'active' LIMIT 1`);
        }

        if (!year) return res.status(404).json({ success: false, message: "Academic year not found." });

        const account = await get(
            `
            SELECT sfa.id, sfa.status, se.studentId, se.className, se.rollNumber, ay.id AS academicYearId, ay.name AS academicYearName, s.studentName
            FROM student_fee_accounts sfa
            INNER JOIN student_enrollments se ON se.id = sfa.enrollmentId
            INNER JOIN academic_years ay ON ay.id = se.academicYearId
            INNER JOIN students s ON s.id = se.studentId
            WHERE se.studentId = ? AND se.academicYearId = ?
            LIMIT 1
            `,
            [studentId, year.id]
        );

        if (!account) return res.status(404).json({ success: false, message: "Account not prepared." });

        const items = await all(
            `
            SELECT sfi.id, sfi.amount, sfi.itemType, sfi.description, fc.componentKey, fc.componentName, fc.sortOrder
            FROM student_fee_items sfi
            INNER JOIN fee_components fc ON fc.id = sfi.componentId
            WHERE sfi.feeAccountId = ?
            ORDER BY fc.sortOrder
            `,
            [account.id]
        );

        const payments = await all(
            `
            SELECT * FROM payments WHERE feeAccountId = ? AND (status IS NULL OR status != 'reversed')
            ORDER BY paymentDate DESC, id DESC
            `,
            [account.id]
        );

        const totalFee = items.reduce((total, item) => total + Number(item.amount || 0), 0);
        const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
        const balance = Math.max(0, totalFee - totalPaid);

        res.json({ account, items, payments, totalFee, totalPaid, balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load student fee account." });
    }
};