
/**
 * @fileoverview Mongoose schema for SuperAdmin accounts
 * @module models/superAdminModel
 */

const mongoose = require("mongoose");

/**
 * Schema for SuperAdmin users
 * @typedef {Object} SuperAdmin
 * @property {string|null}   profilePicture      - URL to profile image
 * @property {string}        userName            - Display name
 * @property {string}        email               - Unique login email
 * @property {string}        password            - Hashed password
 * @property {string}        role                - Always "SUPERADMIN"
 * @property {boolean}       isActive            - Account active status
 * @property {Date|null}     lastLogin           - Timestamp of last successful login
 * @property {number}        loginAttempts       - Count of consecutive failed attempts
 * @property {Date|null}     lockUntil           - Time when account lock expires
 * @property {string|null}   sessionId           - Current session identifier
 * @property {string|null}   passwordResetToken  - Token for password reset
 * @property {Date|null}     passwordResetExpires - Expiration time for reset token
 * @property {Date}          createdAt
 * @property {Date}          updatedAt
 */
const superAdminSchema = new mongoose.Schema(
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

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["SUPERADMIN"],
      default: "SUPERADMIN",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

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
  },
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
