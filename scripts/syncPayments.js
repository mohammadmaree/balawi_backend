/**
 * One-off migration: recompute isPaid for existing work orders
 * (isPaid = price > 0 && paidAmount >= price)
 * and report orders where paidAmount > price (need manual fix).
 *
 * Run: npm run migrate:payments
 */
require("dotenv").config();
const mongoose = require("mongoose");
const WorkOrder = require("../models/WorkOrder");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/balawi_db");

  const result = await WorkOrder.updateMany({}, [
    {
      $set: {
        isPaid: {
          $and: [{ $gt: ["$price", 0] }, { $gte: ["$paidAmount", "$price"] }],
        },
      },
    },
  ]);
  console.log(`isPaid recomputed. Modified: ${result.modifiedCount}`);

  const overpaid = await WorkOrder.find({ $expr: { $gt: ["$paidAmount", "$price"] } })
    .select("_id customerName price paidAmount")
    .lean();
  if (overpaid.length > 0) {
    console.warn(`⚠️  ${overpaid.length} orders have paidAmount > price (fix manually):`);
    console.table(overpaid);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
