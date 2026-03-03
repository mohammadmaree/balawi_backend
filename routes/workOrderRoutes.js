const express = require("express");
const router = express.Router();
const {
  getAllWorkOrders,
  getStatistics,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
} = require("../controllers/workOrderController");

// GET /api/work-orders/statistics - Get statistics (must be before /:id route)
router.get("/statistics", getStatistics);

// GET /api/work-orders - Get all work orders (with filters, search, pagination)
router.get("/", getAllWorkOrders);

// GET /api/work-orders/:id - Get single work order by ID
router.get("/:id", getWorkOrderById);

// POST /api/work-orders - Create new work order
router.post("/", createWorkOrder);

// PUT /api/work-orders/:id - Update work order
router.put("/:id", updateWorkOrder);

// DELETE /api/work-orders/:id - Delete work order
router.delete("/:id", deleteWorkOrder);

module.exports = router;
