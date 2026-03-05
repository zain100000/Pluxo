/**
 * @file Token generation utilities
 * @module helpers/tokenHelper
 * @description Cryptographically secure token generation for session IDs, OTP, password resets.
 */

const crypto = require("crypto");

/**
 * Generate a 32-byte cryptographically secure token
 * @returns {string} Hex token
 */
exports.generateSecureToken = () => crypto.randomBytes(32).toString("hex");

/**
 * Generate a short 16-byte token for OTP/2FA
 * @returns {string} Hex token
 */
exports.generateShortToken = () => crypto.randomBytes(16).toString("hex");

/**
 * Generate a time-bound token for password reset
 * @param {number} ttlMinutes
 * @returns {{ token: string, expiresAt: number }}
 */
exports.generateTimeBoundToken = (ttlMinutes = 30) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  return { token, expiresAt };
};

/**
 * Verify if a time-bound token is still valid
 * @param {number} expiresAt - Expiration timestamp
 * @returns {boolean} True if token not expired
 */
exports.verifyTimeBoundToken = (expiresAt) => Date.now() <= expiresAt;