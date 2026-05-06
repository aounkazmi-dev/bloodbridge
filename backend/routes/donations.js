const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ── READ ────────────────────────────────────────────────────────────────────

// GET /api/donations - all donations (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.DonationID, u.firstname + ' ' + u.lastname AS DonorName,
             bt.blood_type, d.UnitsDonated, d.DonationDate, h.HospitalName
      FROM Donations d
      JOIN Users u        ON d.DonorID      = u.UserID
      JOIN BloodTypes bt  ON d.BloodID      = bt.BloodID
      JOIN BloodBanks bb  ON d.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      ORDER BY d.DonationDate DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/my - donations for the logged-in donor
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.DonationID, u.firstname + ' ' + u.lastname AS DonorName,
             bt.blood_type, d.UnitsDonated, d.DonationDate, h.HospitalName
      FROM Donations d
      JOIN Users u        ON d.DonorID      = u.UserID
      JOIN BloodTypes bt  ON d.BloodID      = bt.BloodID
      JOIN BloodBanks bb  ON d.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE d.DonorID = @donorID
      ORDER BY d.DonationDate DESC
    `, { donorID: req.user.userID });
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/by-bloodbank
router.get('/by-bloodbank', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT h.HospitalName, COUNT(d.DonationID) AS TotalDonations, SUM(d.UnitsDonated) AS TotalUnitsDonated
      FROM Donations d
      JOIN BloodBanks bb  ON d.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      GROUP BY h.HospitalName
      ORDER BY TotalDonations DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/monthly-trends
router.get('/monthly-trends', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT YEAR(d.DonationDate) AS Year, MONTH(d.DonationDate) AS Month,
             COUNT(d.DonationID) AS TotalDonations, SUM(d.UnitsDonated) AS TotalUnits
      FROM Donations d
      WHERE d.DonationDate >= DATEADD(MONTH, -12, GETDATE())
      GROUP BY YEAR(d.DonationDate), MONTH(d.DonationDate)
      ORDER BY Year, Month
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/top-donors
router.get('/top-donors', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM TopDonorsView`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/:id - single donation (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.DonationID, u.firstname + ' ' + u.lastname AS DonorName,
             bt.blood_type, d.UnitsDonated, d.DonationDate, h.HospitalName
      FROM Donations d
      JOIN Users u        ON d.DonorID      = u.UserID
      JOIN BloodTypes bt  ON d.BloodID      = bt.BloodID
      JOIN BloodBanks bb  ON d.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE d.DonationID = @id
    `, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Donation not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE ──────────────────────────────────────────────────────────────────

// POST /api/donations - log a new donation (also updates inventory)
// Body: { donorID, bloodBankID, bloodID, unitsDonated }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { donorID, bloodBankID, bloodID, unitsDonated } = req.body;
    if (!donorID || !bloodBankID || !bloodID || !unitsDonated) {
      return res.status(400).json({ success: false, message: 'donorID, bloodBankID, bloodID and unitsDonated are required.' });
    }

    // Force numeric conversion — frontend dropdowns send strings
    const safeDonorID = parseInt(donorID);
    const safeBankID  = parseInt(bloodBankID);
    const safeBloodID = parseInt(bloodID);
    const safeUnits   = parseInt(unitsDonated);

    await query(`
      INSERT INTO Donations (DonorID, BloodBankID, BloodID, UnitsDonated, DonationDate)
      VALUES (@donorID, @bloodBankID, @bloodID, @unitsDonated, GETDATE())
    `, { donorID: safeDonorID, bloodBankID: safeBankID, bloodID: safeBloodID, unitsDonated: safeUnits });

    // Keep inventory in sync
    await query(`
      UPDATE BloodInventory
      SET units_available = units_available + @unitsDonated,
          last_updated    = GETDATE()
      WHERE BloodbankID = @bloodBankID AND BloodID = @bloodID
    `, { unitsDonated: safeUnits, bloodBankID: safeBankID, bloodID: safeBloodID });

    res.status(201).json({ success: true, message: 'Donation recorded successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE ──────────────────────────────────────────────────────────────────

// PUT /api/donations/:id - update units or date (admin)
// Body: { unitsDonated, donationDate }
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { unitsDonated, donationDate } = req.body;
    if (!unitsDonated) {
      return res.status(400).json({ success: false, message: 'unitsDonated is required.' });
    }

    // Convert incoming date string to a real Date object so SQL Server
    // can bind it as DATETIME without a "conversion failed" error.
    const parsedDate = donationDate ? new Date(donationDate) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid donation date format.' });
    }

    await query(`
      UPDATE Donations
      SET UnitsDonated = @unitsDonated,
          DonationDate = @donationDate
      WHERE DonationID = @id
    `, { id: req.params.id, unitsDonated: parseInt(unitsDonated), donationDate: parsedDate });
    res.json({ success: true, message: 'Donation updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────

// DELETE /api/donations/:id (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Donations WHERE DonationID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Donation deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── APPOINTMENTS ────────────────────────────────────────────────────────────

// GET /api/donations/appointments/upcoming
// Admin sees all PENDING + SCHEDULED appointments from today onwards
router.get('/appointments/upcoming', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.AppointmentID, u.firstname + ' ' + u.lastname AS DonorName, u.phone,
             bt.blood_type, h.HospitalName, a.AppointmentDate, a.Status
      FROM Appointments a
      JOIN Users u        ON a.DonorID      = u.UserID
      JOIN BloodTypes bt  ON u.BloodID      = bt.BloodID
      JOIN BloodBanks bb  ON a.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE a.Status IN ('PENDING', 'SCHEDULED')
        AND CAST(a.AppointmentDate AS DATE) >= CAST(GETDATE() AS DATE)
      ORDER BY
        CASE a.Status WHEN 'PENDING' THEN 1 WHEN 'SCHEDULED' THEN 2 ELSE 3 END,
        a.AppointmentDate ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/donations/appointments/my - all of the donor's appointments
router.get('/appointments/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.AppointmentID, h.HospitalName, a.AppointmentDate, a.Status
      FROM Appointments a
      JOIN BloodBanks bb  ON a.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE a.DonorID = @donorID
      ORDER BY a.AppointmentDate DESC
    `, { donorID: req.user.userID });
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/donations/appointments - book an appointment (starts as PENDING)
// Body: { bloodBankID, appointmentDate }
router.post('/appointments', authMiddleware, async (req, res) => {
  try {
    const { bloodBankID, appointmentDate } = req.body;
    if (!bloodBankID || !appointmentDate) {
      return res.status(400).json({ success: false, message: 'bloodBankID and appointmentDate are required.' });
    }

    const parsedDate = new Date(appointmentDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid appointment date format.' });
    }

    // Status starts as PENDING — admin must approve before it becomes SCHEDULED
    await query(`
      INSERT INTO Appointments (DonorID, BloodBankID, AppointmentDate, Status)
      VALUES (@donorID, @bloodBankID, @appointmentDate, 'PENDING')
    `, { donorID: req.user.userID, bloodBankID: parseInt(bloodBankID), appointmentDate: parsedDate });
    res.status(201).json({ success: true, message: 'Appointment requested. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/donations/appointments/:id/approve (admin)
// Marks appointment as SCHEDULED and notifies the donor
router.patch('/appointments/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Look up the appointment so we can build a useful notification message
    const apptInfo = await query(`
      SELECT a.DonorID, a.AppointmentDate, a.Status, h.HospitalName
      FROM Appointments a
      JOIN BloodBanks bb  ON a.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE a.AppointmentID = @id
    `, { id: req.params.id });

    if (apptInfo.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    if (apptInfo.recordset[0].Status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending appointments can be approved.' });
    }

    const { DonorID, AppointmentDate, HospitalName } = apptInfo.recordset[0];

    // Approve it
    await query(`
      UPDATE Appointments SET Status = 'SCHEDULED' WHERE AppointmentID = @id
    `, { id: req.params.id });

    // Notify the donor
    const dateStr = new Date(AppointmentDate).toLocaleString('en-US',
      { dateStyle: 'medium', timeStyle: 'short' });
    const message = `✓ Your appointment at ${HospitalName || 'the blood bank'} on ${dateStr} has been approved!`;

    await query(`
      INSERT INTO Notifications (UserID, Message, IsRead, GeneratedAt)
      VALUES (@userID, @message, 0, GETDATE())
    `, { userID: DonorID, message });

    res.json({ success: true, message: 'Appointment approved and donor notified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/donations/appointments/:id/reject (admin)
// Marks appointment as REJECTED and notifies the donor
router.patch('/appointments/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const apptInfo = await query(`
      SELECT a.DonorID, a.AppointmentDate, a.Status, h.HospitalName
      FROM Appointments a
      JOIN BloodBanks bb  ON a.BloodBankID  = bb.BloodbankID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      WHERE a.AppointmentID = @id
    `, { id: req.params.id });

    if (apptInfo.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    if (apptInfo.recordset[0].Status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending appointments can be rejected.' });
    }

    const { DonorID, AppointmentDate, HospitalName } = apptInfo.recordset[0];

    await query(`
      UPDATE Appointments SET Status = 'REJECTED' WHERE AppointmentID = @id
    `, { id: req.params.id });

    const dateStr = new Date(AppointmentDate).toLocaleString('en-US',
      { dateStyle: 'medium', timeStyle: 'short' });
    const message = `✗ Your appointment at ${HospitalName || 'the blood bank'} on ${dateStr} could not be accommodated. Please book a different time.`;

    await query(`
      INSERT INTO Notifications (UserID, Message, IsRead, GeneratedAt)
      VALUES (@userID, @message, 0, GETDATE())
    `, { userID: DonorID, message });

    res.json({ success: true, message: 'Appointment rejected and donor notified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/donations/appointments/:id/cancel - donor cancels their own
router.patch('/appointments/:id/cancel', authMiddleware, async (req, res) => {
  try {
    await query(
      `UPDATE Appointments SET Status = 'CANCELLED' WHERE AppointmentID = @id`,
      { id: req.params.id }
    );
    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/donations/appointments/:id (admin)
router.delete('/appointments/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Appointments WHERE AppointmentID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Appointment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;