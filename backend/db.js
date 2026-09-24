const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// =====================================================
// DATABASE PATH SETUP
// =====================================================

const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Default DB lives in backend/data/school.db. An optional SCHOOL_DB_PATH env
// override lets tests / tooling point at an isolated database without touching
// real data; unset (the normal case) keeps the exact original path.
const databasePath = process.env.SCHOOL_DB_PATH
    ? path.resolve(process.env.SCHOOL_DB_PATH)
    : path.join(dataDir, "school.db");

const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error("Database Connection Error:", err.message);
    } else {
        console.log("Connected to SQLite Database");
        initializeDatabase();
    }
});

// =====================================================
// PRODUCTION PRAGMAS (CONCURRENCY & INTEGRITY)
// =====================================================

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA busy_timeout = 5000;");
    db.run("PRAGMA synchronous = NORMAL;");
});

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

async function columnExists(tableName, columnName) {
    const columns = await all(`PRAGMA table_info(${tableName})`);
    return columns.some((column) => column.name === columnName);
}

async function addColumnIfMissing(tableName, columnName, definition) {
    // Primary guard: only ALTER when PRAGMA table_info shows the column is absent.
    const exists = await columnExists(tableName, columnName);
    if (exists) return;

    try {
        await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`Added ${columnName} to ${tableName}`);
    } catch (err) {
        // Safety net for the check-then-act race: between columnExists() above
        // and this ALTER, another concurrent boot (or a re-entrant migration)
        // can add the same column. SQLite then reports "duplicate column name".
        // The column is present either way — the desired end state — so treat
        // that specific error as a no-op instead of crashing initialization.
        // Any other error is a real migration failure and is re-thrown.
        if (/duplicate column name/i.test(err && err.message)) {
            return;
        }
        throw err;
    }
}

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initializeDatabase() {
    try {
        console.log("Starting database initialization...");

        // STUDENTS
        await run(`
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admissionNumber TEXT,
                satsNumber TEXT,
                rollNumber TEXT,
                studentName TEXT NOT NULL,
                className TEXT NOT NULL,
                gender TEXT,
                dob TEXT,
                fatherName TEXT,
                motherName TEXT,
                contact1 TEXT,
                contact2 TEXT,
                address TEXT,
                remark TEXT,
                previousDues REAL DEFAULT 0,
                tuitionFee REAL DEFAULT 0,
                concessionAmount REAL DEFAULT 0,
                concessionReason TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                archivedAt TEXT,
                archivedBy INTEGER,
                archiveReason TEXT
            )
        `);

        // CLASSES
        await run(`
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                className TEXT NOT NULL,
                section TEXT,
                isLocked INTEGER NOT NULL DEFAULT 1,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // USERS
        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ACADEMIC YEARS
        await run(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'upcoming',
                startDate TEXT,
                endDate TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // FEE COMPONENTS
        await run(`
            CREATE TABLE IF NOT EXISTS fee_components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                componentKey TEXT UNIQUE NOT NULL,
                componentName TEXT NOT NULL,
                sortOrder INTEGER DEFAULT 0,
                isOptional INTEGER DEFAULT 0
            )
        `);

        // CLASS FEE STRUCTURES
        await run(`
            CREATE TABLE IF NOT EXISTS class_fee_structures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                academicYearId INTEGER NOT NULL,
                className TEXT NOT NULL,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(academicYearId, className),
                FOREIGN KEY(academicYearId) REFERENCES academic_years(id)
            )
        `);

        // CLASS FEE ITEMS
        await run(`
            CREATE TABLE IF NOT EXISTS class_fee_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                structureId INTEGER NOT NULL,
                componentId INTEGER NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                UNIQUE(structureId, componentId),
                FOREIGN KEY(structureId) REFERENCES class_fee_structures(id) ON DELETE CASCADE,
                FOREIGN KEY(componentId) REFERENCES fee_components(id)
            )
        `);

        // STUDENT ENROLLMENTS
        await run(`
            CREATE TABLE IF NOT EXISTS student_enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER NOT NULL,
                academicYearId INTEGER NOT NULL,
                className TEXT NOT NULL,
                rollNumber TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(studentId, academicYearId),
                FOREIGN KEY(studentId) REFERENCES students(id),
                FOREIGN KEY(academicYearId) REFERENCES academic_years(id)
            )
        `);

        // STUDENT FEE ACCOUNTS
        await run(`
            CREATE TABLE IF NOT EXISTS student_fee_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                enrollmentId INTEGER NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'active',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(enrollmentId) REFERENCES student_enrollments(id) ON DELETE CASCADE
            )
        `);

        // STUDENT FEE ITEMS
        await run(`
            CREATE TABLE IF NOT EXISTS student_fee_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feeAccountId INTEGER NOT NULL,
                componentId INTEGER NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                itemType TEXT DEFAULT 'standard',
                description TEXT,
                FOREIGN KEY(feeAccountId) REFERENCES student_fee_accounts(id) ON DELETE CASCADE,
                FOREIGN KEY(componentId) REFERENCES fee_components(id)
            )
        `);

        // PAYMENTS
        await run(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER,
                feeAccountId INTEGER,
                paymentDate TEXT,
                amount REAL,
                paymentMode TEXT,
                remarks TEXT,
                status TEXT NOT NULL DEFAULT 'completed',
                voidedAt TEXT,
                voidedBy INTEGER,
                voidReason TEXT,
                FOREIGN KEY(studentId) REFERENCES students(id),
                FOREIGN KEY(feeAccountId) REFERENCES student_fee_accounts(id)
            )
        `);

        // PAYMENT LINE ITEMS (NEW - Stores individual checkbox fee allocations safely)
        await run(`
            CREATE TABLE IF NOT EXISTS payment_line_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paymentId INTEGER NOT NULL,
                componentName TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY(paymentId) REFERENCES payments(id) ON DELETE CASCADE
            )
        `);

        // NOTIFICATIONS
        await run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER,
                paymentId INTEGER,
                phoneNumber TEXT,
                message TEXT,
                notificationType TEXT DEFAULT 'SMS',
                status TEXT DEFAULT 'pending',
                provider TEXT DEFAULT 'MSG91',
                sentAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(studentId) REFERENCES students(id),
                FOREIGN KEY(paymentId) REFERENCES payments(id)
            )
        `);

        // EXPENSES
        await run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expenseName TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                expenseDate TEXT NOT NULL,
                paymentMode TEXT NOT NULL,
                paidTo TEXT,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'completed',
                voidedAt TEXT,
                voidedBy INTEGER,
                voidReason TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // EXPENSE CATEGORIES (dynamic, admin-managed)
        await run(`
            CREATE TABLE IF NOT EXISTS expense_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                categoryName TEXT UNIQUE NOT NULL,
                sortOrder INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed the default categories once, so existing dropdowns keep working.
        const existingCategories = await all(`SELECT COUNT(*) AS c FROM expense_categories`);
        if (!existingCategories.length || existingCategories[0].c === 0) {
            const defaults = [
                "Salary", "Electricity", "Water", "Internet", "Stationery",
                "Maintenance", "Transport", "School Supplies", "Events",
                "Rent", "Repairs", "Other"
            ];
            for (let i = 0; i < defaults.length; i++) {
                await run(
                    `INSERT OR IGNORE INTO expense_categories (categoryName, sortOrder) VALUES (?, ?)`,
                    [defaults[i], i]
                );
            }
        }

        // AUDIT LOGS
        await run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                action TEXT NOT NULL,
                entityType TEXT NOT NULL,
                entityId INTEGER,
                details TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // PASSWORD RESET TOKENS
        await run(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                tokenHash TEXT NOT NULL,
                expiresAt DATETIME NOT NULL,
                usedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // USER PAGE ACCESS
        // One row per (user, page) the user is allowed to open.
        // Admin bypasses this table entirely (always full access).
        await run(`
            CREATE TABLE IF NOT EXISTS user_page_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                pageKey TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(userId, pageKey),
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // =====================================================
        // EXAMINATION & RESULTS
        // =====================================================

        // SUBJECTS — one row per subject offered in a class.
        await run(`
            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                className TEXT NOT NULL,
                subjectName TEXT NOT NULL,
                maxMarks REAL NOT NULL DEFAULT 100,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(className, subjectName)
            )
        `);

        // TEACHER ASSIGNMENTS — which class each teacher handles.
        await run(`
            CREATE TABLE IF NOT EXISTS teacher_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacherId INTEGER NOT NULL,
                className TEXT NOT NULL,
                assignedBy INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacherId, className),
                FOREIGN KEY(teacherId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // EXAMS — an exam belongs to one class and moves through
        // open -> locked -> published.
        await run(`
            CREATE TABLE IF NOT EXISTS exams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examName TEXT NOT NULL,
                className TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                createdBy INTEGER,
                lockedBy INTEGER,
                lockedAt DATETIME,
                publishedBy INTEGER,
                publishedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // EXAM MARKS — one row per (exam, student, subject).
        await run(`
            CREATE TABLE IF NOT EXISTS exam_marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                subjectId INTEGER NOT NULL,
                marksObtained REAL,
                isAbsent INTEGER NOT NULL DEFAULT 0,
                updatedBy INTEGER,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(examId, studentId, subjectId),
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(studentId) REFERENCES students(id),
                FOREIGN KEY(subjectId) REFERENCES subjects(id)
            )
        `);

        // RESULT NOTIFICATIONS — one row per marksheet send attempt.
        // Kept separate from the fee "notifications" table so the
        // existing notifications UI is untouched.
        await run(`
            CREATE TABLE IF NOT EXISTS result_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                phoneNumber TEXT,
                channel TEXT DEFAULT 'whatsapp',
                status TEXT DEFAULT 'pending',
                provider TEXT,
                providerMessageId TEXT,
                mediaPath TEXT,
                error TEXT,
                sentAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(studentId) REFERENCES students(id)
            )
        `);

        // TEACHER ATTENDANCE — one row per (teacher, day).
        await run(`
            CREATE TABLE IF NOT EXISTS teacher_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacherId INTEGER NOT NULL,
                attendanceDate TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'present',
                remark TEXT,
                markedBy INTEGER,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacherId, attendanceDate),
                FOREIGN KEY(teacherId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(markedBy) REFERENCES users(id)
            )
        `);

        // EXAM SUBJECTS — per-exam max marks override. Seeded from the class
        // subjects when an exam is created; lets one exam score a subject out
        // of a different max than the class default (e.g. a /25 unit test).
        await run(`
            CREATE TABLE IF NOT EXISTS exam_subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                subjectId INTEGER NOT NULL,
                maxMarks REAL NOT NULL DEFAULT 100,
                UNIQUE(examId, subjectId),
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
            )
        `);

        // STUDENT ATTENDANCE — one row per (student, day). Marked by the
        // class teacher of the student's class (or admin).
        await run(`
            CREATE TABLE IF NOT EXISTS student_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentId INTEGER NOT NULL,
                className TEXT NOT NULL,
                attendanceDate TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'present',
                remark TEXT,
                markedBy INTEGER,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(studentId, attendanceDate),
                FOREIGN KEY(studentId) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY(markedBy) REFERENCES users(id)
            )
        `);

        // GRADING SCALES — admin-configurable grade bands. A default scale is
        // seeded on first boot; exam definitions may reference a specific scale
        // or fall back to the default. Grade lookup uses minPercent (highest
        // band whose minPercent <= percentage), so boundaries never fall in a
        // gap; maxPercent is retained for display only.
        await run(`
            CREATE TABLE IF NOT EXISTS grading_scales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                isDefault INTEGER NOT NULL DEFAULT 0,
                createdBy INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await run(`
            CREATE TABLE IF NOT EXISTS grading_bands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scaleId INTEGER NOT NULL,
                grade TEXT NOT NULL,
                minPercent REAL NOT NULL,
                maxPercent REAL NOT NULL DEFAULT 100,
                ordinal INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(scaleId) REFERENCES grading_scales(id) ON DELETE CASCADE
            )
        `);

        // EXAM DEFINITIONS — the parent "exam" that can span many classes
        // (e.g. "Term 1" for classes 5-10). Each class still gets its own child
        // row in `exams` carrying that class's subjects, marks, schedule and
        // results; siblings share this definition's type, year and dates.
        await run(`
            CREATE TABLE IF NOT EXISTS exam_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                examType TEXT NOT NULL DEFAULT 'other',
                academicYearId INTEGER,
                startDate TEXT,
                endDate TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                gradingScaleId INTEGER,
                createdBy INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(academicYearId) REFERENCES academic_years(id),
                FOREIGN KEY(gradingScaleId) REFERENCES grading_scales(id)
            )
        `);

        // EXAM RESULTS — the official published result snapshot per student, so
        // academic history does not depend on regenerating PDFs. Written when
        // an exam is published; version increments when a correction is applied.
        await run(`
            CREATE TABLE IF NOT EXISTS exam_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                totalObtained REAL NOT NULL DEFAULT 0,
                totalMax REAL NOT NULL DEFAULT 0,
                percentage REAL NOT NULL DEFAULT 0,
                grade TEXT,
                overallStatus TEXT NOT NULL DEFAULT 'pass',
                version INTEGER NOT NULL DEFAULT 1,
                publishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(examId, studentId),
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(studentId) REFERENCES students(id)
            )
        `);
        await run(`
            CREATE TABLE IF NOT EXISTS exam_result_subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resultId INTEGER NOT NULL,
                subjectId INTEGER,
                subjectName TEXT NOT NULL,
                maxMarks REAL NOT NULL DEFAULT 0,
                passMarks REAL,
                marksObtained REAL,
                markStatus TEXT NOT NULL DEFAULT 'present',
                grade TEXT,
                subjectPass INTEGER,
                FOREIGN KEY(resultId) REFERENCES exam_results(id) ON DELETE CASCADE
            )
        `);

        // MARK CORRECTIONS — audit trail for changes to marks after an exam is
        // locked or published. Published academic history is never silently
        // overwritten: every change records old/new value, who and why.
        await run(`
            CREATE TABLE IF NOT EXISTS mark_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                studentId INTEGER NOT NULL,
                subjectId INTEGER NOT NULL,
                oldMarks REAL,
                newMarks REAL,
                oldStatus TEXT,
                newStatus TEXT,
                reason TEXT,
                changedBy INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(studentId) REFERENCES students(id),
                FOREIGN KEY(subjectId) REFERENCES subjects(id)
            )
        `);

        // EXAM SUBJECT COMPONENTS — future-facing structure for split
        // assessments (e.g. Theory 80 + Practical 20). The schema exists so
        // components can be added later without a breaking migration; the
        // current marks UI still scores each subject as a single total.
        await run(`
            CREATE TABLE IF NOT EXISTS exam_subject_components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                examId INTEGER NOT NULL,
                subjectId INTEGER NOT NULL,
                componentName TEXT NOT NULL,
                maxMarks REAL NOT NULL DEFAULT 0,
                passMarks REAL,
                ordinal INTEGER NOT NULL DEFAULT 0,
                UNIQUE(examId, subjectId, componentName),
                FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
            )
        `);

        // SUBJECT TEACHER ASSIGNMENTS — the standing (non-exam) link that makes
        // a teacher the subject teacher for one subject of one class. This is the
        // source of truth for "who may enter marks for Class 8-A Mathematics".
        // A subject row already belongs to exactly one class, so subjectId alone
        // identifies the class+subject; UNIQUE(subjectId) enforces one subject
        // teacher per class+subject (admin may reassign, which replaces it).
        // Class-teacher assignment stays in teacher_assignments.role; being a
        // class teacher does NOT grant subject marks access.
        await run(`
            CREATE TABLE IF NOT EXISTS subject_teacher_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacherId INTEGER NOT NULL,
                subjectId INTEGER NOT NULL,
                assignedBy INTEGER,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(subjectId),
                FOREIGN KEY(teacherId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
            )
        `);

        // Run migrations & seeders
        await migrateDatabase();
        await seedFeeComponents();
        await seedPageAccess();
        await seedGradingScale();
        await backfillExamDefinitions();
        await backfillSubjectTeachers();
        await createIndexes();

        console.log("Database initialization completed.");
    } catch (error) {
        console.error("Database initialization failed:", error);
        throw error;
    }
}

