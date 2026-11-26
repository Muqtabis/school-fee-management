require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./db");

const {
    initializeDatabase
} = db;

const {
    authenticateToken
} = require("./middleware/authMiddleware");

const app = express();

// Behind nginx on the Azure VM the app sees one reverse-proxy hop. Trust exactly
// that hop so req.ip resolves to the real client (via X-Forwarded-For) and the
// login/password rate limiters bucket per-client instead of lumping every request
// under nginx's single IP. Trust ONE hop only — never `true` — to avoid letting a
// client spoof X-Forwarded-For past the limiter.
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 5000;

// =====================================================
// CORS (Updated for Azure)
// =====================================================

app.use(
    cors({
        origin: [
           "http://localhost:3000",
            "https://wonderful-hill-06e76ae10.7.azurestaticapps.net", // Your Azure Frontend
            "https://theageschool.org",
            "https://www.theageschool.org"
        ],
        credentials: true
    })
);

// =====================================================
// JSON
// =====================================================

app.use(
    express.json({
        limit: "1mb"
    })
);

// =====================================================
// PUBLIC AUTH
// =====================================================

app.use(
    "/auth",
    require("./routes/auth")
);

// =====================================================
// AUTHENTICATION
// =====================================================

app.use(
    authenticateToken
);

// =====================================================
// PROTECTED ROUTES
// =====================================================

app.use(
    "/users",
    require("./routes/users")
);

app.use(
    "/students",
    require("./routes/students")
);

// Student category & fee concession management
app.use(
    "/concessions",
    require("./routes/concessions")
);

// NEW: Classes Route Mounted Here
app.use(
    "/classes",
    require("./routes/classes")
);

app.use(
    "/fees",
    require("./routes/fees")
);

// Dashboard summary (role-guarded, no page grant needed)
app.use(
    "/dashboard",
    require("./routes/dashboard")
);

app.use(
    "/documents",
    require("./routes/documents")
);

app.use(
    "/payments",
    require("./routes/payments")
);

app.use(
    "/expenses",
    require("./routes/expenses")
);

// Non-fee school income (donations, grants ...) — feeds the
// dashboard Net Balance.
app.use(
    "/incomes",
    require("./routes/incomes")
);

app.use(
    "/notifications",
    require("./routes/notifications")
);

// Examination & Results feature
app.use(
    "/teachers",
    require("./routes/teachers")
);

app.use(
    "/exams",
    require("./routes/exams")
);

app.use(
    "/attendance",
    require("./routes/attendance")
);

app.use(
    "/student-attendance",
    require("./routes/studentAttendance")
);

// =====================================================
// DATA EXPORT CENTER
// Complete .xlsx downloads behind the Reports page
// dropdown ("reports" page grant; admin bypasses).
// =====================================================

app.use(
    "/exports",
    require("./routes/exports")
);

// =====================================================
// TIMETABLE
// Weekly class timetable: admin sets it here, teachers see
// their own schedule / class grids. Reads open to staff,
// writes behind the "timetable" page grant.
// =====================================================

app.use(
    "/timetable",
    require("./routes/timetable")
);

// =====================================================
// HOME
// =====================================================

app.get(
    "/",
    (req, res) => {
        res.json({
            status: "THE AGE SCHOOL API Running",
            authenticated: true,
            user: {
                id: req.user.id,
                role: req.user.role
            }
        });
    }
);

// =====================================================
// 404
// =====================================================

app.use(
    (req, res) => {
        res.status(404).json({
            success: false,
            message: "API endpoint not found."
        });
    }
);

// =====================================================
// SERVER START
// =====================================================

async function startServer() {
    try {
        console.log(
            "Starting database initialization..."
        );

        await initializeDatabase();

        console.log(
            "Database initialization completed."
        );

        app.listen(
            PORT,
            () => {
                console.log(
                    `Server Running on http://localhost:${PORT}`
                );
            }
        );

    } catch (error) {
        console.error(
            "Database initialization failed:",
            error
        );

        process.exit(1);
    }
}

startServer();
