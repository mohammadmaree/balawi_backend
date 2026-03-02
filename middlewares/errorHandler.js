/**
 * Global error handler middleware
 * Catches any unhandled errors and returns unified response
 */
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    data: null,
  });
};

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route ${req.originalUrl} not found`,
    data: null,
  });
};

module.exports = { errorHandler, notFoundHandler };
