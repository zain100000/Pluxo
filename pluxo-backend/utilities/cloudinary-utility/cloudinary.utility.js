
/**
 * @fileoverview Cloudinary image upload and deletion utilities
 * @module utilities/cloudinaryUtility
 */

const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");

// Validate Cloudinary credentials
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Missing required Cloudinary environment variables");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Allowed MIME types for image uploads
 * @type {string[]}
 */
const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
];

/**
 * Multer file filter – only allow supported image types
 * @param {import('express').Request} req
 * @param {import('multer').Express.Multer.File} file
 * @param {import('multer').FileFilterCallback} cb
 */
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(new Error("No file provided"), false);
  }

  if (allowedImageTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(new Error("Invalid file type. Allowed: JPG, PNG, WEBP"), false);
};

/**
 * Multer configuration: memory storage + file filter + size limit
 * Supports multiple fields: profilePicture (1), productImage (up to 5)
 * @type {import('multer').Multer}
 */
exports.upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "productImage", maxCount: 5 },
]);

/**
 * Determine Cloudinary folder based on upload context
 * @param {string} type - "profilePicture" | "productImage"
 * @returns {string} Folder path under PLUXO/
 */
const getFolderForUploadType = (type) => {
  const base = "PLUXO";

  switch (type) {
    case "profilePicture":
      return `${base}/profilePictures`;    
    case "productImage":
      return `${base}/productImages`;    
    default:
      throw new Error(`Unsupported upload type: ${type}`);
  }
};

/**
 * Upload single image buffer to Cloudinary
 * @async
 * @param {import('multer').Express.Multer.File} file - Multer file object
 * @param {string} type - Upload context ("profilePicture" | "productImage")
 * @param {string} [existingPublicId] - Optional: overwrite existing image
 * @returns {Promise<{ url: string, publicId: string }>} Secure URL and public_id
 * @throws {Error} If upload fails or no file provided
 */
exports.uploadToCloudinary = async (file, type, existingPublicId = null) => {
  if (!file) {
    throw new Error("No file provided for upload");
  }

  const folder = getFolderForUploadType(type);

  let publicId = existingPublicId;

  if (!publicId) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).replace(".", "") || "jpg";
    publicId = `${folder}/${timestamp}-${random}.${ext}`;
  }

  const fileBuffer = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  try {
    const result = await cloudinary.uploader.upload(fileBuffer, {
      public_id: publicId,
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (err) {
    console.error("Cloudinary Upload Error:", err);
    throw new Error("Failed to upload image to Cloudinary");
  }
};

/**
 * Delete an image from Cloudinary using its secure_url
 * @async
 * @param {string} [fileUrl] - Cloudinary secure_url (or empty/no-op)
 */
exports.deleteFromCloudinary = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const uploadIndex = pathParts.indexOf("upload");
    if (uploadIndex === -1) return;

    let afterUpload = pathParts.slice(uploadIndex + 1);

    // Skip version folder if present (v123456...)
    let startIndex = 0;
    if (afterUpload[0]?.startsWith("v") && !afterUpload[0].includes(".")) {
      startIndex = 1;
    }

    let publicId = afterUpload.slice(startIndex).join("/");

    // Remove file extension
    if (publicId.includes(".")) {
      publicId = publicId.substring(0, publicId.lastIndexOf("."));
    }

    console.log("Deleting Cloudinary public_id:", publicId);

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });

    console.log("Deleted:", publicId);
  } catch (err) {
    console.error("Cloudinary Deletion Error:", err.message);
  }
};
