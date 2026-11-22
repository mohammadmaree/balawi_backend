const WorkOrder = require("../models/WorkOrder");
const response = require("../utils/response");
const {
  escapeRegex,
  asString,
  parsePagination,
  buildPagination,
  parseDate,
} = require("../utils/query");

/**
 * @desc    Get all work orders with filters, search, and pagination
 * @route   GET /api/work-orders
 * @query   search - Search by customer name (partial match)
 * @query   status - Filter by status (جاهز / تم التسليم)
 * @query   shelfNumber - Filter by shelf number
 * @query   isPaid - Filter by payment status (true/false)
 * @query   dateFrom - Filter from date (ISO format)
 * @query   dateTo - Filter to date (ISO format)
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Number of items per page (default: 10)
 * @access  Public
 */
const getAllWorkOrders = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const search = asString(req.query.search);
    const status = asString(req.query.status);
    const shelfNumber = asString(req.query.shelfNumber);
    const isPaid = asString(req.query.isPaid);

    // Build query object
    const query = {};

    // Search by customer name (escaped, case-insensitive partial match)
    if (search) {
      query.customerName = { $regex: escapeRegex(search), $options: "i" };
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by shelf number
    if (shelfNumber) {
      query.shelfNumber = shelfNumber;
    }

    // Filter by payment status
    if (isPaid === "true" || isPaid === "false") {
      query.isPaid = isPaid === "true";
    }

    // Filter by date range (dateTo as YYYY-MM-DD includes the whole day)
    const dateFrom = parseDate(req.query.dateFrom);
    const dateTo = parseDate(req.query.dateTo, { endOfDay: true });
    if (dateFrom === undefined || dateTo === undefined) {
      return response.badRequest(res, "Invalid date format, use YYYY-MM-DD or ISO date");
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) query.createdAt.$lte = dateTo;
    }

    // Pagination
    const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

    const [total, workOrders] = await Promise.all([
      WorkOrder.countDocuments(query),
      WorkOrder.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limitNumber),
    ]);

    return response.success(res, "Work orders retrieved successfully", {
      workOrders,
      pagination: buildPagination(pageNumber, limitNumber, total),
    });
  } catch (error) {
    console.error("Error in getAllWorkOrders:", error);
    return response.serverError(res, "Error retrieving work orders");
  }
};

/**
 * @desc    Get work order statistics
 * @route   GET /api/work-orders/statistics
 * @access  Public
 */
const getStatistics = async (req, res) => {
  try {
    // Total work orders
    const total = await WorkOrder.countDocuments();

    // Not ready orders (غير جاهز)
    const notReady = await WorkOrder.countDocuments({ status: "غير جاهز" });

    // Ready orders (جاهز)
    const ready = await WorkOrder.countDocuments({ status: "جاهز" });

    // Delivered orders (تم التسليم)
    const delivered = await WorkOrder.countDocuments({ status: "تم التسليم" });

    // Unpaid orders
    const unpaid = await WorkOrder.countDocuments({ isPaid: false });

    // Paid orders
    const paid = await WorkOrder.countDocuments({ isPaid: true });

    // Total revenue (all orders)
    const revenueResult = await WorkOrder.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          totalPaid: { $sum: "$paidAmount" },
        },
      },
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    const totalPaidAmount = revenueResult.length > 0 ? revenueResult[0].totalPaid : 0;
    const remainingAmount = totalRevenue - totalPaidAmount;

    // Orders by shelf
    const ordersByShelf = await WorkOrder.aggregate([
      {
        $group: {
          _id: "$shelfNumber",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = await WorkOrder.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    return response.success(res, "Statistics retrieved successfully", {
      total,
      notReady,
      ready,
      delivered,
      unpaid,
      paid,
      totalRevenue,
      totalPaidAmount,
      remainingAmount,
      ordersByShelf,
      recentOrders,
    });
  } catch (error) {
    console.error("Error in getStatistics:", error);
    return response.serverError(res, "Error retrieving statistics");
  }
};

/**
 * @desc    Get single work order by ID
 * @route   GET /api/work-orders/:id
 * @access  Public
 */
const getWorkOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const workOrder = await WorkOrder.findById(id);

    if (!workOrder) {
      return response.notFound(res, "Work order not found");
    }

    return response.success(res, "Work order retrieved successfully", workOrder);
  } catch (error) {
    console.error("Error in getWorkOrderById:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid work order ID format");
    }

    return response.serverError(res, "Error retrieving work order");
  }
};

