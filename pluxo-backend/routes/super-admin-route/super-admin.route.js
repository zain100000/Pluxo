
/**
 * @fileoverview Express routes for SuperAdmin authentication & management
 * @module routes/superAdminRoutes
 */

const express = require("express");
const router = express.Router();

const superAdminController = require("../../controllers/super-admin-controller/super-admin.controller");
const {
  encryptedAuthMiddleware,
  authLimiter,
} = require("../../middlewares/auth-middleware/auth.middleware");
const cloudinaryUtility = require("../../utilities/cloudinary-utility/cloudinary.utility");

/**
 * @description Register new SuperAdmin (with optional profile picture)
 * @route   POST /api/superadmin/signup-super-admin
 * @access  Public (should be restricted in production)
 */
router.post(
  "/signup-super-admin",
  cloudinaryUtility.upload,
  superAdminController.registerSuperAdmin,
);

/**
 * @description Login SuperAdmin → returns encrypted JWT
 * @route   POST /api/superadmin/signin-super-admin
 * @access  Public
 */
router.post(
  "/signin-super-admin",
  authLimiter,
  superAdminController.loginSuperAdmin,
);

/**
 * @description Get SuperAdmin profile details
 * @route   GET /api/superadmin/get-super-admin-by-id/:superAdminId
 * @access  Private (SuperAdmin)
 */
router.get(
  "/get-super-admin-by-id/:superAdminId",
  encryptedAuthMiddleware,
  superAdminController.getSuperAdminById,
);

/**
 * @description Logout → invalidate session
 * @route   POST /api/superadmin/logout-super-admin
 * @access  Private (SuperAdmin)
 */
router.post(
  "/logout-super-admin",
  encryptedAuthMiddleware,
  superAdminController.logoutSuperAdmin,
);

module.exports = router;
