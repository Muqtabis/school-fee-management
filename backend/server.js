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

const PORT = Number(process.env.PORT) || 5000;

// =====================================================
// CORS (Updated for Azure)
// =====================================================

app.use(
    cors({
        origin: [
            "http://localhost:3000",
            "https://wonderful-hill-06e76ae10.7.azurestaticapps.net" // Your Azure Frontend
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

app.use(
    "/fees",
    require("./routes/fees")
);

app.use(
    "/payments",
    require("./routes/payments")
);

app.use(
    "/expenses",
    require("./routes/expenses")
);

app.use(
    "/notifications",
    require("./routes/notifications")
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