const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/notifications - all notifications (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM Notifications ORDER BY GeneratedAt DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/unread
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT NotificationID, Message, GeneratedAt
      FROM Notifications
      WHERE UserID = @userID AND IsRead = 0
      ORDER BY GeneratedAt DESC
    `, { userID: req.user.userID });
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/read
router.get('/read', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT NotificationID, Message, GeneratedAt
      FROM Notifications
      WHERE UserID = @userID AND IsRead = 1
      ORDER BY GeneratedAt DESC
    `, { userID: req.user.userID });
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/summary (from view)
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM UnreadNotificationsView WHERE UserID = @userID`, { userID: req.user.userID });
    res.json({ success: true, data: result.recordset[0] || { UnreadAlerts: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/:id - single notification by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM Notifications WHERE NotificationID = @id
    `, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/broadcast - send a notification to many users at once (admin)
// Body: { message, target } where target = 'ALL' | 'DONORS' | 'RECIPIENTS'
router.post('/broadcast', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { message, target } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }

    const validTargets = ['ALL', 'DONORS', 'RECIPIENTS'];
    const tgt = (target || 'ALL').toUpperCase();
    if (!validTargets.includes(tgt)) {
      return res.status(400).json({ success: false, message: 'target must be ALL, DONORS or RECIPIENTS.' });
    }

    // Build the WHERE clause dynamically based on the target group
    let whereClause = `WHERE u.isUseractive = 1`;
    if (tgt === 'DONORS') whereClause += ` AND u.userrole = 'DONOR'`;
    else if (tgt === 'RECIPIENTS') whereClause += ` AND u.userrole = 'RECIPIENT'`;

    // Bulk insert one notification row per matching user — single SQL round trip
    const result = await query(`
      INSERT INTO Notifications (UserID, Message, IsRead, GeneratedAt)
      SELECT u.UserID, @message, 0, GETDATE()
      FROM Users u
      ${whereClause}
    `, { message });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${result.rowsAffected[0]} user(s).`,
      recipientCount: result.rowsAffected[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications - send notification (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { userID, message } = req.body;
    const result = await query(`
      INSERT INTO Notifications (UserID, Message, IsRead, GeneratedAt)
      OUTPUT INSERTED.NotificationID
      VALUES (@userID, @message, 0, GETDATE())
    `, { userID, message });
    res.status(201).json({ success: true, message: 'Notification sent.', NotificationID: result.recordset[0].NotificationID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/:id - update notification message (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    await query(`UPDATE Notifications SET Message = @message WHERE NotificationID = @id`, { message, id: req.params.id });
    res.json({ success: true, message: 'Notification updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/mark-all-read
router.patch('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    await query(`UPDATE Notifications SET IsRead = 1 WHERE UserID = @userID AND IsRead = 0`, { userID: req.user.userID });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    await query(`UPDATE Notifications SET IsRead = 1 WHERE NotificationID = @id AND UserID = @userID`, {
      id: req.params.id, userID: req.user.userID
    });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notifications/:id - delete a notification (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Notifications WHERE NotificationID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
