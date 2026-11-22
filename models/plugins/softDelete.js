/**
 * Soft delete plugin
 * - Deleted documents are kept in the database (isDeleted + deletedAt)
 *   so historical statistics can always be computed later.
 * - All find / count / aggregate queries hide deleted documents automatically.
 * - To include them (e.g. for future reports): query.setOptions({ withDeleted: true })
 *   or Model.aggregate(pipeline).option({ withDeleted: true })
 */
module.exports = function softDeletePlugin(schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  });

  function excludeDeleted() {
    if (this.getOptions().withDeleted) return;
    if (this.getFilter().isDeleted !== undefined) return; // caller decides
    this.where({ isDeleted: { $ne: true } });
  }

  schema.pre(/^find/, excludeDeleted);
  schema.pre("countDocuments", excludeDeleted);

  schema.pre("aggregate", function () {
    if (this.options.withDeleted) return;
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  });

  // Mark as deleted instead of removing.
  // Validation is skipped so old/invalid records can still be deleted.
  schema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save({ validateBeforeSave: false });
  };
};
