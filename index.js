const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const customerRoutes = require("./routes/customerRoutes");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");

// Load environment variables (optional - you can create .env file)
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors()); // Enable CORS for Flutter app
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use("/api/customers", customerRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: "Balawi Backend API is running 🚀",
    data: {
      version: "1.0.0",
      endpoints: {
        customers: "/api/customers",
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