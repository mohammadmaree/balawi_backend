// Load environment variables first so every module sees them
require("dotenv").config();

const express = require("express");
const cors = require("cors");
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

// Middleware
app.use(cors()); // Enable CORS for Flutter app
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
