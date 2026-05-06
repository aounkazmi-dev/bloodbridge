const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { getPool } = require("./config/db"); // 👈 ADD THIS

const app = express();

// force DB connection
getPool()
  .then(() => console.log("🔥 DB connected at startup"))
  .catch((err) => console.log("❌ DB connection failed:", err.message));
// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/bloodbank", require("./routes/bloodbank"));
app.use("/api/donations", require("./routes/donations"));
app.use("/api/requests", require("./routes/requests"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/admin", require("./routes/admin"));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "BloodBridge API",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🩸 BloodBridge API running on http://localhost:${PORT}`);
});
