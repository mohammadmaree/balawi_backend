const crypto = require("crypto");
const response = require("../utils/response");

/**
 * Protect routes with a static API key: header "x-api-key: <API_KEY>"
 */
const requireApiKey = (req, res, next) => {
  const provided = Buffer.from(String(req.headers["x-api-key"] || ""));
  const expected = Buffer.from(process.env.API_KEY);

  // Constant-time comparison to avoid timing attacks
  const valid =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!valid) {
    return response.sendResponse(res, 401, "غير مصرح - مفتاح API غير صحيح");
  }

  return next();
};

module.exports = { requireApiKey };
