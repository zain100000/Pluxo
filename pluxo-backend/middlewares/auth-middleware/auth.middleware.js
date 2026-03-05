
/**
 * @fileoverview Encrypted JWT authentication middleware
 * @module middlewares/encryptedAuthMiddleware
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const SuperAdmin = require("../../models/super-admin-model/super-admin.model");
const User = require("../../models/user-model/user.model");

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment");
}
if (!process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error("Missing TOKEN_ENCRYPTION_KEY in environment");
}

/**
 * 32-byte AES-256 encryption key (from hex env var)
 * @type {Buffer}
 */
const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");

/**
 * Rate limiter for login/auth endpoints
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Encrypt JWT using AES-256-GCM
 * @param {string} plaintext - JWT string to encrypt
 * @returns {{ iv: string, ciphertext: string, authTag: string }}
 */
const encryptToken = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
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
 * Decrypt AES-256-GCM encrypted JWT payload
 * @param {{ iv: string, ciphertext: string, authTag: string }} payload
 * @returns {string} Decrypted JWT
 */
const decryptToken = (payload) => {
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

/**
 * Authenticate requests using encrypted + signed JWT
 * Supports Authorization header (Bearer) or cookie (accessToken)
 * @async
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
exports.encryptedAuthMiddleware = async (req, res, next) => {
  try {
    let encryptedPayload = null;
    const authHeader = req.header("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      encryptedPayload = JSON.parse(
        Buffer.from(authHeader.split(" ")[1], "base64url").toString(),
      );
    } else if (req.cookies?.accessToken) {
      encryptedPayload = JSON.parse(
        Buffer.from(req.cookies.accessToken, "base64url").toString(),
      );
    }

    if (!encryptedPayload) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing or invalid token",
      });
    }

    const decryptedJwt = decryptToken(encryptedPayload);

    const decoded = jwt.verify(decryptedJwt, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      clockTolerance: 30,
    });

    if (!decoded?.user?.id || !decoded?.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const now = Date.now() / 1000;
    if (decoded.iat < now - 24 * 60 * 60) {
      return res.status(401).json({
        success: false,
        message: "Token exceeded maximum lifetime (24h)",
      });
    }

    let Model;
    switch (decoded.role) {
      case "SUPERADMIN":
        Model = SuperAdmin;
        break;      
      case "USER":
        Model = User;
        break;      
      default:
        return res.status(401).json({
          success: false,
          message: "Invalid role in token",
        });
    }

    const user = await Model.findById(decoded.user.id).select("-password -__v");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (decoded.sessionId !== user.sessionId) {
      return res.status(401).json({
        success: false,
        message: "Session mismatch – possible token replay detected",
      });
    }

    req.user = {
      id: user._id.toString(),
      role: decoded.role,
      email: user.email,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    console.error("Encrypted Auth Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Generate encrypted JWT token
 * @param {Object} payload - Data to encode (should include user.id, role, sessionId)
 * @returns {string} Base64url-encoded encrypted token string
 */
exports.generateEncryptedToken = (payload) => {
  const rawJwt = jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
  });

  const encrypted = encryptToken(rawJwt);
  return Buffer.from(JSON.stringify(encrypted)).toString("base64url");
};
