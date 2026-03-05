/**
 * @fileoverview Express routes for user cart
 * @module routes/cartRoutes
 */

const express = require("express");
const router = express.Router();

const cartController = require("../../controllers/cart-controller/cart.controller");
const {
  encryptedAuthMiddleware,
} = require("../../middlewares/auth-middleware/auth.middleware");

// Apply authentication to all favorite routes at once
router.use(encryptedAuthMiddleware);

/**
 * @description Add a product in user's cart
 * @route POST /api/cart/add-to-cart
 * @access Protected
 */
router.post("/add-to-cart", cartController.addToCart);

/**
 * @description Update quantity of a product in user's cart
 * @route POST /api/cart/update-quantity
 * @access Protected
 */
router.post("/update-quantity", cartController.updateQuantity);

/**
 * @description Remove product in user's cart
 * @route POST /api/cart/remove-item
 * @access Protected
 */
router.post("/remove-item", cartController.removeItem);

/**
 * @description Clear user's cart
 * @route POST /api/cart/clear-cart
 * @access Protected
 */
router.post("/clear-cart", cartController.clearCart);

/**
 * @description Get user's cart
 * @route POST /api/cart/get-cart
 * @access Protected
 */
router.get("/get-cart", cartController.getCart);

module.exports = router;
