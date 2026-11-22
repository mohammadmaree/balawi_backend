// Load environment variables first so every module sees them
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const customerRoutes = require("./routes/customerRoutes");
const workOrderRoutes = require("./routes/workOrderRoutes");
const { requireApiKey } = require("./middlewares/auth");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");

// Fail fast if auth config is missing
const requiredEnv = ["API_KEY"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  console.error("Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Parse query strings without nested objects (blocks ?status[$ne]=x)
app.set("query parser", "simple");

// Connect to MongoDB
connectDB();

// Behind a reverse proxy (nginx etc.) set TRUST_PROXY=1 so rate limiting sees real client IPs
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

// Security headers
app.use(helmet());

// CORS: the mobile app doesn't need it. Only browsers (e.g. Flutter web) do,
// so allow just the origins listed in CORS_ORIGIN (comma-separated).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));

// Rate limit: max 300 requests per 15 minutes per IP on the API
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        statusCode: 429,
        message: "عدد الطلبات كبير جداً، يرجى المحاولة بعد قليل",
        data: null,
      }),
  })
);

// Body parsing
app.use(express.json({ limit: "100kb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: false, limit: "100kb" })); // Parse URL-encoded bodies

// Routes
app.use("/api/customers", requireApiKey, customerRoutes);
app.use("/api/work-orders", requireApiKey, workOrderRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: "Balawi Backend API is running 🚀",
    data: {
      version: "1.1.0",
      endpoints: {
        customers: "/api/customers",
        workOrders: "/api/work-orders",
      },
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