// =====================================================
// MIGRATIONS
// =====================================================

async function migrateDatabase() {
    await addColumnIfMissing("classes", "section", "TEXT");
    await addColumnIfMissing("classes", "createdAt", "DATETIME");
    await run(`UPDATE classes SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL`);

    // Classes are locked by default; admin must unlock before delete.
    await addColumnIfMissing("classes", "isLocked", "INTEGER NOT NULL DEFAULT 1");

    await addColumnIfMissing("students", "rollNumber", "TEXT");
    await addColumnIfMissing("students", "contact2", "TEXT");
    await addColumnIfMissing("students", "status", "TEXT NOT NULL DEFAULT 'active'");
    await addColumnIfMissing("students", "archivedAt", "TEXT");
    await addColumnIfMissing("students", "archivedBy", "INTEGER");
    await addColumnIfMissing("students", "archiveReason", "TEXT");

    // NEW PROFILE & FEE MIGRATIONS
    await addColumnIfMissing("students", "admissionNumber", "TEXT");
    await addColumnIfMissing("students", "satsNumber", "TEXT");
    await addColumnIfMissing("students", "motherName", "TEXT");
    await addColumnIfMissing("students", "gender", "TEXT");
    await addColumnIfMissing("students", "dob", "TEXT");
    await addColumnIfMissing("students", "address", "TEXT");
    await addColumnIfMissing("students", "remark", "TEXT");
    await addColumnIfMissing("students", "concessionAmount", "REAL DEFAULT 0");
    await addColumnIfMissing("students", "concessionReason", "TEXT");

    await addColumnIfMissing("payments", "feeAccountId", "INTEGER");
    await addColumnIfMissing("payments", "remarks", "TEXT");
    await addColumnIfMissing("payments", "status", "TEXT NOT NULL DEFAULT 'completed'");
    await addColumnIfMissing("payments", "voidedAt", "TEXT");
    await addColumnIfMissing("payments", "voidedBy", "INTEGER");
    await addColumnIfMissing("payments", "voidReason", "TEXT");

    await addColumnIfMissing("expenses", "status", "TEXT NOT NULL DEFAULT 'completed'");
    await addColumnIfMissing("expenses", "voidedAt", "TEXT");
    await addColumnIfMissing("expenses", "voidedBy", "INTEGER");
    await addColumnIfMissing("expenses", "voidReason", "TEXT");

    // PAGE ACCESS LOCK
    // 0 = admin can edit this user's page access; 1 = frozen until unlocked.
    await addColumnIfMissing("users", "accessLocked", "INTEGER DEFAULT 0");

    // TEACHER ASSIGNMENT ROLE
    // 'subject_teacher' (default) can enter marks for the class; 'class_teacher'
    // additionally owns the class and can mark student attendance for it.
    await addColumnIfMissing("teacher_assignments", "role", "TEXT NOT NULL DEFAULT 'subject_teacher'");

    // =====================================================
    // EXAM MODULE REFINEMENT (Part 1)
    // =====================================================

    // Link each per-class exam row to its parent definition.
    await addColumnIfMissing("exams", "examDefinitionId", "INTEGER");

    // Per-exam/subject configuration: admin-set pass marks, subject-wise
    // schedule, and the subject teacher authorised to enter its marks (when
    // null the marks-entry falls back to class-level teacher assignment).
    await addColumnIfMissing("exam_subjects", "passMarks", "REAL");
    await addColumnIfMissing("exam_subjects", "examDate", "TEXT");
    await addColumnIfMissing("exam_subjects", "startTime", "TEXT");
    await addColumnIfMissing("exam_subjects", "endTime", "TEXT");
    await addColumnIfMissing("exam_subjects", "room", "TEXT");
    await addColumnIfMissing("exam_subjects", "instructions", "TEXT");
    await addColumnIfMissing("exam_subjects", "teacherId", "INTEGER");

    // Richer per-mark status: present | absent | exempted | medical_leave |
    // not_applicable. The legacy isAbsent flag is kept in sync for old code.
    await addColumnIfMissing("exam_marks", "markStatus", "TEXT NOT NULL DEFAULT 'present'");
    await run(`UPDATE exam_marks SET markStatus = 'absent' WHERE isAbsent = 1 AND (markStatus IS NULL OR markStatus = 'present')`);

    // Delivery log lifecycle: retry accounting and delivered/last-attempt state.
    await addColumnIfMissing("result_notifications", "attemptCount", "INTEGER DEFAULT 0");
    await addColumnIfMissing("result_notifications", "deliveredAt", "DATETIME");
    await addColumnIfMissing("result_notifications", "lastAttemptStatus", "TEXT");
    await addColumnIfMissing("result_notifications", "updatedAt", "DATETIME");

    await run(`UPDATE students SET status = 'active' WHERE status IS NULL OR status = ''`);
    await run(`UPDATE payments SET status = 'completed' WHERE status IS NULL OR status = ''`);
    await run(`UPDATE expenses SET status = 'completed' WHERE status IS NULL OR status = ''`);
}

