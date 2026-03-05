/**
 * @fileoverview Cart / cart controller with User Schema Sync
 * @module controllers/cartController
 */

const Cart = require("../../models/cart-model/cart.model");
const User = require("../../models/user-model/user.model");
const Product = require("../../models/product-model/product.model");

/**
 * Helper: Find a specific item in the cart based on ID and Attributes
 */
const findItemIndex = (items, productId, attributes) => {
  return items.findIndex((item) => {
    const sameId = item.productId.toString() === productId;
    const sameAttrs =
      JSON.stringify(Object.fromEntries(item.attributes)) ===
      JSON.stringify(attributes || {});
    return sameId && sameAttrs;
  });
};

/**
 * Helper: Sync Cart Collection to User Document
 */
const syncToUser = async (userId, cartItems) => {
  const userCartData = cartItems.map((item) => ({
    productId: item.productId,
    attributes: item.attributes,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalItemPrice,
    addedAt: item.addedAt,
  }));

  await User.findByIdAndUpdate(userId, {
    $set: { cart: userCartData },
  });
};

/**
 * Add Item to Cart
 */
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity, attributes } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    let unitPrice = product.offerPrice || product.price;

    // Check variant specific price
    if (attributes && product.variants.length > 0) {
      const variant = product.variants.find(
        (v) =>
          JSON.stringify(Object.fromEntries(v.attributes)) ===
          JSON.stringify(attributes),
      );
      if (variant) unitPrice = variant.price || unitPrice;
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const itemIndex = findItemIndex(cart.items, productId, attributes || {});

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += Number(quantity);
      cart.items[itemIndex].totalItemPrice =
        cart.items[itemIndex].quantity * unitPrice;
    } else {
      cart.items.push({
        productId,
        attributes: attributes || {},
        quantity: Number(quantity),
        unitPrice,
        totalItemPrice: Number(quantity) * unitPrice,
      });
    }

    cart.lastUpdated = Date.now();
    cart.reminderSent = false;
    cart.status = "ACTIVE";

    await cart.save();
    await syncToUser(userId, cart.items); // SYNC

    res
      .status(200)
      .json({ success: true, message: "Item added to cart", cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Quantity (Increase/Decrease)
 */
exports.updateQuantity = async (req, res) => {
  try {
    const { productId, attributes, action } = req.body;
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const itemIndex = findItemIndex(cart.items, productId, attributes || {});
    if (itemIndex === -1)
      return res
        .status(404)
        .json({ success: false, message: "Item not in cart" });

    if (action === "inc") {
      cart.items[itemIndex].quantity += 1;
    } else if (action === "dec") {
      if (cart.items[itemIndex].quantity > 1) {
        cart.items[itemIndex].quantity -= 1;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    }

    if (cart.items[itemIndex]) {
      cart.items[itemIndex].totalItemPrice =
        cart.items[itemIndex].quantity * cart.items[itemIndex].unitPrice;
    }

    cart.lastUpdated = Date.now();
    await cart.save();
    await syncToUser(userId, cart.items); // SYNC

    res
      .status(200)
      .json({ success: true, message: `Quantity ${action}reased`, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove Single Item
 */
exports.removeItem = async (req, res) => {
  try {
    const { productId, attributes } = req.body;
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId });

    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const itemIndex = findItemIndex(cart.items, productId, attributes || {});
    if (itemIndex > -1) {
      cart.items.splice(itemIndex, 1);
      cart.lastUpdated = Date.now();

      // If items become empty, we can explicitly reset billDetails just to be safe
      if (cart.items.length === 0) {
        cart.billDetails.totalItemsPrice = 0;
        cart.billDetails.shippingCharges = 0;
        cart.billDetails.grandTotal = 0;
      }

      await cart.save();
      await syncToUser(userId, cart.items);
    }

    res.status(200).json({
      success: true,
      message:
        cart.items.length === 0
          ? "Cart is now empty"
          : "Item removed from cart",
      cart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get User Cart
 */
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "items.productId",
    );
    if (!cart)
      return res
        .status(200)
        .json({ success: true, cart: { items: [], billDetails: {} } });

    res
      .status(200)
      .json({ success: true, message: "Cart fetched successfully", cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Clear Entire Cart
 * @description Removes all items from the collection and the user's embedded cart array.
 * @access Private
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Find the cart document
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // 2. Reset the Cart Collection
    cart.items = [];
    cart.lastUpdated = Date.now();
    cart.status = "ACTIVE";

    // Explicitly reset bill details to override any default shipping logic
    cart.billDetails = {
      totalItemsPrice: 0,
      shippingCharges: 0,
      grandTotal: 0,
    };

    await cart.save();

    // 3. Sync: Clear the cart array in the User Document
    await User.findByIdAndUpdate(userId, {
      $set: { cart: [] },
    });

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart,
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};
