const express = require("express");
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

// GET /api/customers - Get all customers (with optional search, filter, pagination)
router.get("/", getAllCustomers);

// GET /api/customers/:id - Get single customer by ID
router.get("/:id", getCustomerById);

// POST /api/customers - Create new customer
router.post("/", createCustomer);

// PUT /api/customers/:id - Update customer
router.put("/:id", updateCustomer);

// DELETE /api/customers/:id - Delete customer
router.delete("/:id", deleteCustomer);

module.exports = router;
