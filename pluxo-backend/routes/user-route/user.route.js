/**
 * @fileoverview Express routes for regular user authentication & profile
 * @module routes/userRoutes
 */

const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user-controller/user.controller");
const {
  encryptedAuthMiddleware,
  authLimiter,
} = require("../../middlewares/auth-middleware/auth.middleware");
const cloudinaryUtility = require("../../utilities/cloudinary-utility/cloudinary.utility");

/**
 * @description Register new regular user (with optional profile picture)
 * @route   POST /api/user/signup-user
 * @access  Public
 */
router.post(
  "/signup-user",
  cloudinaryUtility.upload,
  userController.registerUser,
);

/**
 * @description Login user → returns encrypted JWT
 * @route   POST /api/user/signin-user
 * @access  Public
 */
router.post("/signin-user", authLimiter, userController.loginUser);

/**
 * @description Get user profile details
 * @route   GET /api/user/get-user-by-id/:userId
 * @access  Private (Authenticated user)
 */
router.get(
  "/get-user-by-id/:userId",
  encryptedAuthMiddleware,
  userController.getUserById,
);

/**
 * @description Update user profile (name, phone, address, picture)
 * @route   PATCH /api/user/update-user/:userId
 * @access  Private (Authenticated user)
 */
router.patch(
  "/update-user/:userId",
  encryptedAuthMiddleware,
  cloudinaryUtility.upload,
  userController.updateProfile,
);

/**
 * @description Permanently delete user account
 * @route   DELETE /api/user/delete-user/:userId
 * @access  Private (Authenticated user)
 */
router.delete(
  "/delete-user/:userId",
  encryptedAuthMiddleware,
  userController.deleteAccount,
);

/**
 * @description Logout user → invalidate session
 * @route   POST /api/user/logout-user
 * @access  Private (Authenticated user)
 */
router.post("/logout-user", encryptedAuthMiddleware, userController.logoutUser);

/**
 * @description Update user location (latitude, longitude)
 * @route   PATCH /api/user/update-user-location/:userId
 * @access  Private (Authenticated user)
 */

router.patch(
  "/update-user-location/:userId",
  encryptedAuthMiddleware,
  userController.updateUserLocation,
);

/**
 * @description Send email verification OTP to user email
 * @route   POST /api/user/send-verification-email
 * @access  Public
 */

router.post(
  "/send-verification-email",
  encryptedAuthMiddleware,
  userController.requestEmailVerification,
);

/**
 * @description Verify email using OTP
 * @route   POST /api/user/verify-email
 * @access  Public
 */

router.post(
  "/verify-email",
  encryptedAuthMiddleware,
  userController.verifyEmail,
);

module.exports = router;
