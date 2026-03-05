/**
 * @fileoverview Mongoose schema for User Carts in the NIDRIP application
 * @module models/cartModel
 */

const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },
  // Captures the specific variation chosen by the user
  // Example: { "Color": "Sky Blue" }
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"],
    default: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalItemPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One cart per user
    },
    items: [cartItemSchema],
    // Total price for all items in the cart
    billDetails: {
      totalItemsPrice: { type: Number, default: 0 }, // Sum of totalItemPrice
      shippingCharges: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ABANDONED", "CONVERTED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Middleware: Automatically calculate billDetails before saving
 * This ensures your totals are always in sync with the items array.
 */
cartSchema.pre("save", function () {
  if (this.items.length > 0) {
    this.billDetails.totalItemsPrice = this.items.reduce(
      (acc, item) => acc + item.totalItemPrice,
      0
    );
    // Only apply shipping if items exist
    this.billDetails.shippingCharges = this.billDetails.totalItemsPrice > 100 ? 0 : 10;
  } else {
    // If cart is empty, everything MUST be zero
    this.billDetails.totalItemsPrice = 0;
    this.billDetails.shippingCharges = 0;
  }

  this.billDetails.grandTotal =
    this.billDetails.totalItemsPrice + this.billDetails.shippingCharges;
    
});


module.exports = mongoose.model("Cart", cartSchema);
