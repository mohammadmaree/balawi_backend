const mongoose = require("mongoose");

/**
 * Atomic sequence counters (e.g. short work order numbers)
 * { _id: "workOrder", seq: 1023 }
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const Counter = mongoose.model("Counter", counterSchema);

// First work order number will be FIRST_ORDER_NUMBER
const FIRST_ORDER_NUMBER = 1001;

// Make sure the counter exists and starts at the right value
const initCounter = (name, start) =>
  Counter.updateOne({ _id: name }, { $setOnInsert: { seq: start - 1 } }, { upsert: true });

// Atomically get the next number (safe with concurrent requests)
const nextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = { Counter, FIRST_ORDER_NUMBER, initCounter, nextSequence };
