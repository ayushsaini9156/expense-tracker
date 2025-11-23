require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

const app = express();

// Create necessary directories
const uploadsDir = path.join(__dirname, "uploads");
const logsDir = path.join(__dirname, "logs");
[uploadsDir, logsDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Basic security headers
app.use(helmet());

// Trust reverse proxy (set when behind a load balancer)
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Logging
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});
app.use(
  morgan(process.env.MORGAN_FORMAT || "combined", { stream: accessLogStream })
);
app.use(morgan("dev"));

// CORS middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing
app.use(express.json({ limit: process.env.BODY_PARSER_LIMIT || "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Connect to DB
connectDB();

// Mount routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);

// Serve static uploads folder
app.use("/uploads", express.static(uploadsDir));

// Health check
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (res.headersSent) return next(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server Error" });
});

// Start server with graceful shutdown
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => console.log("HTTP server closed"));
  try {
    await mongoose.connection.close(false);
    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("Error closing MongoDB connection", err);
  }
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});
