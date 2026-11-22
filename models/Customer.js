const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "اسم الزبون مطلوب"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
    },
    pantsHeight: {
      type: Number,
      default: 0,
    },
    waistWidth: {
      type: Number,
      default: 0,
    },
    pantsLegWidth: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      trim: true,
      default: "عادي",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index for duplicate phone lookups
customerSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model("Customer", customerSchema);
