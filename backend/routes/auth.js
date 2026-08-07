const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../db");

const router = express.Router();

const SECRET = "THE_AGE_SCHOOL_SECRET";

// ======================
// VERIFY TOKEN MIDDLEWARE
// ======================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
}

// ======================
// SIGNUP
// ======================
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Please fill all fields",
    });
  }

  db.get(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: err.message,
        });
      }

      if (user) {
        return res.status(400).json({
          message: "Email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.run(
        "INSERT INTO users(name,email,password) VALUES(?,?,?)",
        [name, email, hashedPassword],
        function (err) {
          if (err) {
            return res.status(500).json({
              message: err.message,
            });
          }

          res.json({
            success: true,
            message: "Signup Successful",
          });
        }
      );
    }
  );
});

// ======================
// LOGIN
// ======================
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: err.message,
        });
      }

      if (!user) {
        return res.status(400).json({
          message: "Invalid Email",
        });
      }

      const ok = await bcrypt.compare(password, user.password);

      if (!ok) {
        return res.status(400).json({
          message: "Invalid Password",
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        SECRET,
        {
          expiresIn: "7d",
        }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }
  );
});

// ======================
// PROFILE
// ======================
router.get("/profile", verifyToken, (req, res) => {
  db.get(
    "SELECT id,name,email,role FROM users WHERE id=?",
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          message: err.message,
        });
      }

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.json({
        user,
      });
    }
  );
});

module.exports = router;