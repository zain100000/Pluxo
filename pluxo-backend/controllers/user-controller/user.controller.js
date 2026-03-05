/**
 * @fileoverview User controller – authentication & profile
 * @module controllers/userController
 * @description Handles registration, login, profile updates, deletion, logout.
 */

const bcrypt = require("bcrypt");
const axios = require("axios");
const crypto = require("crypto");
const User = require("../../models/user-model/user.model");
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
const {
  sendEmailVerificationOtp,
} = require("../../helpers/email-helper/email.helper");

/**
 * Register new user
 * @body {string} userName
 * @body {string} email
 * @body {string} password
 * @body {string} [phone.countryCode]    – e.g. "+92", "+1", "+44"
 * @body {string} [phone.phoneNumber]    – local number without country code
 * @body {string} [address]
 * @files {profilePicture?}
 * @access Public
 */
exports.registerUser = async (req, res) => {
  let uploadedUrl = null;

  try {
    const { userName, email, password, phone = {}, address } = req.body;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8+ chars with upper, lower, number, special",
      });
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Validate phone if provided
    if (phone.countryCode || phone.phoneNumber) {
      if (!phone.countryCode || !phone.phoneNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Both countryCode and phoneNumber are required if phone is provided",
        });
      }
      // Basic length check (you can add more specific validation later)
      if (phone.phoneNumber.length < 7 || phone.phoneNumber.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Phone number should be 7–15 digits",
        });
      }
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

    const user = new User({
      profilePicture,
      userName,
      email: email.toLowerCase(),
      password: await hashPassword(password),
      phone:
        phone.countryCode && phone.phoneNumber
          ? {
              countryCode: phone.countryCode.trim(),
              phoneNumber: phone.phoneNumber.trim(),
            }
          : null,
      address,
      role: "USER",
      isActive: true,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        phone: user.phone ? { ...user.phone, fullPhone: user.fullPhone } : null,
      },
    });
  } catch (error) {
    if (uploadedUrl)
      await deleteFromCloudinary(uploadedUrl).catch(console.error);
    console.error("Register user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register user",
      error: error.message,
    });
  }
};

/**
 * Login user → encrypted JWT
 * @body {string} email
 * @body {string} password
 * @access Public
 */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Lockout handling
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${mins} minutes.`,
      });
    }

    if (user.lockUntil && user.lockUntil <= Date.now()) {
      user.loginAttempts = 0;
      user.lockUntil = null;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 3) {
        user.lockUntil = Date.now() + 30 * 60 * 1000;
      }
      await user.save();

      return res.status(401).json({
        success: false,
        message: user.lockUntil
          ? "Account locked (30 min)"
          : "Invalid credentials",
      });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    user.sessionId = crypto.randomBytes(32).toString("hex");
    await user.save();

    const token = generateEncryptedToken({
      role: "USER",
      user: { id: user._id.toString(), email: user.email },
      sessionId: user.sessionId,
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/**
 * Get user profile
 * @param {string} userId
 * @access Private
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "-password -__v",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/**
 * Update user profile
 * @param {string} userId
 * @body {string} [userName]
 * @body {Object} [phone]                 – { countryCode, phoneNumber }
 * @body {string} [address]
 * @body {string} [preferredCity]
 * @files {profilePicture?}
 * @access Private
 */
exports.updateProfile = async (req, res) => {
  let uploadedUrl = null;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (req.body.userName) user.userName = req.body.userName.trim();

    // Handle phone update (partial allowed)
    if (req.body.phone) {
      const { countryCode, phoneNumber } = req.body.phone;

      if (countryCode !== undefined) {
        user.phone = user.phone || {};
        user.phone.countryCode = countryCode.trim() || null;
      }

      if (phoneNumber !== undefined) {
        user.phone = user.phone || {};
        user.phone.phoneNumber = phoneNumber.trim() || null;
      }

      // Optional: clear phone if both are empty
      if (!user.phone?.countryCode && !user.phone?.phoneNumber) {
        user.phone = null;
      }
    }

    if (req.body.address) user.address = req.body.address.trim();

    if (req.body.preferredCity) {
      // Validate against enum (optional – mongoose will throw if invalid)
      user.preferredCity = req.body.preferredCity;
    }

    if (req.files?.profilePicture?.[0]) {
      if (user.profilePicture) {
        await deleteFromCloudinary(user.profilePicture).catch(console.error);
      }

      const result = await uploadToCloudinary(
        req.files.profilePicture[0],
        "profilePicture",
      );
      user.profilePicture = result.url;
      uploadedUrl = result.url;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      updatedUser: user,
    });
  } catch (error) {
    if (uploadedUrl)
      await deleteFromCloudinary(uploadedUrl).catch(console.error);
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * Delete user account
 * @param {string} userId
 * @body {string} reason
 * @access Private
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Reason required (min 5 characters)",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.profilePicture) {
      await deleteFromCloudinary(user.profilePicture).catch(console.error);
    }

    await User.findByIdAndDelete(userId);

    res.clearCookie("accessToken", { httpOnly: true, sameSite: "strict" });

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/**
 * Logout user
 * @access Private
 */
exports.logoutUser = async (req, res) => {
  try {
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, { sessionId: null });
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

/**
 * Update user location with reverse geocoding
 * @access Private
 */
exports.updateUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required",
      });
    }

    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;

    const geoResponse = await axios.get(geoUrl, {
      headers: { "User-Agent": "NiDrip-App/1.0" },
    });

    const fetchedAddress =
      geoResponse?.data?.display_name || "Unknown Location";

    const updatePayload = {
      lastKnownLocation: {
        latitude,
        longitude,
        address: fetchedAddress,
      },
      address: fetchedAddress, // sync root address
      updatedAt: new Date(),
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { new: true },
    ).select("-password -__v");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      updatedLocation: updatedUser,
    });
  } catch (error) {
    console.error("Update Location Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating location",
    });
  }
};

/**
 * Request 6-digit OTP to verify email address
 * @body {string} [email] – optional (uses authenticated user's email if omitted)
 * @access Private (logged-in user)
 */
exports.requestEmailVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      "email userName isEmailVerified",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Your email is already verified",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 100000–999999

    // Hash OTP before storing (security best practice)
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Save hashed OTP + expiry
    user.emailVerificationToken = hashedOtp;
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Send OTP email using the helper function
    const emailSent = await sendEmailVerificationOtp(
      user.email,
      user.userName,
      otp,
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "A 6-digit verification code has been sent to your email",
    });
  } catch (error) {
    console.error("Request email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

/**
 * Verify email using the 6-digit OTP
 * @body {string} otp – the 6-digit code received via email
 * @access Private (logged-in user)
 */
exports.verifyEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "A valid 6-digit OTP is required",
      });
    }

    const user = await User.findById(userId).select(
      "email isEmailVerified emailVerificationToken emailVerificationExpires",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Your email is already verified",
      });
    }

    if (!user.emailVerificationToken || !user.emailVerificationExpires) {
      return res.status(400).json({
        success: false,
        message:
          "No active verification request found. Please request a new code.",
      });
    }

    if (user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "This OTP has expired. Please request a new one.",
      });
    }

    // Compare hashed input OTP with stored hash
    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedInput !== user.emailVerificationToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // Success: mark as verified and clear token data
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
