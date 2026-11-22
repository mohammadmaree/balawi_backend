/**
 * Shared constants (single source of truth for models and controllers)
 */

const SHELVES = ["1", "2", "3", "4", "ارض", "طاولة"];

const STATUS = {
  NOT_READY: "غير جاهز",
  READY: "جاهز",
  DELIVERED: "تم التسليم",
};
const STATUSES = Object.values(STATUS);

module.exports = { SHELVES, STATUS, STATUSES };
