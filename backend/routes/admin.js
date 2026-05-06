const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/admin/summary - main dashboard stats
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users WHERE userrole = 'DONOR' AND isUseractive = 1) AS ActiveDonors,
        (SELECT COUNT(*) FROM Users WHERE userrole = 'RECIPIENT' AND isUseractive = 1) AS ActiveRecipients,
        (SELECT COUNT(*) FROM BloodRequests WHERE status = 'PENDING') AS PendingRequests,
        (SELECT COUNT(*) FROM BloodRequests WHERE status = 'FULFILLED') AS FulfilledRequests,
        (SELECT SUM(units_available) FROM BloodInventory) AS TotalBloodUnitsAvailable,
        (SELECT COUNT(*) FROM Donations WHERE DonationDate >= DATEADD(DAY, -30, GETDATE())) AS DonationsLast30Days,
        (SELECT COUNT(*) FROM Appointments WHERE Status = 'SCHEDULED' AND AppointmentDate >= GETDATE()) AS UpcomingAppointments
    `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/blood-types - all blood types reference
router.get('/blood-types', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT BloodID, blood_type FROM BloodTypes ORDER BY BloodID`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/hospitals - all hospitals
router.get('/hospitals', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT HospitalID, HospitalName, contact_number FROM Hospitals ORDER BY HospitalName`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/hospitals/:id - single hospital
router.get('/hospitals/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT HospitalID, HospitalName, contact_number FROM Hospitals WHERE HospitalID = @id`, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/hospitals - create hospital (admin)
// Body: { HospitalName, contact_number }
router.post('/hospitals', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { HospitalName, contact_number } = req.body;
    if (!HospitalName) {
      return res.status(400).json({ success: false, message: 'HospitalName is required.' });
    }
    const result = await query(`
      INSERT INTO Hospitals (HospitalName, contact_number)
      OUTPUT INSERTED.HospitalID
      VALUES (@HospitalName, @contact_number)
    `, { HospitalName, contact_number: contact_number || null });
    res.status(201).json({ success: true, HospitalID: result.recordset[0].HospitalID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/hospitals/:id - update hospital (admin)
router.put('/hospitals/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { HospitalName, contact_number } = req.body;
    await query(`
      UPDATE Hospitals SET HospitalName = @HospitalName, contact_number = @contact_number
      WHERE HospitalID = @id
    `, { HospitalName, contact_number, id: req.params.id });
    res.json({ success: true, message: 'Hospital updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/hospitals/:id - delete hospital (admin)
router.delete('/hospitals/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Hospitals WHERE HospitalID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Hospital deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/blood-banks - all blood banks
router.get('/blood-banks', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bb.BloodbankID, h.HospitalName, a.city AS City
      FROM BloodBanks bb
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      LEFT JOIN Addresses a ON bb.AddressID = a.AddressID
      ORDER BY h.HospitalName
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
