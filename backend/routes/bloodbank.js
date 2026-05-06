const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");

// GET /api/bloodbank - all blood banks
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bb.BloodbankID, h.HospitalName, a.city AS City, a.province AS Province
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

// GET /api/bloodbank/inventory - full inventory summary
router.get("/inventory", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bb.BloodbankID AS BloodBankID, h.HospitalName AS HospitalName,
        a.city AS City, a.province AS Province,
        bt.blood_type AS BloodType,
        bi.units_available AS TotalUnitsAvailable,
        bi.last_updated AS LastUpdated
      FROM BloodInventory bi
      JOIN BloodBanks bb ON bi.BloodbankID = bb.BloodbankID
      JOIN BloodTypes bt ON bi.BloodID = bt.BloodID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      LEFT JOIN Addresses a ON bb.AddressID = a.AddressID
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bloodbank/inventory/low-stock - units < 5
router.get("/inventory/low-stock", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT h.HospitalName, a.city AS City, bt.blood_type AS BloodType, bi.units_available AS UnitsLeft
      FROM BloodInventory bi
      JOIN BloodBanks bb ON bi.BloodbankID = bb.BloodbankID
      JOIN BloodTypes bt ON bi.BloodID = bt.BloodID
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      LEFT JOIN Addresses a ON bb.AddressID = a.AddressID
      WHERE bi.units_available < 5
      ORDER BY bi.units_available ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bloodbank/inventory/by-type - totals per blood type
router.get("/inventory/by-type", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bt.blood_type AS BloodType, SUM(bi.units_available) AS TotalUnitsAvailable
      FROM BloodInventory bi
      JOIN BloodTypes bt ON bi.BloodID = bt.BloodID
      GROUP BY bt.blood_type
      ORDER BY TotalUnitsAvailable DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bloodbank/supply-demand
router.get("/supply-demand", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT bt.blood_type,
        ISNULL(SUM(bi.units_available), 0) AS TotalSupply,
        ISNULL(pending.TotalDemand, 0) AS TotalDemand
      FROM BloodTypes bt
      LEFT JOIN BloodInventory bi ON bt.BloodID = bi.BloodID
      LEFT JOIN (
        SELECT BloodID, SUM(UnitsRequired) AS TotalDemand
        FROM BloodRequests
        WHERE status = 'PENDING'
        GROUP BY BloodID
      ) pending ON bt.BloodID = pending.BloodID
      GROUP BY bt.blood_type, pending.TotalDemand
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bloodbank/hospitals - hospital inventory summary
router.get("/hospitals", authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT h.HospitalID, h.HospitalName, h.contact_number AS Helpline,
        bt.blood_type AS BloodType,
        SUM(bi.units_available) AS TotalUnitsAvailable
      FROM Hospitals h
      JOIN BloodBanks bb ON h.HospitalID = bb.HospitalID
      JOIN BloodInventory bi ON bb.BloodbankID = bi.BloodbankID
      JOIN BloodTypes bt ON bi.BloodID = bt.BloodID
      GROUP BY h.HospitalID, h.HospitalName, h.contact_number, bt.blood_type
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bloodbank/compatibility/:recipientBloodID
router.get(
  "/compatibility/:recipientBloodID",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await query(
        `
      SELECT bt.blood_type AS CompatibleDonorBloodType,
             SUM(bi.units_available) AS TotalAvailableUnits,
             COUNT(DISTINCT bb.BloodbankID) AS AvailableAtBloodBanks
      FROM BloodCompatibility bc
      JOIN BloodTypes bt ON bc.DonorBloodID = bt.BloodID
      JOIN BloodInventory bi ON bi.BloodID = bc.DonorBloodID
      JOIN BloodBanks bb ON bi.BloodbankID = bb.BloodbankID
      WHERE bc.RecipientBloodID = @recipientBloodID
      GROUP BY bt.blood_type
      ORDER BY TotalAvailableUnits DESC
    `,
        { recipientBloodID: req.params.recipientBloodID },
      );
      res.json({ success: true, data: result.recordset });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/bloodbank/:id - single blood bank by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT bb.BloodbankID, h.HospitalName, a.city AS City, a.province AS Province
      FROM BloodBanks bb
      LEFT JOIN Hospitals h ON bb.HospitalID = h.HospitalID
      LEFT JOIN Addresses a ON bb.AddressID = a.AddressID
      WHERE bb.BloodbankID = @id
    `,
      { id: req.params.id },
    );
    if (result.recordset.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Blood bank not found." });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bloodbank - create a new blood bank (admin)
// Body: { HospitalID, AddressID }
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { HospitalID, AddressID } = req.body;
    if (!HospitalID || !AddressID) {
      return res.status(400).json({
        success: false,
        message: "HospitalID and AddressID are required.",
      });
    }
    const result = await query(
      `
      INSERT INTO BloodBanks (HospitalID, AddressID)
      OUTPUT INSERTED.BloodbankID
      VALUES (@HospitalID, @AddressID)
    `,
      { HospitalID, AddressID },
    );
    res
      .status(201)
      .json({ success: true, BloodbankID: result.recordset[0].BloodbankID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bloodbank/:id - update blood bank (admin)
// Body: { HospitalID, AddressID }
router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { HospitalID, AddressID } = req.body;
    await query(
      `
      UPDATE BloodBanks SET HospitalID = @HospitalID, AddressID = @AddressID
      WHERE BloodbankID = @id
    `,
      { HospitalID, AddressID, id: req.params.id },
    );
    res.json({ success: true, message: "Blood bank updated." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/bloodbank/inventory/update - update inventory stock (admin)
router.patch(
  "/inventory/update",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { bloodbankID, bloodID, units } = req.body;
      await query(
        `
      UPDATE BloodInventory SET units_available = @units, last_updated = GETDATE()
      WHERE BloodbankID = @bloodbankID AND BloodID = @bloodID
    `,
        { units, bloodbankID, bloodID },
      );
      res.json({ success: true, message: "Inventory updated." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// DELETE /api/bloodbank/:id - delete a blood bank (admin)
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM BloodBanks WHERE BloodbankID = @id`, {
      id: req.params.id,
    });
    res.json({ success: true, message: "Blood bank deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
