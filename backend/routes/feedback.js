const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/feedback - all feedback (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM UserFeedbackView ORDER BY DateSubmitted DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/recent - last 7 days (visible to all logged-in users)
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.firstname + ' ' + u.lastname AS FullName, u.userrole AS Role, f.Message, f.SubmittedAt
      FROM Feedback f
      JOIN Users u ON f.UserID = u.UserID
      WHERE f.SubmittedAt >= DATEADD(DAY, -7, GETDATE())
      ORDER BY f.SubmittedAt DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/by-role
router.get('/by-role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.userrole AS Role, COUNT(f.FeedbackID) AS TotalFeedback
      FROM Feedback f
      JOIN Users u ON f.UserID = u.UserID
      GROUP BY u.userrole
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/feedback/:id - single feedback by ID (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT f.FeedbackID, u.firstname + ' ' + u.lastname AS FullName,
             u.email, u.userrole AS Role, f.Message AS Feedback, f.SubmittedAt
      FROM Feedback f
      JOIN Users u ON f.UserID = u.UserID
      WHERE f.FeedbackID = @id
    `, { id: req.params.id });
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Feedback not found.' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/feedback - submit feedback
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Feedback message is required.' });
    }
    const result = await query(`
      INSERT INTO Feedback (UserID, Message, SubmittedAt)
      OUTPUT INSERTED.FeedbackID
      VALUES (@userID, @message, GETDATE())
    `, { userID: req.user.userID, message });
    res.status(201).json({ success: true, message: 'Feedback submitted. Thank you!', FeedbackID: result.recordset[0].FeedbackID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/feedback/:id - update feedback message (admin or owner)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Feedback message is required.' });
    }
    await query(`UPDATE Feedback SET Message = @message WHERE FeedbackID = @id`, { message, id: req.params.id });
    res.json({ success: true, message: 'Feedback updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/feedback/:id - delete feedback (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query(`DELETE FROM Feedback WHERE FeedbackID = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Feedback deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
