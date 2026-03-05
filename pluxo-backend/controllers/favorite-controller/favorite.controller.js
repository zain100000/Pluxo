/**
 * @fileoverview Favorites / wishlist controller
 * @module controllers/favoriteController
 */

const Favorite = require("../../models/favorite-model/favorite.model");
const Product = require("../../models/product-model/product.model");
const User = require("../../models/user-model/user.model");

/**
 * Toggle Favorite (Add or Remove)
 * @description More efficient than two separate endpoints.
 * If the product is there, remove it. If not, add it.
 * @body { string } productId
 * @body { object } [attributes] - e.g., { "Color": "Red" }
 */

exports.toggleFavorite = async (req, res) => {
  try {
    const { productId, attributes } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    // 1. Ensure Favorite collection document exists for user
    let favoriteDoc = await Favorite.findOne({ user: userId });
    if (!favoriteDoc) {
      favoriteDoc = await Favorite.create({ user: userId, products: [] });
    }

    // 2. Check if product already exists in the collection
    const existingIndex = favoriteDoc.products.findIndex(
      (p) => p.productId.toString() === productId,
    );

    if (existingIndex > -1) {
      // --- REMOVE LOGIC ---

      // Remove from Favorite Collection
      favoriteDoc.products.splice(existingIndex, 1);
      await favoriteDoc.save();

      // Sync: Remove from User Schema
      await User.findByIdAndUpdate(userId, {
        $pull: { favorites: { productId: productId } },
      });

      return res.status(200).json({
        success: true,
        message: "Removed from favorites",
        isFavorited: false,
      });
    } else {
      // --- ADD LOGIC ---

      // Validate product exists
      const productExists = await Product.findById(productId);
      if (!productExists) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const newFavoriteEntry = {
        productId,
        attributes: attributes || {},
        addedAt: new Date(),
      };

      // Add to Favorite Collection
      favoriteDoc.products.push(newFavoriteEntry);
      await favoriteDoc.save();

      // Sync: Add to User Schema (only storing essential info as per your User schema)
      await User.findByIdAndUpdate(userId, {
        $push: {
          favorites: {
            productId: productId,
            addedAt: newFavoriteEntry.addedAt,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: "Added to favorites",
        isFavorited: true,
      });
    }
  } catch (error) {
    console.error("Toggle favorite sync error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * Get all user's favorited products
 * @access Private
 */
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const favoriteDoc = await Favorite.findOne({ user: userId }).populate({
      path: "products.productId",
    });

    if (!favoriteDoc || favoriteDoc.products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is empty",
        count: 0,
        favorites: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Favorites retrieved successfully",
      count: favoriteDoc.products.length,
      favorites: favoriteDoc.products,
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch favorites" });
  }
};

/**
 * Clear all favorites
 * @access Private
 */
exports.clearFavorites = async (req, res) => {
  try {
    await Favorite.findOneAndUpdate(
      { user: req.user.id },
      { $set: { products: [] } },
    );
    res.status(200).json({ success: true, message: "Wishlist cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
