/**
 * @fileoverview Mongoose schema for customer users
 * @module models/userModel
 */

const mongoose = require("mongoose");

/**
 * Schema for user accounts
 * @typedef {Object} User
 * @property {string|null}   profilePicture           - URL to profile image
 * @property {string}        userName                 - Display name
 * @property {string}        email                    - Unique login email
 * @property {boolean}       isEmailVerified          - Email verification status
 * @property {string|null}   emailVerificationToken   - Token for email verification
 * @property {Date|null}     emailVerificationExpires - Expiration for email token
 * @property {string}        password                 - Hashed password
 * @property {Object}        phone                    - Structured phone with country code
 * @property {string}        phone.countryCode        - e.g. +92, +1, +44
 * @property {string}        phone.phoneNumber        - Local number without country code
 * @property {string}        [fullPhone]              - Virtual: full international number
 * @property {string|null}   address                  - Shipping/delivery address
 * @property {string}        [preferredCity]          - User's preferred delivery city (with flag)
 * @property {Object}        lastKnownLocation        - Last known geolocation
 * @property {string}        role                     - Always "USER"
 * @property {boolean}       isActive                 - Account active status
 * @property {Array}         cart                     - Embedded shopping cart items
 * @property {Array}         favorites                - Favorited products
 * @property {Array}         orders                   - Summary of order history
 * @property {Date|null}     lastLogin                - Last successful login time
 * @property {number}        loginAttempts            - Failed login counter
 * @property {Date|null}     lockUntil                - Account lock expiration
 * @property {string|null}   sessionId                - Active session identifier
 * @property {string|null}   passwordResetToken       - Reset token
 * @property {Date|null}     passwordResetExpires     - Reset token expiration
 * @property {Date}          createdAt
 * @property {Date}          updatedAt
 */
const userSchema = new mongoose.Schema(
  {
    profilePicture: {
      type: String,
      default: null,
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
    },

    password: {
      type: String,
      required: true,
    },

    // ────────────────────────────────────────────────
    // Structured phone number with country code
    // ────────────────────────────────────────────────
    phone: {
      countryCode: {
        type: String,
        default: null, // e.g. +92, +1, +44, +33, +49, +86
        trim: true,
      },
      phoneNumber: {
        type: String,
        default: null, // local number without country code
        trim: true,
      },
    },

    // Virtual getter for full international phone
    fullPhone: {
      type: String,
      get: function () {
        if (!this.phone?.countryCode || !this.phone?.phoneNumber) return null;
        return `${this.phone.countryCode}${this.phone.phoneNumber}`.replace(
          /\s+/g,
          "",
        );
      },
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    // Preferred delivery city (with emoji flag)
    preferredCity: {
      type: String,
      enum: [
        // Europe
        "🇬🇧 London, United Kingdom",
        "🇫🇷 Paris, France",
        "🇩🇪 Berlin, Germany",
        // USA
        "🇺🇸 New York, USA",
        "🇺🇸 Los Angeles, USA",
        "🇺🇸 Chicago, USA",
        // Asia
        "🇵🇰 Karachi, Pakistan",
        "🇮🇳 Mumbai, India",
        "🇨🇳 Beijing, China",
      ],
      default: null,
    },

    lastKnownLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },

    role: {
      type: String,
      enum: ["USER"],
      default: "USER",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ────────────────────────────────────────────────
    // Cart (Enhanced)
    // ────────────────────────────────────────────────
    cart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
          index: true,
        },
        // Store selected variations (e.g., { size: "M", color: "Red" })
        attributes: {
          type: Map,
          of: String,
          default: {},
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        unitPrice: {
          type: Number,
          min: 0,
        },
        totalPrice: {
          type: Number,
          min: 0,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ────────────────────────────────────────────────
    // Favorites (Enhanced)
    // ────────────────────────────────────────────────
    favorites: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ────────────────────────────────────────────────
    // Orders (Enhanced)
    // ────────────────────────────────────────────────
    orders: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        status: {
          type: String,
          enum: [
            "PENDING",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "RETURNED",
          ],
          default: "PENDING",
        },
        paymentStatus: {
          type: String,
          enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
          default: "PENDING",
        },
        totalAmount: {
          type: Number,
          min: 0,
        },
        placedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    lastLogin: {
      type: Date,
      default: null,
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    sessionId: {
      type: String,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // include virtuals like fullPhone in JSON
    toObject: { virtuals: true },
  },
);

module.exports = mongoose.model("User", userSchema);
