/**
 * @fileoverview Express routes for password reset flow
 * @module routes/passwordRoutes
 */

const express = require("express");
const router = express.Router();

const sharedController = require("../../controllers/shared-controller/shared-password.reset.controller");

/**
 * @description Request password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
router.post("/forgot-password", sharedController.forgotPassword);

/**
 * @description Reset password using valid token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
router.post("/reset-password/:token", sharedController.resetPassword);

/**
 * @description Verify if reset token is valid and not expired
 * @route   POST /api/auth/verify-token/:token
 * @access  Public
 */
router.post("/verify-token/:token", sharedController.verifyToken);

module.exports = router;