// =====================================================
// DEFAULT FEE COMPONENTS
// =====================================================

async function seedFeeComponents() {
    return Promise.resolve();
}

// =====================================================
// SEED DEFAULT PAGE ACCESS
//
// Runs only when user_page_access is completely empty
// (i.e. the very first boot after this feature ships).
// Grants existing receptionists exactly the pages they
// could reach before, so behavior is unchanged on day one.
//
// Admin is never seeded here (admin always has full
// access via middleware). Once any row exists, this
// never runs again, so it can't overwrite admin's later
// choices.
// =====================================================

async function seedPageAccess() {
    const existing = await all(`SELECT COUNT(*) AS count FROM user_page_access`);

    if (existing[0].count > 0) {
        return;
    }

    // The pages receptionists had access to before this feature.
    const defaultReceptionistPages = [
        "students",
        "fees",
        "payments",
        "expenses",
        "notifications",
        "settings"
    ];

    const receptionists = await all(
        `SELECT id FROM users WHERE role = 'receptionist'`
    );

    if (receptionists.length === 0) {
        return;
    }

    for (const user of receptionists) {
        for (const pageKey of defaultReceptionistPages) {
            await run(
                `INSERT OR IGNORE INTO user_page_access (userId, pageKey) VALUES (?, ?)`,
                [user.id, pageKey]
            );
        }
    }

    console.log(
        `Seeded default page access for ${receptionists.length} receptionist(s).`
    );
}

