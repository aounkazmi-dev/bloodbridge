const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ── READ ────────────────────────────────────────────────────────────────────

// GET /api/users - all users (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // UserProfilesView returns FullName but the frontend renders firstname + lastname
    // separately (for the avatar initials). So we alias from the base table
    // for those two columns, and use the view for everything else.
    const result = await query(`
      SELECT
        v.UserID,
        u.firstname,
        u.lastname,
        v.Email        AS email,
        v.PhoneNum     AS phone,
        v.Role         AS userrole,
        v.BloodType    AS blood_type,
        v.Status       AS isUseractive,
        v.DateJoined   AS registrationdate
      FROM UserProfilesView v
      JOIN Users u ON v.UserID = u.UserID
      ORDER BY v.DateJoined DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/donors/active - active donors by blood type
router.get('/donors/active', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bt.blood_type AS BloodType, COUNT(u.UserID) AS TotalActiveDonors
      FROM Users u
      JOIN BloodTypes bt ON u.BloodID = bt.BloodID
      WHERE u.userrole = 'DONOR' AND u.isUseractive = 1
      GROUP BY bt.blood_type
      ORDER BY TotalActiveDonors DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/donors/never-donated
router.get('/donors/never-donated', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.UserID, u.firstname + ' ' + u.lastname AS DonorName, u.email, u.phone, bt.blood_type, u.registrationdate
      FROM Users u
      JOIN BloodTypes bt ON u.BloodID = bt.BloodID
      LEFT JOIN Donations d ON u.UserID = d.DonorID
      WHERE u.userrole = 'DONOR' AND d.DonationID IS NULL
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/donors/eligible
router.get('/donors/eligible', authMiddleware, async (req, res) => {
  try {
    // Alias the view's columns to match the frontend's expected keys
    // (JavaScript object keys are case-sensitive: Email != email)
    const result = await query(`
      SELECT
        UserID,
        DonorName,
        BloodType,
        Email             AS email,
        ContactNo         AS phone,
        LastDonationDate  AS LastDonation,
        DaysSinceLastDonation
      FROM EligibleDonorsView
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id - single user profile
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        v.UserID,
        u.firstname,
        u.lastname,
        v.Email        AS email,
        v.PhoneNum     AS phone,
        v.Sex          AS gender,
        v.Role         AS userrole,
        v.BloodType    AS blood_type,
        v.DOB          AS date_of_birth,
        v.Status       AS isUseractive,
        v.DateJoined   AS registrationdate
      FROM UserProfilesView v
      JOIN Users u ON v.UserID = u.UserID
      WHERE v.UserID = @id
    `, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE ──────────────────────────────────────────────────────────────────

// POST /api/users - create a new user (admin)
// Body: { firstname, lastname, email, phone, gender, userrole, BloodID, date_of_birth, password }
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { firstname, lastname, email, phone, gender, userrole, BloodID, date_of_birth, password } = req.body;
    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({ success: false, message: 'firstname, lastname, email and password are required.' });
    }

    // Convert date_of_birth string to Date object for safe SQL binding
    let parsedDob = null;
    if (date_of_birth) {
      parsedDob = new Date(date_of_birth);
      if (isNaN(parsedDob.getTime())) parsedDob = null;
    }

    const result = await query(`
      INSERT INTO Users (firstname, lastname, email, phone, gender, userrole, BloodID, date_of_birth, password, registrationdate, isUseractive)
      OUTPUT INSERTED.UserID
      VALUES (@firstname, @lastname, @email, @phone, @gender, @userrole, @BloodID, @date_of_birth, @password, GETDATE(), 1)
    `, { firstname, lastname, email, phone, gender, userrole, BloodID, date_of_birth: parsedDob, password });
    res.status(201).json({ success: true, UserID: result.recordset[0].UserID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE ──────────────────────────────────────────────────────────────────

// PUT /api/users/:id - full update (admin)
// Body: { firstname, lastname, email, phone, gender, BloodID, isUseractive }
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { firstname, lastname, email, phone, gender, BloodID, isUseractive } = req.body;
    if (!firstname || !lastname || !email) {
      return res.status(400).json({ success: false, message: 'firstname, lastname and email are required.' });
    }
    // Default to active (1) if not specified, so a profile edit does not
    // accidentally deactivate the user when the form omits this field.
    const safeActive = (isUseractive === undefined || isUseractive === null) ? 1 : isUseractive;

    await query(`
      UPDATE Users
      SET firstname    = @firstname,
          lastname     = @lastname,
          email        = @email,
          phone        = @phone,
          gender       = @gender,
          BloodID      = @BloodID,
          isUseractive = @isUseractive
      WHERE UserID = @id
    `, { id: req.params.id, firstname, lastname, email, phone, gender, BloodID, isUseractive: safeActive });
    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/deactivate - soft-delete (admin)
router.patch('/:id/deactivate', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`UPDATE Users SET isUseractive = 0 WHERE UserID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/activate - reactivate (admin)
router.patch('/:id/activate', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`UPDATE Users SET isUseractive = 1 WHERE UserID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'User activated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────

// DELETE /api/users/:id - hard delete (admin only, use with caution)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Users WHERE UserID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'User permanently deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;