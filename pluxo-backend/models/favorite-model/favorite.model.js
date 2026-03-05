/**
 * @fileoverview Mongoose schema for User Favorites (Wishlist)
 * @module models/favoriteModel
 */

const mongoose = require("mongoose");

const favoriteItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Optional: User might want to favorite a specific color/variant
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One wishlist document per user
      index: true,
    },
    products: [favoriteItemSchema],
  },
  {
    timestamps: true,
  },
);

// Index to prevent duplicate products in the same wishlist
// Note: Only works if you aren't using specific attributes
// favoriteSchema.index({ "user": 1, "products.productId": 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);
