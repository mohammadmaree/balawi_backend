const Customer = require("../models/Customer");
const response = require("../utils/response");
const { escapeRegex, asString, parsePagination, buildPagination } = require("../utils/query");

/**
 * @desc    Get all customers with optional filters and search
 * @route   GET /api/customers
 * @query   search - Search by customer name (partial match)
 * @query   letter - Filter by first letter of customer name
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Number of items per page (default: 10)
 * @access  Public
 */
const getAllCustomers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const search = asString(req.query.search);
    const letter = asString(req.query.letter);

    // Build name filter (user text is escaped so it is matched literally)
    const namePatterns = [];
    if (search) namePatterns.push({ fullName: { $regex: escapeRegex(search), $options: "i" } });
    if (letter) namePatterns.push({ fullName: { $regex: `^${escapeRegex(letter)}`, $options: "i" } });
    const query = namePatterns.length > 0 ? { $and: namePatterns } : {};

    // Pagination
    const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

    const [total, customers] = await Promise.all([
      Customer.countDocuments(query),
      Customer.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limitNumber),
    ]);

    return response.success(res, "Customers retrieved successfully", {
      customers,
      pagination: buildPagination(pageNumber, limitNumber, total),
    });
  } catch (error) {
    console.error("Error in getAllCustomers:", error);
    return response.serverError(res, "Error retrieving customers");
  }
};

/**
 * @desc    Get single customer by ID
 * @route   GET /api/customers/:id
 * @access  Public
 */
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return response.notFound(res, "Customer not found");
    }

    return response.success(res, "Customer retrieved successfully", customer);
  } catch (error) {
    console.error("Error in getCustomerById:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid customer ID format");
    }

    return response.serverError(res, "Error retrieving customer");
  }
};

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Public
 */
const createCustomer = async (req, res) => {
  try {
    const { fullName, phoneNumber, pantsHeight, waistWidth, pantsLegWidth, type, notes } = req.body;

    // Validate required fields
    if (typeof fullName !== "string" || !fullName.trim()) {
      return response.badRequest(res, "Full name is required");
    }

    // Check if customer with same name already exists (escaped, exact match)
    const existingCustomer = await Customer.findOne({
      fullName: { $regex: `^${escapeRegex(fullName.trim())}$`, $options: "i" },
    });

    if (existingCustomer) {
      return response.conflict(res, "يوجد زبون بنفس الاسم مسبقاً");
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

    return response.created(res, "Customer created successfully", customer);
  } catch (error) {
    console.error("Error in createCustomer:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return response.badRequest(res, messages.join(", "));
    }

    return response.serverError(res, "Error creating customer");
  }
};

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Public
 */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, pantsHeight, waistWidth, pantsLegWidth, type, notes } = req.body;

    // Find customer first
    const customer = await Customer.findById(id);

    if (!customer) {
      return response.notFound(res, "Customer not found");
    }

    // Update fields if provided
    if (fullName !== undefined) customer.fullName = fullName;
    if (phoneNumber !== undefined) customer.phoneNumber = phoneNumber;
    if (pantsHeight !== undefined) customer.pantsHeight = pantsHeight;
    if (waistWidth !== undefined) customer.waistWidth = waistWidth;
    if (pantsLegWidth !== undefined) customer.pantsLegWidth = pantsLegWidth;
    if (type !== undefined) customer.type = type;
    if (notes !== undefined) customer.notes = notes;

    // Save updated customer
    const updatedCustomer = await customer.save();

    return response.success(res, "Customer updated successfully", updatedCustomer);
  } catch (error) {
    console.error("Error in updateCustomer:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid customer ID format");
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return response.badRequest(res, messages.join(", "));
    }

    return response.serverError(res, "Error updating customer");
  }
};

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Public
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      return response.notFound(res, "Customer not found");
    }

    return response.success(res, "Customer deleted successfully", customer);
  } catch (error) {
    console.error("Error in deleteCustomer:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid customer ID format");
    }

    return response.serverError(res, "Error deleting customer");
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
