/**
 * @fileoverview Express routes for user favorites
 * @module routes/favoriteRoutes
 */

const express = require("express");
const router = express.Router();

const favoriteController = require("../../controllers/favorite-controller/favorite.controller");
const {
  encryptedAuthMiddleware,
} = require("../../middlewares/auth-middleware/auth.middleware");

// Apply authentication to all favorite routes at once
router.use(encryptedAuthMiddleware);

/**
 * @description Toggle a product in user's favorites (Adds if missing, Removes if exists)
 * @route POST /api/favorite/toggle
 * @access Protected
 */
router.post("/toggle-favorite", favoriteController.toggleFavorite);

/**
 * @description Get all favorited products for the authenticated user
 * @route GET /api/favorite/get-all
 * @access Protected
 */
router.get("/get-all-favorite", favoriteController.getFavorites);

/**
 * @description Clear the entire wishlist
 * @route DELETE /api/favorite/clear
 * @access Protected
 */
router.delete("/clear-favorite", favoriteController.clearFavorites);

module.exports = router;
