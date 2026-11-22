/**
 * Wrap async route handlers so thrown errors reach the global errorHandler
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
