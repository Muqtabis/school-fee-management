const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// =====================================================
// DATABASE
// =====================================================

const dataDir = path.join(__dirname, "data");
const databasePath = path.join(dataDir, "school.db");

const db = new sqlite3.Database(
    databasePath,
    (err) => {
        if (err) {
            console.error("Database Connection Error:", err.message);
        } else {
            console.log("Connected to SQLite Database");
        }
    }
);

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
    const columns = await all(
        `PRAGMA table_info(${tableName})`
    );

    return columns.some(
        column => column.name === columnName
    );
}

async function addColumnIfMissing(
    tableName,
    columnName,
    definition
) {
    const exists = await columnExists(
        tableName,
        columnName
    );

    if (exists) {
        return;
    }

    await run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${columnName} ${definition}
    `);

    console.log(
        `Added ${columnName} to ${tableName}`
    );
}

// =====================================================
// FOREIGN KEYS
// =====================================================

db.run(
    "PRAGMA foreign_keys = ON"
);

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initializeDatabase() {
    try {
        // =================================================
        // STUDENTS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS students (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                studentName TEXT NOT NULL,

                rollNumber TEXT,

                className TEXT NOT NULL,

                fatherName TEXT,

                contact1 TEXT,

                previousDues REAL DEFAULT 0,

                tuitionFee REAL DEFAULT 0,

                status TEXT NOT NULL
                    DEFAULT 'active',

                archivedAt TEXT,

                archivedBy INTEGER,

                archiveReason TEXT
            )
        `);

        // =================================================
        // USERS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS users (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                email TEXT UNIQUE NOT NULL,

                password TEXT NOT NULL,

                role TEXT DEFAULT 'admin',

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // =================================================
        // ACADEMIC YEARS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS academic_years (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT UNIQUE NOT NULL,

                status TEXT NOT NULL
                    DEFAULT 'upcoming',

                startDate TEXT,

                endDate TEXT,

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // =================================================
        // FEE COMPONENTS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS fee_components (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                componentKey TEXT UNIQUE NOT NULL,

                componentName TEXT NOT NULL,

                sortOrder INTEGER
                    DEFAULT 0,

                isOptional INTEGER
                    DEFAULT 0
            )
        `);

        // =================================================
        // CLASS FEE STRUCTURES
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS class_fee_structures (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                academicYearId INTEGER NOT NULL,

                className TEXT NOT NULL,

                updatedAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(
                    academicYearId,
                    className
                ),

                FOREIGN KEY(academicYearId)
                    REFERENCES academic_years(id)
            )
        `);

        // =================================================
        // CLASS FEE ITEMS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS class_fee_items (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                structureId INTEGER NOT NULL,

                componentId INTEGER NOT NULL,

                amount REAL NOT NULL
                    DEFAULT 0,

                UNIQUE(
                    structureId,
                    componentId
                ),

                FOREIGN KEY(structureId)
                    REFERENCES class_fee_structures(id)
                    ON DELETE CASCADE,

                FOREIGN KEY(componentId)
                    REFERENCES fee_components(id)
            )
        `);

        // =================================================
        // STUDENT ENROLLMENTS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS student_enrollments (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                studentId INTEGER NOT NULL,

                academicYearId INTEGER NOT NULL,

                className TEXT NOT NULL,

                rollNumber TEXT,

                status TEXT NOT NULL
                    DEFAULT 'active',

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(
                    studentId,
                    academicYearId
                ),

                FOREIGN KEY(studentId)
                    REFERENCES students(id),

                FOREIGN KEY(academicYearId)
                    REFERENCES academic_years(id)
            )
        `);

        // =================================================
        // STUDENT FEE ACCOUNTS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS student_fee_accounts (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                enrollmentId INTEGER NOT NULL UNIQUE,

                status TEXT NOT NULL
                    DEFAULT 'active',

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(enrollmentId)
                    REFERENCES student_enrollments(id)
                    ON DELETE CASCADE
            )
        `);

        // =================================================
        // STUDENT FEE ITEMS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS student_fee_items (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                feeAccountId INTEGER NOT NULL,

                componentId INTEGER NOT NULL,

                amount REAL NOT NULL
                    DEFAULT 0,

                itemType TEXT
                    DEFAULT 'standard',

                description TEXT,

                FOREIGN KEY(feeAccountId)
                    REFERENCES student_fee_accounts(id)
                    ON DELETE CASCADE,

                FOREIGN KEY(componentId)
                    REFERENCES fee_components(id)
            )
        `);

        // =================================================
        // PAYMENTS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS payments (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                studentId INTEGER,

                feeAccountId INTEGER,

                paymentDate TEXT,

                amount REAL,

                paymentMode TEXT,

                remarks TEXT,

                status TEXT NOT NULL
                    DEFAULT 'completed',

                voidedAt TEXT,

                voidedBy INTEGER,

                voidReason TEXT,

                FOREIGN KEY(studentId)
                    REFERENCES students(id),

                FOREIGN KEY(feeAccountId)
                    REFERENCES student_fee_accounts(id)
            )
        `);

        // =================================================
        // NOTIFICATIONS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS notifications (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                studentId INTEGER,

                paymentId INTEGER,

                phoneNumber TEXT,

                message TEXT,

                notificationType TEXT
                    DEFAULT 'SMS',

                status TEXT
                    DEFAULT 'pending',

                provider TEXT
                    DEFAULT 'MSG91',

                sentAt DATETIME,

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(studentId)
                    REFERENCES students(id),

                FOREIGN KEY(paymentId)
                    REFERENCES payments(id)
            )
        `);

        // =================================================
        // EXPENSES
        // =================================================

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

                status TEXT NOT NULL
                    DEFAULT 'completed',

                voidedAt TEXT,

                voidedBy INTEGER,

                voidReason TEXT,

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // =================================================
        // AUDIT LOGS
        // =================================================

        await run(`
            CREATE TABLE IF NOT EXISTS audit_logs (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                userId INTEGER,

                action TEXT NOT NULL,

                entityType TEXT NOT NULL,

                entityId INTEGER,

                details TEXT,

                createdAt DATETIME
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // =================================================
        // MIGRATIONS
        // =================================================

        await migrateDatabase();

        // =================================================
        // DEFAULT FEE COMPONENTS
        // =================================================

        await seedFeeComponents();

        // =================================================
        // INDEXES
        // =================================================

        await createIndexes();

        console.log(
            "Database initialization completed."
        );

    } catch (error) {
        console.error(
            "Database initialization failed:",
            error
        );

        throw error;
    }
}

// =====================================================
// MIGRATIONS
// =====================================================

async function migrateDatabase() {

    await addColumnIfMissing(
        "students",
        "rollNumber",
        "TEXT"
    );

    await addColumnIfMissing(
        "students",
        "status",
        "TEXT NOT NULL DEFAULT 'active'"
    );

    await addColumnIfMissing(
        "students",
        "archivedAt",
        "TEXT"
    );

    await addColumnIfMissing(
        "students",
        "archivedBy",
        "INTEGER"
    );

    await addColumnIfMissing(
        "students",
        "archiveReason",
        "TEXT"
    );

    await addColumnIfMissing(
        "payments",
        "feeAccountId",
        "INTEGER"
    );

    await addColumnIfMissing(
        "payments",
        "remarks",
        "TEXT"
    );

    await addColumnIfMissing(
        "payments",
        "status",
        "TEXT NOT NULL DEFAULT 'completed'"
    );

    await addColumnIfMissing(
        "payments",
        "voidedAt",
        "TEXT"
    );

    await addColumnIfMissing(
        "payments",
        "voidedBy",
        "INTEGER"
    );

    await addColumnIfMissing(
        "payments",
        "voidReason",
        "TEXT"
    );

    await addColumnIfMissing(
        "expenses",
        "status",
        "TEXT NOT NULL DEFAULT 'completed'"
    );

    await addColumnIfMissing(
        "expenses",
        "voidedAt",
        "TEXT"
    );

    await addColumnIfMissing(
        "expenses",
        "voidedBy",
        "INTEGER"
    );

    await addColumnIfMissing(
        "expenses",
        "voidReason",
        "TEXT"
    );

    await run(`
        UPDATE students
        SET status = 'active'
        WHERE status IS NULL
        OR status = ''
    `);

    await run(`
        UPDATE payments
        SET status = 'completed'
        WHERE status IS NULL
        OR status = ''
    `);

    await run(`
        UPDATE expenses
        SET status = 'completed'
        WHERE status IS NULL
        OR status = ''
    `);
}

// =====================================================
// DEFAULT FEE COMPONENTS
// =====================================================

async function seedFeeComponents() {

    const components = [
        ["tuition", "Tuition Fee", 1, 0],
        ["admission", "Admission Fee", 2, 0],
        ["transport", "Transport Fee", 3, 1],
        ["books", "Books Fee", 4, 1],
        ["uniform", "Uniform Fee", 5, 1],
        ["exam", "Exam Fee", 6, 1],
        ["activity", "Activity Fee", 7, 1]
    ];

    for (const component of components) {

        await run(
            `
            INSERT OR IGNORE INTO fee_components
            (
                componentKey,
                componentName,
                sortOrder,
                isOptional
            )
            VALUES (?, ?, ?, ?)
            `,
            component
        );
    }
}

// =====================================================
// INDEXES
// =====================================================

async function createIndexes() {

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_students_status
        ON students(status)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_students_roll
        ON students(rollNumber)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_enrollment_student_year
        ON student_enrollments(
            studentId,
            academicYearId
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_enrollment_year
        ON student_enrollments(
            academicYearId
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_fee_account_enrollment
        ON student_fee_accounts(
            enrollmentId
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_fee_items_account
        ON student_fee_items(
            feeAccountId
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_payments_student
        ON payments(studentId)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_payments_account
        ON payments(feeAccountId)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_payments_date
        ON payments(paymentDate)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_payments_status
        ON payments(status)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_expenses_date
        ON expenses(expenseDate)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_expenses_status
        ON expenses(status)
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_audit_entity
        ON audit_logs(
            entityType,
            entityId
        )
    `);
}

// =====================================================
// EXPORT
// =====================================================

module.exports = db;

module.exports.initializeDatabase =
    initializeDatabase;