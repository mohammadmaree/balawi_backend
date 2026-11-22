/**
 * Helpers for safely reading user input from query strings / bodies
 */

// Escape special regex characters so user text is matched literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Accept only plain strings (blocks objects like { $ne: "x" } and arrays)
const asString = (value) => (typeof value === "string" ? value.trim() : undefined);

// Parse page/limit with sane defaults and an upper bound
const MAX_LIMIT = 100;
const parsePagination = (page, limit) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), MAX_LIMIT);
  return { pageNumber, limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const buildPagination = (pageNumber, limitNumber, total) => ({
  currentPage: pageNumber,
  totalPages: Math.ceil(total / limitNumber),
  totalItems: total,
  itemsPerPage: limitNumber,
});

// Parse a date filter. Date-only values (YYYY-MM-DD) used as an upper bound
// are moved to the end of that day so the whole day is included.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (value, { endOfDay = false } = {}) => {
  const str = asString(value);
  if (!str) return null;
  const date = new Date(str);
  if (isNaN(date.getTime())) return undefined; // invalid
  if (endOfDay && DATE_ONLY.test(str)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

module.exports = { escapeRegex, asString, parsePagination, buildPagination, parseDate };
