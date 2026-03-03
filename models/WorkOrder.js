const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
    },
    shelfNumber: {
      type: String,
      required: [true, "Shelf number is required"],
      trim: true,
      enum: ["1", "2", "3", "4", "ارض", "طاولة"],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "Paid amount cannot be negative"],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["جاهز", "تم التسليم"],
        message: "Status must be either 'جاهز' or 'تم التسليم'",
      },
      default: "جاهز",
    },
    workDescription: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    deliveryDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index for better search performance
workOrderSchema.index({ customerName: "text" });
workOrderSchema.index({ status: 1 });
workOrderSchema.index({ shelfNumber: 1 });
workOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WorkOrder", workOrderSchema);
