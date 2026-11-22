const { sendResponse } = require("../utils/response");

/**
 * Global error handler middleware
 * Converts known errors to clear 4xx responses; everything else is a 500
 */
const errorHandler = (err, req, res, next) => {
  // Mongoose schema validation (required, enum, min, custom invalidate)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) =>
      e.name === "CastError" ? `قيمة غير صالحة للحقل ${e.path}` : e.message
    );
    return sendResponse(res, 400, messages.join("، "));
  }

  // Invalid ObjectId or wrong type in a query
  if (err.name === "CastError") {
    return sendResponse(res, 400, err.path === "_id" ? "المعرّف غير صالح" : `قيمة غير صالحة للحقل ${err.path}`);
  }

  // Unique index violation
  if (err.code === 11000) {
    return sendResponse(res, 409, "البيانات موجودة مسبقاً");
  }

  // Malformed JSON body / body too large (from express.json)
  if (err.type === "entity.parse.failed") {
    return sendResponse(res, 400, "صيغة البيانات المرسلة غير صحيحة");
  }
  if (err.type === "entity.too.large") {
    return sendResponse(res, 413, "حجم البيانات المرسلة كبير جداً");
  }

  // Errors thrown on purpose with a status code
  if (err.statusCode && err.statusCode < 500) {
    return sendResponse(res, err.statusCode, err.message);
  }

  // Unexpected error: log details, don't leak them to the client
  console.error("Unhandled error:", err);
  return sendResponse(res, 500, "حدث خطأ في الخادم، يرجى المحاولة لاحقاً");
};

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
const notFoundHandler = (req, res) => {
  return sendResponse(res, 404, `المسار ${req.originalUrl} غير موجود`);
};

module.exports = { errorHandler, notFoundHandler };
