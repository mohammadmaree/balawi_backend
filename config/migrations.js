/**
 * Data migrations that run automatically on server start, before accepting requests.
 * Each one is idempotent: it only touches documents that still need it,
 * so running it again does nothing.
 *
 * Uses the native collection (no mongoose hooks) so soft-deleted orders
 * are migrated too and history is not polluted.
 */
const mongoose = require("mongoose");
const WorkOrder = require("../models/WorkOrder");
const { Counter, FIRST_ORDER_NUMBER, initCounter, nextSequence } = require("../models/Counter");

// 1) Orders created before the payments list existed:
//    turn the stored paidAmount into one payment so totals stay the same.
const backfillPayments = async () => {
  const orders = await WorkOrder.collection
    .find({ payments: { $exists: false } })
    .project({ paidAmount: 1, createdAt: 1 })
    .toArray();

  for (const order of orders) {
    const amount = order.paidAmount || 0;
    const payments =
      amount > 0
        ? [
            {
              _id: new mongoose.Types.ObjectId(),
              amount,
              paidAt: order.createdAt || new Date(),
              note: "مبلغ مدفوع قبل تفعيل سجل الدفعات",
            },
          ]
        : [];
    await WorkOrder.collection.updateOne({ _id: order._id }, { $set: { payments } });
  }

  if (orders.length > 0) console.log(`Migration: payments added to ${orders.length} orders`);
};

// 2) Orders created before order numbers existed:
//    number them by creation date, using the same counter as new orders.
const backfillOrderNumbers = async () => {
  await initCounter("workOrder", FIRST_ORDER_NUMBER);

  const orders = await WorkOrder.collection
    .find({ orderNumber: { $exists: false } })
    .sort({ createdAt: 1, _id: 1 })
    .project({ _id: 1 })
    .toArray();

  for (const order of orders) {
    const orderNumber = await nextSequence("workOrder");
    await WorkOrder.collection.updateOne(
      { _id: order._id, orderNumber: { $exists: false } },
      { $set: { orderNumber } }
    );
  }

  if (orders.length > 0) console.log(`Migration: order numbers added to ${orders.length} orders`);

  // Safety: the counter must never be behind existing numbers
  // (e.g. after restoring orders from a backup without the counters collection)
  const [max] = await WorkOrder.collection
    .find({ orderNumber: { $exists: true } })
    .sort({ orderNumber: -1 })
    .limit(1)
    .project({ orderNumber: 1 })
    .toArray();
  if (max) {
    await Counter.updateOne({ _id: "workOrder" }, { $max: { seq: max.orderNumber } });
  }
};

const runMigrations = async () => {
  await backfillPayments();
  await backfillOrderNumbers();
};

module.exports = runMigrations;
