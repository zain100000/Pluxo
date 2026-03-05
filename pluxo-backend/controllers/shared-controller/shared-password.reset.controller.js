/**
 * @fileoverview Password reset controller
 * @module controllers/passwordController
 * @description Handles forgot password, reset, and token verification flows.
 */

const {
  generateResetToken,
  verifyResetToken,
  resetUserPassword,
} = require("../../services/password-service/password.service");
const SuperAdmin = require("../../models/super-admin-model/super-admin.model");
const User = require("../../models/user-model/user.model");
const {
  sendPasswordResetEmail,
} = require("../../helpers/email-helper/email.helper");

/**
 * Get model by role
 * @param {string} role
 * @returns {import('mongoose').Model}
 * @throws {Error} Invalid role
 */
const getModelByRole = (role) => {
  switch (role) {
    case "SUPERADMIN":
      return SuperAdmin;
    case "USER":
      return User;
    default:
      throw new Error("Invalid role");
  }
};

/**
 * Request password reset link
 * @body {string} email
 * @body {string} role
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email and role required",
      });
    }

    const Model = getModelByRole(role);
    const user = await Model.findOne({ email: email.toLowerCase() });

    // Always return success message (prevents enumeration)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If account exists, reset link sent",
      });
    }

    const token = generateResetToken({ id: user._id.toString(), role }, "1h");
    await sendPasswordResetEmail(email, token, role);

    res.status(200).json({
      success: true,
      message: "Password Reset link sent successfully",
      token // For testing purpose only - remove in production
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Reset password with token
 * @param {string} token
 * @body {string} newPassword
 * @access Public
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password required",
      });
    }

    const payload = verifyResetToken(token);
    const Model = getModelByRole(payload.role);
    const user = await Model.findById(payload.id);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    await resetUserPassword(user, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Invalid/expired token",
    });
  }
};

/**
 * Verify reset token validity
 * @param {string} token
 * @access Public
 */
exports.verifyToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token required",
      });
    }

    const payload = verifyResetToken(token);

    res.status(200).json({
      success: true,
      message: "Token is valid",
      expiresAt: payload.exp,
    });
  } catch (error) {
    console.error("Token verify error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Invalid or expired token",
    });
  }
};
