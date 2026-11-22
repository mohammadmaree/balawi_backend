const Customer = require("../models/Customer");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { escapeRegex, asString, parsePagination, buildPagination } = require("../utils/query");

// Returns true if another customer already uses this phone number
const phoneTaken = async (phoneNumber, excludeId = null) => {
  const phone = asString(phoneNumber);
  if (!phone) return false; // phone is optional
  const filter = { phoneNumber: phone };
  if (excludeId) filter._id = { $ne: excludeId };
  return Boolean(await Customer.exists(filter));
};

const DUPLICATE_PHONE = "يوجد زبون آخر بنفس رقم الهاتف";

/**
 * @desc    Get all customers with optional filters and search
 * @route   GET /api/customers
 * @query   search - Search by customer name (partial match)
 * @query   letter - Filter by first letter of customer name
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Number of items per page (default: 10, max: 100)
 */
const getAllCustomers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const search = asString(req.query.search);
  const letter = asString(req.query.letter);

  // Build name filter (user text is escaped so it is matched literally)
  const namePatterns = [];
  if (search) namePatterns.push({ fullName: { $regex: escapeRegex(search), $options: "i" } });
  if (letter) namePatterns.push({ fullName: { $regex: `^${escapeRegex(letter)}`, $options: "i" } });
  const query = namePatterns.length > 0 ? { $and: namePatterns } : {};

  const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

  const [total, customers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),
  ]);

  return response.success(res, "تم جلب الزبائن بنجاح", {
    customers,
    pagination: buildPagination(pageNumber, limitNumber, total),
  });
});

/**
 * @desc    Get single customer by ID
 * @route   GET /api/customers/:id
 */
const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return response.notFound(res, "الزبون غير موجود");
  }

  return response.success(res, "تم جلب الزبون بنجاح", customer);
});

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 */
const createCustomer = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, pantsHeight, waistWidth, pantsLegWidth, type, notes } = req.body;

  if (typeof fullName !== "string" || !fullName.trim()) {
    return response.badRequest(res, "اسم الزبون مطلوب");
  }

  if (await phoneTaken(phoneNumber)) {
    return response.conflict(res, DUPLICATE_PHONE);
  }

  const customer = await Customer.create({
    fullName,
    phoneNumber,
    pantsHeight: pantsHeight || 0,
    waistWidth: waistWidth || 0,
    pantsLegWidth: pantsLegWidth || 0,
    ...(type && { type }),
    ...(notes && { notes }),
  });

  return response.created(res, "تم إضافة الزبون بنجاح", customer);
});

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 */
const updateCustomer = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, pantsHeight, waistWidth, pantsLegWidth, type, notes } = req.body;

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return response.notFound(res, "الزبون غير موجود");
  }

  // Only check duplicates when the phone number actually changes
  const phoneChanged =
    phoneNumber !== undefined && asString(phoneNumber) !== (customer.phoneNumber || "");
  if (phoneChanged && (await phoneTaken(phoneNumber, customer._id))) {
    return response.conflict(res, DUPLICATE_PHONE);
  }

  if (fullName !== undefined) customer.fullName = fullName;
  if (phoneNumber !== undefined) customer.phoneNumber = phoneNumber;
  if (pantsHeight !== undefined) customer.pantsHeight = pantsHeight;
  if (waistWidth !== undefined) customer.waistWidth = waistWidth;
  if (pantsLegWidth !== undefined) customer.pantsLegWidth = pantsLegWidth;
  if (type !== undefined) customer.type = type;
  if (notes !== undefined) customer.notes = notes;

  const updatedCustomer = await customer.save();

  return response.success(res, "تم تعديل الزبون بنجاح", updatedCustomer);
});

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 */
const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);

  if (!customer) {
    return response.notFound(res, "الزبون غير موجود");
  }

  return response.success(res, "تم حذف الزبون بنجاح", customer);
});

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
