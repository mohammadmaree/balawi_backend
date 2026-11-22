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
const success = (res, message = "تمت العملية بنجاح", data = null) => {
  return sendResponse(res, 200, message, data);
};

const created = (res, message = "تمت الإضافة بنجاح", data = null) => {
  return sendResponse(res, 201, message, data);
};

// Error responses
const badRequest = (res, message = "طلب غير صالح") => {
  return sendResponse(res, 400, message, null);
};

const notFound = (res, message = "غير موجود") => {
  return sendResponse(res, 404, message, null);
};

const conflict = (res, message = "البيانات موجودة مسبقاً") => {
  return sendResponse(res, 409, message, null);
};

const serverError = (res, message = "حدث خطأ في الخادم") => {
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
