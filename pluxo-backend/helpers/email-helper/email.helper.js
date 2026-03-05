/**
 * @fileoverview Email service utilities for Pluxo application
 * @module services/emailService
 * @description Nodemailer-based email sender with branded HTML templates
 * Supports password resets, support tickets, and order notifications
 */

const nodemailer = require("nodemailer");

// Validate required environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error(
    "Missing required environment variables: EMAIL_USER and EMAIL_PASS",
  );
}

/**
 * Configured Nodemailer transporter (Gmail SMTP)
 * @type {import('nodemailer').Transporter}
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

/**
 * Send plain email with HTML content
 * @async
 * @param {Object} options
 * @param {string} options.to      - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html    - HTML body content
 * @returns {Promise<boolean>} Success status
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: "Pluxo <no-reply@pluxo.com>",
      to: to.trim(),
      subject,
      html,
      text: html.replace(/<[^>]+>/g, " ").substring(0, 200) + "...",
    });

    console.log(`Email sent to ${to} | MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    return false;
  }
};

/**
 * Wrap content in branded Pluxo HTML email template
 * @param {string} content - Main email body HTML
 * @param {string} [title="Pluxo Notification"] - Document title
 * @returns {string} Complete HTML email
 */
const getEmailTemplate = (content, title = "Pluxo Notification") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family:"Inter",system-ui,sans-serif; line-height:1.6; color:#334155; }
    a { color:#2563eb; text-decoration:none; }
    .container { max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.04); }
    .header { background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%); padding:48px 32px; text-align:center; position:relative; }
    .header::before { content:''; position:absolute; top:0; left:0; right:0; height:6px; background:linear-gradient(90deg,#ffffff33,transparent); }
    .logo { width:140px; height:auto; margin-bottom:16px; }
    .brand-title { color:#ffffff; font-size:32px; font-weight:800; margin:0; letter-spacing:-1px; }
    .main-content { padding:56px 48px; background:#ffffff; color:#1e293b; }
    .btn-primary { display:inline-block; background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%); color:#ffffff !important; font-weight:700; font-size:17px; padding:18px 44px; border-radius:12px; text-decoration:none; box-shadow:0 8px 25px rgba(37,99,235,0.25); transition:all 0.3s ease; }
    .btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(37,99,235,0.35); }
    .info-box { background:#f1f5f9; border-left:5px solid #2563eb; padding:28px; border-radius:12px; margin:36px 0; font-size:16px; }
    .footer { background:#0f172a; padding:48px 40px; text-align:center; color:#94a3b8; }
    .footer-title { color:#38bdf8; font-size:20px; font-weight:700; margin:0 0 12px; }
    .footer-copy { font-size:14px; margin:16px 0; }
    .footer-note { font-size:13px; color:#64748b; line-height:1.6; margin-top:24px; }
    @media (max-width:600px) { .main-content { padding:40px 24px; } .header { padding:40px 20px; } }
  </style>
</head>
<body>
   <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f9;padding:40px 20px;">
    <tr><td align="center">
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dd524q9vc/image/upload/v1772646615/PLUXO/logo/logo_mwvytu.png" alt="PLUXO" class="logo" />
        </div>
        <div class="main-content">
          ${content}
        </div>
        <div class="footer">
          <p class="footer-title">PLUXO</p>
          <p class="footer-copy">© ${new Date().getFullYear()} <strong style="color:#E32264;">PLUXO</strong>. All rights reserved.</p>
          <p class="footer-note">
            This is an automated message from PLUXO.<br>
            If you didn't initiate this action, please ignore this email or contact support.
          </p>
        </div>
      </div>
    </td></tr>
  </table>
</body>
</html>
`;

/**
 * Get frontend base URL based on user role
 * @param {string} role - User role
 * @returns {string} Frontend base URL
 */
function getFrontendUrl(role) {
  switch (role) {
    case "SUPERADMIN":
      if (!process.env.FRONTEND_URL) {
        throw new Error("FRONTEND_URL is not defined");
      }
      return process.env.FRONTEND_URL.replace(/\/+$/, "");

    default:
      throw new Error(`No frontend URL configured for role: ${role}`);
  }
}

/**
 * Send password reset email
 * @async
 * @param {string} toEmail    - Recipient email
 * @param {string} resetToken - Reset token
 * @param {string} role       - User role
 * @returns {Promise<boolean>}
 */
const sendPasswordResetEmail = async (toEmail, resetToken, role) => {
  const frontendUrl = getFrontendUrl(role);
  const resetLink = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

  const content = `
    <div style="text-align:center;max-width:520px;margin:0 auto;">
      <h2 style="color:#0f172a;font-size:32px;margin-bottom:24px;font-weight:800;">
        Reset Your Password
      </h2>
      <p style="color:#475569;line-height:1.8;margin-bottom:40px;font-size:17px;">
        We received a request to reset the password for your Pluxo account.<br>
        Please click the button below to create a new password.
      </p>
      <div style="margin:50px 0;">
        <a href="${resetLink}" class="btn-primary">Reset Password</a>
      </div>
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin-top:40px;">
        This link will expire in <strong style="color:#2563eb;">1 hour</strong> for security reasons.<br><br>
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  return await sendEmail({
    to: toEmail,
    subject: "Pluxo • Reset Your Password",
    html: getEmailTemplate(content, "Password Reset - Pluxo"),
  });
};

/**
 * Send 6-digit OTP for email verification
 * @async
 * @param {string} toEmail      - User's email address
 * @param {string} userName     - User's display name
 * @param {string} otp          - 6-digit plain OTP code
 * @returns {Promise<boolean>}  Success status
 */
const sendEmailVerificationOtp = async (toEmail, userName, otp) => {
  const content = `
    <div style="text-align:center;max-width:520px;margin:0 auto;">
      <h2 style="color:#0f172a;font-size:32px;margin-bottom:24px;font-weight:800;">
        Verify Your Account
      </h2>
      <p style="color:#475569;line-height:1.8;margin-bottom:40px;font-size:17px;">
        Hello ${userName || "there"},<br><br>
        Welcome to Pluxo! Please use the following code to verify your email address:
      </p>
      
      <div style="margin:40px 0; padding:24px; background:#f8fafc; border-radius:12px; border:2px dashed #2563eb;">
        <h1 style="font-size:48px; letter-spacing:12px; color:#2563eb; margin:0; font-weight:900;">
          ${otp}
        </h1>
      </div>

      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:30px 0;">
        This code is valid for <strong style="color:#2563eb;">10 minutes</strong>.<br>
      </p>

      <p style="color:#1e293b;font-size:16px;margin-top:40px;">
        The Pluxo Team
      </p>
    </div>
  `;

  return await sendEmail({
    to: toEmail,
    subject: "Pluxo – Your Verification Code",
    html: getEmailTemplate(content, "Email Verification - Pluxo"),
  });
};

module.exports = {
  sendEmail,
  getEmailTemplate,
  sendPasswordResetEmail,
  sendEmailVerificationOtp,
};