// =====================================================
// SEED DEFAULT GRADING SCALE
//
// Runs only when grading_scales is empty. Creates one
// "Default" scale with the common A+..F bands so results
// can be graded out of the box. Admin can edit the bands
// or add more scales later; this never overwrites them.
// =====================================================

async function seedGradingScale() {
    const rows = await all(`SELECT COUNT(*) AS c FROM grading_scales`);
    if (rows[0].c > 0) return;

    const res = await run(
        `INSERT INTO grading_scales (name, isDefault) VALUES ('Default', 1)`
    );
    const scaleId = res.lastID;

    // [grade, minPercent, maxPercent(display)]. Lookup is by minPercent.
    const bands = [
        ["A+", 90, 100],
        ["A", 80, 89],
        ["B+", 70, 79],
        ["B", 60, 69],
        ["C", 50, 59],
        ["D", 35, 49],
        ["F", 0, 34]
    ];
    for (let i = 0; i < bands.length; i++) {
        await run(
            `INSERT INTO grading_bands (scaleId, grade, minPercent, maxPercent, ordinal) VALUES (?, ?, ?, ?, ?)`,
            [scaleId, bands[i][0], bands[i][1], bands[i][2], i]
        );
    }
    console.log("Seeded default grading scale.");
}

// =====================================================
// BACKFILL EXAM DEFINITIONS
//
// Exams created before Part 1 have no parent definition.
// Group those orphans by examName and create one definition
// per name, then link the exam rows to it. Runs every boot
// but only touches rows whose examDefinitionId is still NULL,
// so it is idempotent.
// =====================================================

