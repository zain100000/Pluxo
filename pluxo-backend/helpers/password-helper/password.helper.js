
/**
 * @fileoverview Password utilities for secure handling
 * @module helpers/passwordHelper
 */

const bcrypt = require("bcrypt");

/**
 * Regex for strong password validation
 * Requires: min 6 chars, uppercase, lowercase, number, special character
 * @type {RegExp}
 */
exports.passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{6,}$/;

/**
 * Validate password strength
 * @param {string} password - Password to check
 * @returns {{ valid: boolean, message: string }}
 */
exports.validatePasswordStrength = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password must be a non-empty string" };
  }

  if (!exports.passwordRegex.test(password)) {
    return {
      valid: false,
      message:
        "Password must be at least 6 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 special character.",
    };
  }

  return { valid: true, message: "Password meets strength requirements" };
};

/** Recommended bcrypt salt rounds */
const SALT_ROUNDS = 12;

/**
 * Hash a password with bcrypt
 * @async
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Hashed password
 */
exports.hashPassword = async (password) => {
  if (!password) throw new Error("Password is required for hashing");
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare plaintext password against hashed version
 * @async
 * @param {string} plain  - Plaintext password to check
 * @param {string} hashed - Stored bcrypt hash
 * @returns {Promise<boolean>} True if passwords match
 */
exports.comparePassword = async (plain, hashed) => {
  if (!plain || !hashed) return false;
  return bcrypt.compare(plain, hashed);
};
