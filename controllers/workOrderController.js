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

// Parse a money amount from the request (number or numeric string), rounded to 2 decimals
const toAmount = (value) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
};

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

  // Search by customer name, or by order number ("1023" or "#1023")
  if (search) {
    const nameMatch = { customerName: { $regex: escapeRegex(search), $options: "i" } };
    const numberMatch = search.match(/^#?(\d+)$/);
    query.$or = numberMatch
      ? [nameMatch, { orderNumber: Number(numberMatch[1]) }]
      : [nameMatch];
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

  // Amount paid on creation becomes the first payment.
  // isPaid=true without paidAmount means fully paid.
  const finalPrice = price || 0;
  let firstPayment = paidAmount === undefined ? 0 : toAmount(paidAmount);
  if (firstPayment === null) {
    return response.badRequest(res, "المبلغ المدفوع غير صالح");
  }
  if (isPaid === true && paidAmount === undefined) {
    firstPayment = Number(finalPrice) || 0;
  }

  const workOrder = await WorkOrder.create({
    customerName,
    phoneNumber,
    shelfNumber,
    price: finalPrice,
    payments: firstPayment > 0 ? [{ amount: firstPayment }] : [],
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
  if (workDescription !== undefined) workOrder.workDescription = workDescription;
  if (notes !== undefined) workOrder.notes = notes;

  // Backward compatibility: clients that send a total paidAmount (or only isPaid)
  // instead of using /payments. The difference is recorded as a payment
  // (or a negative correction), so the payments list always matches the total.
  let targetPaid = null;
  if (paidAmount !== undefined) {
    targetPaid = toAmount(paidAmount);
    if (targetPaid === null) {
      return response.badRequest(res, "المبلغ المدفوع غير صالح");
    }
  } else if (isPaid === true) {
    targetPaid = Number(workOrder.price) || 0;
  } else if (isPaid === false && workOrder.isPaid) {
    targetPaid = 0;
  }
  if (targetPaid !== null) {
    const diff = Math.round((targetPaid - (workOrder.paidAmount || 0)) * 100) / 100;
    if (diff !== 0) {
      workOrder.payments.push({ amount: diff, note: diff < 0 ? "تصحيح المبلغ المدفوع" : "" });
    }
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

/**
 * @desc    Add a payment to a work order
 * @route   POST /api/work-orders/:id/payments
 * @body    amount (required, > 0), note (optional), paidAt (optional date, default now)
 * @returns The updated work order
 */
const addPayment = asyncHandler(async (req, res) => {
  const amount = toAmount(req.body.amount);
  if (amount === null || amount <= 0) {
    return response.badRequest(res, "مبلغ الدفعة يجب أن يكون رقماً أكبر من صفر");
  }

  let paidAt = new Date();
  if (req.body.paidAt !== undefined) {
    paidAt = parseDate(req.body.paidAt);
    if (!paidAt) {
      return response.badRequest(res, "تاريخ الدفعة غير صالح");
    }
  }

  const note = typeof req.body.note === "string" ? req.body.note : "";

  const workOrder = await WorkOrder.findById(req.params.id);
  if (!workOrder) {
    return response.notFound(res, "الطلب غير موجود");
  }

  const remaining = (workOrder.price || 0) - (workOrder.paidAmount || 0);
  if (amount > remaining) {
    return response.badRequest(res, `المبلغ أكبر من المتبقي (${remaining})`);
  }

  workOrder.payments.push({ amount, paidAt, note });
  const updatedWorkOrder = await workOrder.save();

  return response.created(res, "تم إضافة الدفعة بنجاح", updatedWorkOrder);
});

/**
 * @desc    Delete a payment from a work order (e.g. entered by mistake)
 * @route   DELETE /api/work-orders/:id/payments/:paymentId
 * @returns The updated work order
 */
const deletePayment = asyncHandler(async (req, res) => {
  const workOrder = await WorkOrder.findById(req.params.id);
  if (!workOrder) {
    return response.notFound(res, "الطلب غير موجود");
  }

  const payment = workOrder.payments.id(req.params.paymentId);
  if (!payment) {
    return response.notFound(res, "الدفعة غير موجودة");
  }

  payment.deleteOne();
  const updatedWorkOrder = await workOrder.save();

  return response.success(res, "تم حذف الدفعة بنجاح", updatedWorkOrder);
});

module.exports = {
  getAllWorkOrders,
  getStatistics,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  addPayment,
  deletePayment,
};