async function backfillExamDefinitions() {
    const orphans = await all(
        `SELECT DISTINCT examName FROM exams WHERE examDefinitionId IS NULL`
    );
    for (const o of orphans) {
        const res = await run(
            `INSERT INTO exam_definitions (name, examType, status) VALUES (?, 'other', 'active')`,
            [o.examName]
        );
        await run(
            `UPDATE exams SET examDefinitionId = ? WHERE examName = ? AND examDefinitionId IS NULL`,
            [res.lastID, o.examName]
        );
    }
    if (orphans.length) {
        console.log(`Backfilled ${orphans.length} exam definition(s) for legacy exams.`);
    }
}

// =====================================================
// BACKFILL SUBJECT TEACHERS
//
// Runs only when subject_teacher_assignments is empty (the
// first boot after this feature ships). Marks authority used
// to fall back to a class-wide 'subject_teacher' assignment
// (which effectively gave a teacher every subject of the
// class). To preserve that access under the new per-subject
// model, each existing class-wide subject_teacher becomes the
// subject teacher for every subject of that class. UNIQUE
// (subjectId) means only one teacher can hold a subject; if two
// legacy teachers shared a class, the first seen keeps it and
// admin can reassign. Guarded on empty so a later admin
// removal is never silently re-added.
// =====================================================

