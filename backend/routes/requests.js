const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ── READ ────────────────────────────────────────────────────────────────────

// GET /api/requests - all requests (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // We need individual request rows with RequestID, RecipientName, etc.
    // RequestStatusSummaryView is an aggregation view (counts per hospital +
    // blood type + urgency + status) so it can't drive the admin's main list.
    const result = await query(`
      SELECT br.RequestID,
             u.firstname + ' ' + u.lastname AS RecipientName,
             h.HospitalName,
             bt.blood_type,
             br.UnitsRequired,
             br.UrgencyLevel,
             br.status,
             br.RequestDate
      FROM BloodRequests br
      JOIN Users u       ON br.RecipientID = u.UserID
      JOIN Hospitals h   ON br.HospitalID  = h.HospitalID
      JOIN BloodTypes bt ON br.BloodID     = bt.BloodID
      ORDER BY br.RequestDate DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/pending - pending by urgency
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT br.RequestID, u.firstname + ' ' + u.lastname AS RecipientName,
             h.HospitalName, bt.blood_type, br.UnitsRequired, br.UrgencyLevel, br.status, br.RequestDate
      FROM BloodRequests br
      JOIN Users u      ON br.RecipientID = u.UserID
      JOIN Hospitals h  ON br.HospitalID  = h.HospitalID
      JOIN BloodTypes bt ON br.BloodID    = bt.BloodID
      WHERE br.status = 'PENDING'
      ORDER BY
        CASE br.UrgencyLevel WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        br.RequestDate ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/my - requests for the logged-in recipient
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT br.RequestID, h.HospitalName, bt.blood_type,
             br.UnitsRequired, br.UrgencyLevel, br.status, br.RequestDate
      FROM BloodRequests br
      JOIN Hospitals h  ON br.HospitalID = h.HospitalID
      JOIN BloodTypes bt ON br.BloodID   = bt.BloodID
      WHERE br.RecipientID = @userID
      ORDER BY br.RequestDate DESC
    `, { userID: req.user.userID });
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/top-hospitals
router.get('/top-hospitals', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT TOP 5 h.HospitalName,
             COUNT(br.RequestID) AS TotalRequests,
             SUM(br.UnitsRequired) AS TotalUnitsRequested
      FROM BloodRequests br
      JOIN Hospitals h ON br.HospitalID = h.HospitalID
      GROUP BY h.HospitalName
      ORDER BY TotalRequests DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/fulfilled-vs-pending
router.get('/fulfilled-vs-pending', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM RequestsFulfilledVsPendingView`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/requests/:id - single request
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT br.RequestID, u.firstname + ' ' + u.lastname AS RecipientName,
             h.HospitalName, bt.blood_type,
             br.UnitsRequired, br.UrgencyLevel, br.status, br.RequestDate
      FROM BloodRequests br
      JOIN Users u      ON br.RecipientID = u.UserID
      JOIN Hospitals h  ON br.HospitalID  = h.HospitalID
      JOIN BloodTypes bt ON br.BloodID    = bt.BloodID
      WHERE br.RequestID = @id
    `, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Request not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE ──────────────────────────────────────────────────────────────────

// POST /api/requests - submit a new blood request
// Also auto-notifies all donors with compatible blood types
// Body: { hospitalID, bloodID, unitsRequired, urgencyLevel }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { hospitalID, bloodID, unitsRequired, urgencyLevel } = req.body;
    if (!hospitalID || !bloodID || !unitsRequired || !urgencyLevel) {
      return res.status(400).json({ success: false, message: 'hospitalID, bloodID, unitsRequired and urgencyLevel are required.' });
    }

    // Validate urgency to prevent invalid values being stored
    const validUrgencies = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validUrgencies.includes(urgencyLevel)) {
      return res.status(400).json({ success: false, message: 'urgencyLevel must be CRITICAL, HIGH, MEDIUM or LOW.' });
    }

    // Force numeric conversion — frontend dropdowns send strings
    const safeHospitalID = parseInt(hospitalID);
    const safeBloodID    = parseInt(bloodID);
    const safeUnits      = parseInt(unitsRequired);

    // 1. Insert the request itself
    await query(`
      INSERT INTO BloodRequests (RecipientID, HospitalID, BloodID, UnitsRequired, UrgencyLevel, status, RequestDate)
      VALUES (@recipientID, @hospitalID, @bloodID, @unitsRequired, @urgencyLevel, 'PENDING', GETDATE())
    `, { recipientID: req.user.userID, hospitalID: safeHospitalID, bloodID: safeBloodID, unitsRequired: safeUnits, urgencyLevel });

    // 2. Look up the recipient blood type and hospital name (for the notification message)
    const meta = await query(`
      SELECT bt.blood_type AS RecipientBloodType, h.HospitalName
      FROM BloodTypes bt, Hospitals h
      WHERE bt.BloodID = @bloodID AND h.HospitalID = @hospitalID
    `, { bloodID: safeBloodID, hospitalID: safeHospitalID });

    const recipientBloodType = meta.recordset[0]?.RecipientBloodType || 'unknown';
    const hospitalName       = meta.recordset[0]?.HospitalName || 'a hospital';
    const message =
      `${urgencyLevel} need: ${safeUnits} unit(s) of ${recipientBloodType} blood required at ${hospitalName}. ` +
      `Your blood type is compatible — please consider donating!`;

    // 3. Auto-notify every active donor whose blood type can donate to this recipient
    //    BloodCompatibility table maps RecipientBloodID -> compatible DonorBloodIDs
    await query(`
      INSERT INTO Notifications (UserID, Message, IsRead, GeneratedAt)
      SELECT u.UserID, @message, 0, GETDATE()
      FROM Users u
      JOIN BloodCompatibility bc ON u.BloodID = bc.DonorBloodID
      WHERE bc.RecipientBloodID = @bloodID
        AND u.userrole = 'DONOR'
        AND u.isUseractive = 1
    `, { message, bloodID: safeBloodID });

    res.status(201).json({ success: true, message: 'Blood request submitted. Compatible donors notified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE ──────────────────────────────────────────────────────────────────

// PUT /api/requests/:id - full update (admin)
// Body: { status, unitsRequired, urgencyLevel }
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, unitsRequired, urgencyLevel } = req.body;
    if (!status || !unitsRequired || !urgencyLevel) {
      return res.status(400).json({ success: false, message: 'status, unitsRequired and urgencyLevel are required.' });
    }
    await query(`
      UPDATE BloodRequests
      SET status        = @status,
          UnitsRequired = @unitsRequired,
          UrgencyLevel  = @urgencyLevel
      WHERE RequestID = @id
    `, { id: req.params.id, status, unitsRequired, urgencyLevel });
    res.json({ success: true, message: 'Request updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/requests/:id/fulfill (admin) - marks fulfilled AND deducts inventory
router.patch('/:id/fulfill', authMiddleware, adminOnly, async (req, res) => {
  try {
    // First, get the request details so we know how much to deduct
    const reqData = await query(
      `SELECT BloodID, UnitsRequired, status FROM BloodRequests WHERE RequestID = @id`,
      { id: req.params.id }
    );
    if (reqData.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (reqData.recordset[0].status === 'FULFILLED') {
      return res.status(400).json({ success: false, message: 'Request already fulfilled.' });
    }

    const { BloodID, UnitsRequired } = reqData.recordset[0];

    // Mark request as fulfilled
    await query(
      `UPDATE BloodRequests SET status = 'FULFILLED' WHERE RequestID = @id`,
      { id: req.params.id }
    );

    // Deduct from one blood bank that has enough stock of this blood type
    await query(`
      UPDATE TOP (1) BloodInventory
      SET units_available = units_available - @units,
          last_updated    = GETDATE()
      WHERE BloodID = @bloodID AND units_available >= @units
    `, { units: UnitsRequired, bloodID: BloodID });

    res.json({ success: true, message: 'Request marked as fulfilled and inventory updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/requests/:id/reject (admin)
router.patch('/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(
      `UPDATE BloodRequests SET status = 'REJECTED' WHERE RequestID = @id`,
      { id: req.params.id }
    );
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    res.json({ success: true, message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────

// DELETE /api/requests/:id (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM BloodRequests WHERE RequestID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Request deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;