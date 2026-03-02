/**
 * Unified response handler for all APIs
 * This ensures consistent response format across all endpoints
 */

const sendResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    message,
    data,
  };

  return res.status(statusCode).json(response);
};

// Success responses
const success = (res, message = "Success", data = null) => {
  return sendResponse(res, 200, message, data);
};

const created = (res, message = "Created successfully", data = null) => {
  return sendResponse(res, 201, message, data);
};

// Error responses
const badRequest = (res, message = "Bad request") => {
  return sendResponse(res, 400, message, null);
};

const notFound = (res, message = "Not found") => {
  return sendResponse(res, 404, message, null);
};

const conflict = (res, message = "Conflict - Resource already exists") => {
  return sendResponse(res, 409, message, null);
};

const serverError = (res, message = "Internal server error") => {
  return sendResponse(res, 500, message, null);
};

module.exports = {
  sendResponse,
  success,
  created,
  badRequest,
  notFound,
  conflict,
  serverError,
};
