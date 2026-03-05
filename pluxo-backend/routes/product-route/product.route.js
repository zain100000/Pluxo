/**
 * @fileoverview Express routes for product management
 * @module routes/productRoutes
 */

const express = require("express");
const router = express.Router();

const productController = require("../../controllers/product-controller/product.controller");
const {
  encryptedAuthMiddleware,
} = require("../../middlewares/auth-middleware/auth.middleware");
const cloudinaryUtility = require("../../utilities/cloudinary-utility/cloudinary.utility");

/**
 * @description Create a new product (with multiple image upload support)
 * @route   POST /api/product/add-product
 * @access  Private (SuperAdmin)
 */
router.post(
  "/add-product",
  encryptedAuthMiddleware,
  cloudinaryUtility.upload,
  productController.addProduct,
);

/**
 * @description Get all products
 * @route   GET /api/product/get-all-products
 * @access  Public
 */
router.get("/get-all-products", productController.getAllProducts);

/**
 * @description Get single product details by ID
 * @route   GET /api/product/get-product-by-id/:productId
 * @access  Public
 */
router.get("/get-product-by-id/:productId", productController.getProductById);

/**
 * @description Update product details and/or images
 * @route   PATCH /api/product/update-product/:productId
 * @access  Private (SuperAdmin)
 */
router.patch(
  "/update-product/:productId",
  encryptedAuthMiddleware,
  cloudinaryUtility.upload,
  productController.updateProduct,
);

/**
 * @description Delete a product (and associated images if implemented)
 * @route   DELETE /api/product/delete-product/:productId
 * @access  Private (SuperAdmin)
 */
router.delete(
  "/delete-product/:productId",
  encryptedAuthMiddleware,
  productController.deleteProduct,
);

module.exports = router;