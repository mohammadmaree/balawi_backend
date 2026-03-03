const WorkOrder = require("../models/WorkOrder");
const response = require("../utils/response");

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
    const {
      search,
      status,
      shelfNumber,
      isPaid,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = req.query;

    // Build query object
    let query = {};

    // Search by customer name (case-insensitive partial match)
    if (search) {
      query.customerName = { $regex: search, $options: "i" };
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
    if (isPaid !== undefined) {
      query.isPaid = isPaid === "true";
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    // Pagination
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination info
    const total = await WorkOrder.countDocuments(query);

    // Get work orders
    const workOrders = await WorkOrder.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limitNumber);

    return response.success(res, "Work orders retrieved successfully", {
      workOrders,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
        totalItems: total,
        itemsPerPage: limitNumber,
      },
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
    if (!customerName) {
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
    if (!["جاهز", "تم التسليم"].includes(status)) {
      return response.badRequest(res, "Status must be 'جاهز' or 'تم التسليم'");
    }

    const workOrder = await WorkOrder.create({
      customerName,
      phoneNumber,
      shelfNumber,
      price: price || 0,
      paidAmount: paidAmount || 0,
      isPaid: isPaid || false,
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
    if (isPaid !== undefined) workOrder.isPaid = isPaid;
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
