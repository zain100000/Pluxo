
/**
 * @fileoverview Security middleware configuration for Express app
 * @module middlewares/securityMiddleware
 */

const helmet = require("helmet");
const cors = require("cors");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const compression = require("compression");

/**
 * Apply security hardening middleware stack
 * @param {import('express').Express} app - Express application instance
 */
exports.securityMiddleware = (app) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      if (
        req.headers["x-forwarded-proto"] !== "https" &&
        req.protocol !== "https"
      ) {
        return res.status(403).json({
          success: false,
          message: "HTTPS required in production",
        });
      }
      next();
    });
  }

  // Secure headers + CSP via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "https:", "ws:", "wss:"],
          scriptSrc: ["'self'", "https:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  // CORS configuration
  const allowedOrigins =
    process.env.ALLOWED_ORIGINS === "*"
      ? true
      : process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  // Make req.query writable (required for some hpp edge cases)
  app.use((req, res, next) => {
    req.query = { ...req.query };
    next();
  });

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Global rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests from this IP. Please try again later.",
      },
    }),
  );

  // Slow down requests after threshold (anti-brute-force / scraping)
  app.use(
    slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: 50,
      delayMs: () => 500,
    }),
  );

  // Compress responses
  app.use(compression());
};
