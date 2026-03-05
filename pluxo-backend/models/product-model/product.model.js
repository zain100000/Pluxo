/**
 * @fileoverview Mongoose schema for products in the NIDRIP application
 * @module models/productModel
 */

const mongoose = require("mongoose");

/**
 * Sub-schema for product variations (e.g., Different colors, sizes, or materials)
 */
const variantSchema = new mongoose.Schema(
  {
    attributes: {
      type: Map, // e.g., { "color": "Red", "size": "XL" }
      of: String,
      required: true,
    },
    price: {
      type: Number, // Overrides base price if specific variant is more expensive
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allows nulls if SKU isn't provided for all
    },
  },
  { _id: true },
); // We keep ID here so the cart can reference a specific variant ID if needed

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewText: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    productImage: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 5,
        message: "You can upload a maximum of 5 images per product",
      },
    },
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },

    // Base price for the product
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    discount: {
      type: Number, // Percentage (e.g., 10 for 10%)
      default: 0,
      min: 0,
      max: 100,
    },

    offerPrice: {
      type: Number, // Calculated: price * (1 - discount/100)
      default: 0,
    },

    category: {
      type: [String],
      required: [true, "At least one category is required"],
      index: true, // Added index for faster filtering
    },

    // Global stock (or sum of variants)
    stock: { type: Number, default: 0, min: [0, "Stock cannot be negative"] },

    // NEW: Product Variants to support your Cart "attributes"
    variants: [variantSchema],

    // NEW: Dynamic Attribute Definitions
    // (e.g., defines that this product HAS "Size" and "Color" options)
    availableAttributes: [
      {
        name: { type: String }, // e.g., "Color"
        values: [{ type: String }], // e.g., ["Red", "Blue"]
      },
    ],

    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },

    ratings: [ratingSchema],
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },

    reviews: [reviewSchema],
    totalReviews: { type: Number, default: 0 },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: [true, "Product must be attributed to a Super Admin"],
    },

    specifications: [
      {
        section: { type: String, required: true, trim: true },
        items: [
          {
            name: { type: String, required: true, trim: true },
            value: { type: String, required: true, trim: true },
          },
        ],
      },
    ],

    saleEndDate: {
      type: Date,
    },

    isOnSale: {
      type: Boolean,
      default: false,
    },
    
    restockThreshold: {
      type: Number,
      default: 10, // Alert when stock is below this
    },
  },
  { timestamps: true },
);

// Middleware to calculate total stock from variants before saving
productSchema.pre("save", function () {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((acc, variant) => acc + variant.stock, 0);
  }
});

productSchema.pre("save", function () {
  if (this.price) {
    // Math: Final = Original * (1 - (Percentage / 100))
    this.offerPrice = Math.round(this.price * (1 - this.discount / 100));
  }
});

module.exports = mongoose.model("Product", productSchema);
