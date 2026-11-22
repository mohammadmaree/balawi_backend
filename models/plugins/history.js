const mongoose = require("mongoose");

/**
 * Change history plugin
 * Every time a tracked field changes, an entry is appended to `history`:
 *   { at: Date, field: "paidAmount", from: 20, to: 50 }
 * This keeps the full timeline (payments, status changes, price changes,
 * measurement changes...) so any statistic can be computed later.
 *
 * Initial values are not duplicated here: they are the document's values
 * at createdAt (i.e. the "from" of the first change, or the current value).
 *
 * The history is not sent in API responses (removed in toJSON by the model).
 */
module.exports = function historyPlugin(schema, { fields }) {
  schema.add({
    history: {
      type: [
        {
          _id: false,
          at: { type: Date, required: true },
          field: { type: String, required: true },
          from: mongoose.Schema.Types.Mixed,
          to: mongoose.Schema.Types.Mixed,
        },
      ],
      default: [],
    },
  });

  // Remember original values when a document is loaded from the database
  const snapshot = (doc) => {
    doc.$locals.original = {};
    for (const field of fields) {
      doc.$locals.original[field] = doc.get(field);
    }
  };

  schema.post("init", snapshot);

  schema.pre("save", function (next) {
    if (this.isNew) return next();

    const original = this.$locals.original || {};
    const at = new Date();

    for (const field of fields) {
      if (!this.isModified(field)) continue;
      const from = original[field] ?? null;
      const to = this.get(field) ?? null;
      if (String(from) === String(to)) continue;
      this.history.push({ at, field, from, to });
    }

    next();
  });

  // Keep snapshot in sync if the same document is saved again
  schema.post("save", snapshot);
};
