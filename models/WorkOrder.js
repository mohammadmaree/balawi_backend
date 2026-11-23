const mongoose = require("mongoose");
const { SHELVES, STATUS, STATUSES } = require("../config/constants");
const softDeletePlugin = require("./plugins/softDelete");
const historyPlugin = require("./plugins/history");
const { nextSequence } = require("./Counter");

// One payment made by the customer
const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, "مبلغ الدفعة مطلوب"],
      // Negative amounts are only created automatically as corrections
      validate: {
        validator: (v) => v !== 0,
        message: "مبلغ الدفعة يجب أن يكون أكبر من صفر",
      },
    },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const workOrderSchema = new mongoose.Schema(
  {
    // Short sequential number written on the item tag (e.g. 1023)
    orderNumber: {
      type: Number,
      unique: true,
      sparse: true,
      immutable: true,
    },
    customerName: {
      type: String,
      required: [true, "اسم الزبون مطلوب"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
    },
    shelfNumber: {
      type: String,
      required: [true, "رقم الرف مطلوب"],
      trim: true,
      enum: {
        values: SHELVES,
        message: `رقم الرف يجب أن يكون أحد القيم: ${SHELVES.join("، ")}`,
      },
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "السعر لا يمكن أن يكون سالباً"],
    },
    // All payments with their dates. paidAmount is always their sum.
    payments: {
      type: [paymentSchema],
      default: [],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "المبلغ المدفوع لا يمكن أن يكون سالباً"],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      required: [true, "الحالة مطلوبة"],
      enum: {
        values: STATUSES,
        message: `الحالة يجب أن تكون أحد القيم: ${STATUSES.join("، ")}`,
      },
      default: STATUS.NOT_READY,
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

// Assign the next short order number to new orders
workOrderSchema.pre("validate", async function () {
  if (this.isNew && this.orderNumber == null) {
    this.orderNumber = await nextSequence("workOrder");
  }
});

// Keep payment fields consistent:
// - paidAmount is the sum of payments
// - paidAmount cannot exceed price
// - isPaid is derived from amounts (fully paid and price > 0)
workOrderSchema.pre("validate", function (next) {
  if (this.isNew || this.isModified("payments")) {
    const sum = this.payments.reduce((total, p) => total + (p.amount || 0), 0);
    this.paidAmount = Math.round(sum * 100) / 100;
  }

  const price = this.price || 0;
  const paid = this.paidAmount || 0;

  if (paid > price) {
    this.invalidate("paidAmount", "المبلغ المدفوع لا يمكن أن يكون أكبر من السعر");
  }

  this.isPaid = price > 0 && paid >= price;
  next();
});

// Keep deleted orders and a full change history (for future statistics)
workOrderSchema.plugin(softDeletePlugin);
workOrderSchema.plugin(historyPlugin, {
  fields: [
    "customerName",
    "phoneNumber",
    "shelfNumber",
    "price",
    "paidAmount",
    "status",
    "workDescription",
    "notes",
  ],
});

// Internal fields are not sent to the app
workOrderSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.history;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

// Indexes for filters and sorting
workOrderSchema.index({ status: 1 });
workOrderSchema.index({ shelfNumber: 1 });
workOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WorkOrder", workOrderSchema);
