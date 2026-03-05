/**
 * @fileoverview SuperAdmin controller – authentication & profile
 * @module controllers/superAdminController
 * @description Handles registration, login (encrypted JWT + session), profile fetch, logout.
 */

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const SuperAdmin = require("../../models/super-admin-model/super-admin.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utilities/cloudinary-utility/cloudinary.utility");
const {
  passwordRegex,
  hashPassword,
} = require("../../helpers/password-helper/password.helper");
const {
  generateEncryptedToken,
} = require("../../middlewares/auth-middleware/auth.middleware");

/**
 * Register new SuperAdmin
 * @body {string} userName
 * @body {string} email
 * @body {string} password
 * @files {profilePicture?}
 * @access Public (consider restricting in production)
 */
exports.registerSuperAdmin = async (req, res) => {
  let uploadedUrl = null;

  try {
    const { userName, email, password } = req.body;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8+ chars with upper, lower, number, special",
      });
    }

    if (await SuperAdmin.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    let profilePicture = null;
    if (req.files?.profilePicture?.[0]) {
      const result = await uploadToCloudinary(
        req.files.profilePicture[0],
        "profilePicture",
      );
      profilePicture = result.url;
      uploadedUrl = result.url;
    }

    const superAdmin = new SuperAdmin({
      profilePicture,
      userName,
      email: email.toLowerCase(),
      password: await hashPassword(password),
      role: "SUPERADMIN",
      isActive: true,
    });

    await superAdmin.save();

    res.status(201).json({
      success: true,
      message: "SuperAdmin registered successfully",
    });
  } catch (error) {
    if (uploadedUrl)
      await deleteFromCloudinary(uploadedUrl).catch(console.error);
    console.error("Register superadmin error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * Login SuperAdmin → encrypted JWT
 * @body {string} email
 * @body {string} password
 * @access Public
 */
exports.loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const admin = await SuperAdmin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Lockout check
    if (admin.lockUntil && admin.lockUntil > Date.now()) {
      const mins = Math.ceil((admin.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${mins} minutes.`,
      });
    }

    // Reset lock if expired
    if (admin.lockUntil && admin.lockUntil <= Date.now()) {
      admin.loginAttempts = 0;
      admin.lockUntil = null;
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      admin.loginAttempts += 1;
      if (admin.loginAttempts >= 3) {
        admin.lockUntil = Date.now() + 30 * 60 * 1000;
      }
      await admin.save();

      return res.status(401).json({
        success: false,
        message: admin.lockUntil
          ? "Account locked (30 min)"
          : "Invalid credentials",
      });
    }

    // Successful login
    admin.loginAttempts = 0;
    admin.lockUntil = null;
    admin.lastLogin = new Date();
    admin.sessionId = crypto.randomBytes(32).toString("hex");
    await admin.save();

    const token = generateEncryptedToken({
      role: "SUPERADMIN",
      user: { id: admin._id.toString(), email: admin.email },
      sessionId: admin.sessionId,
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "SuperAdmin logged in successfully",
      admin: {
        id: admin._id,
        userName: admin.userName,
        email: admin.email,
      },
      token,
    });
  } catch (error) {
    console.error("SuperAdmin login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

/**
 * Get SuperAdmin profile
 * @param {string} superAdminId
 * @access Private
 */
exports.getSuperAdminById = async (req, res) => {
  try {
    const admin = await SuperAdmin.findById(req.params.superAdminId).select(
      "-password -__v",
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "SuperAdmin not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      superAdmin: admin,
    });
  } catch (error) {
    console.error("Get superadmin error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/**
 * Logout SuperAdmin
 * @access Private
 */
exports.logoutSuperAdmin = async (req, res) => {
  try {
    if (req.user?.id) {
      await SuperAdmin.findByIdAndUpdate(req.user.id, {
        sessionId: null,
      });
    }

    res.clearCookie("accessToken", { httpOnly: true, sameSite: "strict" });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