async function backfillSubjectTeachers() {
    const existing = await all(`SELECT COUNT(*) AS c FROM subject_teacher_assignments`);
    if (existing[0].c > 0) return;

    const rows = await all(
        `SELECT ta.teacherId AS teacherId, s.id AS subjectId
         FROM teacher_assignments ta
         JOIN subjects s ON s.className = ta.className
         WHERE ta.role = 'subject_teacher'
         ORDER BY ta.teacherId ASC, s.id ASC`
    );
    let n = 0;
    for (const r of rows) {
        const res = await run(
            `INSERT OR IGNORE INTO subject_teacher_assignments (teacherId, subjectId) VALUES (?, ?)`,
            [r.teacherId, r.subjectId]
        );
        if (res.changes) n++;
    }
    if (n) {
        console.log(`Backfilled ${n} subject-teacher assignment(s) from legacy class-wide assignments.`);
    }
}

// =====================================================
// INDEXES
// =====================================================

async function createIndexes() {
    await run(`CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_students_roll ON students(rollNumber)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_enrollment_student_year ON student_enrollments(studentId, academicYearId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_enrollment_year ON student_enrollments(academicYearId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_fee_account_enrollment ON student_fee_accounts(enrollmentId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_fee_items_account ON student_fee_items(feeAccountId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(studentId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(feeAccountId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(paymentDate)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entityType, entityId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(tokenHash)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(userId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_user_page_access_user ON user_page_access(userId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacherId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON teacher_assignments(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_marks_exam ON exam_marks(examId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(studentId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_result_notifications_exam ON result_notifications(examId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(attendanceDate)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacherId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON exam_subjects(examId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(attendanceDate)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance(studentId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_student_attendance_class ON student_attendance(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_students_class ON students(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_enrollment_class ON student_enrollments(className)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_payments_account_status ON payments(feeAccountId, status)`);

    // Exam module refinement (Part 1)
    await run(`CREATE INDEX IF NOT EXISTS idx_exams_definition ON exams(examDefinitionId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_definitions_year ON exam_definitions(academicYearId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_grading_bands_scale ON grading_bands(scaleId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(examId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(studentId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_result_subjects_result ON exam_result_subjects(resultId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_mark_corrections_exam ON mark_corrections(examId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_subject_components_exam ON exam_subject_components(examId, subjectId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_exam_subjects_teacher ON exam_subjects(teacherId)`);

    // Standing subject-teacher assignments (source of truth for marks access).
    await run(`CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_teacher ON subject_teacher_assignments(teacherId)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_subject ON subject_teacher_assignments(subjectId)`);
}

// =====================================================
// EXPORT
// =====================================================

module.exports = db;
module.exports.runQuery = run;
module.exports.allQuery = all;
module.exports.initializeDatabase = initializeDatabase;