const WorkOrder = require("../models/WorkOrder");
const response = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const { STATUS } = require("../config/constants");
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
 * @query   status - Filter by status (غير جاهز / جاهز / تم التسليم)
 * @query   shelfNumber - Filter by shelf number
 * @query   isPaid - Filter by payment status (true/false)
 * @query   dateFrom - Filter from date (ISO or YYYY-MM-DD)
 * @query   dateTo - Filter to date (ISO, or YYYY-MM-DD = whole day)
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Number of items per page (default: 10, max: 100)
 */
const getAllWorkOrders = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const search = asString(req.query.search);
  const status = asString(req.query.status);
  const shelfNumber = asString(req.query.shelfNumber);
  const isPaid = asString(req.query.isPaid);

  const query = {};

  if (search) {
    query.customerName = { $regex: escapeRegex(search), $options: "i" };
  }
  if (status) {
    query.status = status;
  }
  if (shelfNumber) {
    query.shelfNumber = shelfNumber;
  }
  if (isPaid === "true" || isPaid === "false") {
    query.isPaid = isPaid === "true";
  }

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo, { endOfDay: true });
  if (dateFrom === undefined || dateTo === undefined) {
    return response.badRequest(res, "صيغة التاريخ غير صحيحة، استخدم YYYY-MM-DD");
  }
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = dateTo;
  }

  const { pageNumber, limitNumber, skip } = parsePagination(page, limit);

  const [total, workOrders] = await Promise.all([
    WorkOrder.countDocuments(query),
    WorkOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),
  ]);

  return response.success(res, "تم جلب الطلبات بنجاح", {
    workOrders,
    pagination: buildPagination(pageNumber, limitNumber, total),
  });
});

/**
 * @desc    Get work order statistics (single aggregation using $facet)
 * @route   GET /api/work-orders/statistics
 */
const getStatistics = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [stats] = await WorkOrder.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              totalRevenue: { $sum: "$price" },
              totalPaidAmount: { $sum: "$paidAmount" },
              paid: { $sum: { $cond: ["$isPaid", 1, 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        ordersByShelf: [
          { $group: { _id: "$shelfNumber", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        recent: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: "count" }],
      },
    },
  ]);

  const totals = stats.totals[0] || { total: 0, totalRevenue: 0, totalPaidAmount: 0, paid: 0 };
  const statusCount = (s) => stats.byStatus.find((x) => x._id === s)?.count || 0;

  return response.success(res, "تم جلب الإحصائيات بنجاح", {
    total: totals.total,
    notReady: statusCount(STATUS.NOT_READY),
    ready: statusCount(STATUS.READY),
    delivered: statusCount(STATUS.DELIVERED),
    unpaid: totals.total - totals.paid,
    paid: totals.paid,
    totalRevenue: totals.totalRevenue,
    totalPaidAmount: totals.totalPaidAmount,
    remainingAmount: totals.totalRevenue - totals.totalPaidAmount,
    ordersByShelf: stats.ordersByShelf,
    recentOrders: stats.recent[0]?.count || 0,
  });
});

/**
 * @desc    Get single work order by ID
 * @route   GET /api/work-orders/:id
 */
const getWorkOrderById = asyncHandler(async (req, res) => {
  const workOrder = await WorkOrder.findById(req.params.id);

  if (!workOrder) {
    return response.notFound(res, "الطلب غير موجود");
  }

  return response.success(res, "تم جلب الطلب بنجاح", workOrder);
});

/**
 * @desc    Create new work order
 * @route   POST /api/work-orders
 * @note    shelfNumber/status values are validated by the model (config/constants.js)
 */
const createWorkOrder = asyncHandler(async (req, res) => {
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

  if (typeof customerName !== "string" || !customerName.trim()) {
    return response.badRequest(res, "اسم الزبون مطلوب");
  }
  if (!shelfNumber) {
    return response.badRequest(res, "رقم الرف مطلوب");
  }
  if (!status) {
    return response.badRequest(res, "الحالة مطلوبة");
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

  return response.created(res, "تم إضافة الطلب بنجاح", workOrder);
});

/**
 * @desc    Update work order
 * @route   PUT /api/work-orders/:id
 */
const updateWorkOrder = asyncHandler(async (req, res) => {
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

  const workOrder = await WorkOrder.findById(req.params.id);

  if (!workOrder) {
    return response.notFound(res, "الطلب غير موجود");
  }

  if (customerName !== undefined) workOrder.customerName = customerName;
  if (phoneNumber !== undefined) workOrder.phoneNumber = phoneNumber;
  if (shelfNumber !== undefined) workOrder.shelfNumber = shelfNumber;
  if (price !== undefined) workOrder.price = price;
  if (paidAmount !== undefined) workOrder.paidAmount = paidAmount;
  if (workDescription !== undefined) workOrder.workDescription = workDescription;
  if (notes !== undefined) workOrder.notes = notes;

  // isPaid is derived from amounts in the model.
  // Backward compatibility when only isPaid is sent (toggle in the app):
  if (paidAmount === undefined && isPaid === true) {
    workOrder.paidAmount = workOrder.price;
  } else if (paidAmount === undefined && isPaid === false && workOrder.isPaid) {
    workOrder.paidAmount = 0;
  }

  // Set delivery date the first time the order is delivered
  if (status !== undefined) {
    workOrder.status = status;
    if (status === STATUS.DELIVERED && !workOrder.deliveryDate) {
      workOrder.deliveryDate = new Date();
    }
  }

  const updatedWorkOrder = await workOrder.save();

  return response.success(res, "تم تعديل الطلب بنجاح", updatedWorkOrder);
});

/**
 * @desc    Delete work order
 * @route   DELETE /api/work-orders/:id
 */
const deleteWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await WorkOrder.findById(req.params.id);

  if (!workOrder) {
    return response.notFound(res, "الطلب غير موجود");
  }

  // Soft delete: hidden from the app but kept for history/statistics
  await workOrder.softDelete();

  return response.success(res, "تم حذف الطلب بنجاح", workOrder);
});

module.exports = {
  getAllWorkOrders,
  getStatistics,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
};
