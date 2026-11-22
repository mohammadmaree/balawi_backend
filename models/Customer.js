const mongoose = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete");
const historyPlugin = require("./plugins/history");

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

// Keep deleted customers and a full change history (for future statistics)
customerSchema.plugin(softDeletePlugin);
customerSchema.plugin(historyPlugin, {
  fields: [
    "fullName",
    "phoneNumber",
    "pantsHeight",
    "waistWidth",
    "pantsLegWidth",
    "type",
    "notes",
  ],
});

// Internal fields are not sent to the app
customerSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.history;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

// Index for duplicate phone lookups
customerSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model("Customer", customerSchema);
