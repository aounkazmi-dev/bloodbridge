const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query, sql } = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
require("dotenv").config();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      phone,
      password,
      gender,
      date_of_birth,
      userrole,
      bloodType,
    } = req.body;

    if (!firstname || !lastname || !email || !password || !userrole) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields missing." });
    }

    // Check if email exists
    const existing = await query(
      `SELECT UserID FROM Users WHERE email = @email`,
      { email },
    );
    if (existing.recordset.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered." });
    }

    // Get BloodID
    const bloodResult = await query(
      `SELECT BloodID FROM BloodTypes WHERE blood_type = @bloodType`,
      { bloodType },
    );
    const bloodID = bloodResult.recordset[0]?.BloodID || null;

    const hashedPassword = await bcrypt.hash(password, 12);

    // Convert date_of_birth string to Date object for safe SQL binding
    let parsedDob = null;
    if (date_of_birth) {
      parsedDob = new Date(date_of_birth);
      if (isNaN(parsedDob.getTime())) parsedDob = null;
    }

    const result = await query(
      `
      INSERT INTO Users (firstname, lastname, email, phone, password, gender, date_of_birth, userrole, BloodID, isUseractive, registrationdate)
      OUTPUT INSERTED.UserID
      VALUES (@firstname, @lastname, @email, @phone, @password, @gender, @dob, @role, @bloodID, 1, GETDATE())
    `,
      {
        firstname,
        lastname,
        email,
        phone,
        password: hashedPassword,
        gender: gender || null,
        dob: parsedDob,
        role: userrole,
        bloodID,
      },
    );

    const newUserID = result.recordset[0].UserID;

    const token = jwt.sign(
      { userID: newUserID, email, role: userrole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      user: { userID: newUserID, firstname, lastname, email, role: userrole },
    });
  } catch (err) {
    console.error("Register error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error during registration." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password required." });
    }

    const result = await query(
      `
      SELECT u.UserID, u.firstname, u.lastname, u.email, u.password, u.userrole, u.isUseractive, bt.blood_type
      FROM Users u
      LEFT JOIN BloodTypes bt ON u.BloodID = bt.BloodID
      WHERE u.email = @email
    `,
      { email },
    );

    if (result.recordset.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const user = result.recordset[0];

    if (!user.isUseractive) {
      return res
        .status(403)
        .json({ success: false, message: "Account is deactivated." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { userID: user.UserID, email: user.email, role: user.userrole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.json({
      success: true,
      token,
      user: {
        userID: user.UserID,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.userrole,
        bloodType: user.blood_type,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error during login." });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT u.UserID, u.firstname, u.lastname, u.email, u.phone, u.gender, u.date_of_birth, u.userrole, u.registrationdate, u.isUseractive, bt.blood_type
      FROM Users u
      LEFT JOIN BloodTypes bt ON u.BloodID = bt.BloodID
      WHERE u.UserID = @userID
    `,
      { userID: req.user.userID },
    );

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    res.json({ success: true, user: result.recordset[0] });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