/**
 * @desc    Create new work order
 * @route   POST /api/work-orders
 * @access  Public
 */
const createWorkOrder = async (req, res) => {
  try {
    const {
      customerName,
      phoneNumber,
      shelfNumber,
      price,
      paidAmount,
      isPaid,
      status,
      workDescription,
      notes,
    } = req.body;

    // Validate required fields
    if (typeof customerName !== "string" || !customerName.trim()) {
      return response.badRequest(res, "Customer name is required");
    }

    if (!shelfNumber) {
      return response.badRequest(res, "Shelf number is required");
    }

    if (!status) {
      return response.badRequest(res, "Status is required");
    }

    // Validate shelf number
    const validShelves = ["1", "2", "3", "4", "ارض", "طاولة"];
    if (!validShelves.includes(shelfNumber)) {
      return response.badRequest(
        res,
        `Shelf number must be one of: ${validShelves.join(", ")}`
      );
    }

    // Validate status
    if (!["غير جاهز", "جاهز", "تم التسليم"].includes(status)) {
      return response.badRequest(res, "Status must be 'غير جاهز', 'جاهز' or 'تم التسليم'");
    }

    // isPaid is derived from amounts in the model.
    // Backward compatibility: isPaid=true without paidAmount means fully paid.
    const finalPrice = price || 0;
    let finalPaid = paidAmount || 0;
    if (isPaid === true && paidAmount === undefined) {
      finalPaid = finalPrice;
    }

    const workOrder = await WorkOrder.create({
      customerName,
      phoneNumber,
      shelfNumber,
      price: finalPrice,
      paidAmount: finalPaid,
      status,
      workDescription: workDescription || "",
      notes: notes || "",
    });

    return response.created(res, "Work order created successfully", workOrder);
  } catch (error) {
    console.error("Error in createWorkOrder:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return response.badRequest(res, messages.join(", "));
    }

    return response.serverError(res, "Error creating work order");
  }
};

/**
 * @desc    Update work order
 * @route   PUT /api/work-orders/:id
 * @access  Public
 */
const updateWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      phoneNumber,
      shelfNumber,
      price,
      paidAmount,
      isPaid,
      status,
      workDescription,
      notes,
    } = req.body;

    // Find work order first
    const workOrder = await WorkOrder.findById(id);

    if (!workOrder) {
      return response.notFound(res, "Work order not found");
    }

    // Update fields if provided
    if (customerName !== undefined) workOrder.customerName = customerName;
    if (phoneNumber !== undefined) workOrder.phoneNumber = phoneNumber;
    if (shelfNumber !== undefined) workOrder.shelfNumber = shelfNumber;
    if (price !== undefined) workOrder.price = price;
    if (paidAmount !== undefined) workOrder.paidAmount = paidAmount;

    // isPaid is derived from amounts in the model.
    // Backward compatibility when only isPaid is sent (toggle in the app):
    if (paidAmount === undefined && isPaid === true) {
      workOrder.paidAmount = workOrder.price;
    } else if (paidAmount === undefined && isPaid === false && workOrder.isPaid) {
      workOrder.paidAmount = 0;
    }
    if (workDescription !== undefined) workOrder.workDescription = workDescription;
    if (notes !== undefined) workOrder.notes = notes;

    // If status is updated to "تم التسليم", set delivery date
    if (status !== undefined) {
      workOrder.status = status;
      if (status === "تم التسليم" && !workOrder.deliveryDate) {
        workOrder.deliveryDate = new Date();
      }
    }

    // Save updated work order
    const updatedWorkOrder = await workOrder.save();

    return response.success(res, "Work order updated successfully", updatedWorkOrder);
  } catch (error) {
    console.error("Error in updateWorkOrder:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid work order ID format");
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return response.badRequest(res, messages.join(", "));
    }

    return response.serverError(res, "Error updating work order");
  }
};

/**
 * @desc    Delete work order
 * @route   DELETE /api/work-orders/:id
 * @access  Public
 */
const deleteWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const workOrder = await WorkOrder.findByIdAndDelete(id);

    if (!workOrder) {
      return response.notFound(res, "Work order not found");
    }

    return response.success(res, "Work order deleted successfully", workOrder);
  } catch (error) {
    console.error("Error in deleteWorkOrder:", error);

    // Handle invalid ObjectId format
    if (error.kind === "ObjectId") {
      return response.badRequest(res, "Invalid work order ID format");
    }

    return response.serverError(res, "Error deleting work order");
  }
};

module.exports = {
  getAllWorkOrders,
  getStatistics,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
};
