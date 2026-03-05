/**
 * @fileoverview Password reset utilities (token generation + secure reset)
 * @module services/passwordService
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const {
  passwordRegex,
  hashPassword,
} = require("../../helpers/password-helper/password.helper");

// Validate required secret
if (!process.env.PASSWORD_RESET_SECRET) {
  throw new Error("Missing PASSWORD_RESET_SECRET in environment");
}

const SECRET = process.env.PASSWORD_RESET_SECRET;

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {{ iv: string, ciphertext: string, authTag: string }}
 */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(SECRET, "hex"),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    authTag: authTag.toString("hex"),
  };
};

/**
 * Decrypt AES-256-GCM encrypted payload
 * @param {{ iv: string, ciphertext: string, authTag: string }} payload
 * @returns {string} Decrypted plaintext
 */
const decrypt = (payload) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(SECRET, "hex"),
    Buffer.from(payload.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

/**
 * Generate encrypted password reset token (AES-256-GCM + JWT)
 * @param {{ id: string, role: string }} payload - User ID and role
 * @param {string} [expiresIn="1h"] - Token expiration
 * @returns {string} Base64url-encoded encrypted token
 */
const generateResetToken = (payload, expiresIn = "1h") => {
  const token = jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    expiresIn,
  });

  const encrypted = encrypt(token);
  return Buffer.from(JSON.stringify(encrypted)).toString("base64url");
};

/**
 * Verify and decode encrypted password reset token
 * @param {string} token - Encrypted base64url token
 * @returns {{ id: string, role: string, iat: number, exp: number }} Decoded payload
 * @throws {Error} If token is invalid, tampered, or expired
 */
const verifyResetToken = (token) => {
  try {
    const encryptedPayload = JSON.parse(
      Buffer.from(token, "base64url").toString(),
    );

    const decrypted = decrypt(encryptedPayload);
    return jwt.verify(decrypted, SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    throw new Error("Invalid or expired reset token");
  }
};

/**
 * Perform secure password reset on user document
 * @param {import('mongoose').Document} userDoc - Mongoose user document
 * @param {string} newPassword - New password to set
 * @throws {Error} If password is weak or matches current password
 */
const resetUserPassword = async (userDoc, newPassword) => {
  if (!passwordRegex.test(newPassword)) {
    throw new Error("Password does not meet complexity requirements");
  }

  const isSame = await bcrypt.compare(newPassword, userDoc.password);
  if (isSame) {
    throw new Error("New password cannot match the old password");
  }

  userDoc.password = await hashPassword(newPassword);
  userDoc.passwordChangedAt = new Date();
  userDoc.sessionId = crypto.randomBytes(32).toString("hex");

  await userDoc.save();
};

module.exports = {
  generateResetToken,
  verifyResetToken,
  resetUserPassword,
};
