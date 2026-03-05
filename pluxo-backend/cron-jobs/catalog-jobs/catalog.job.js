const cron = require("node-cron");
const Product = require("../../models/product-model/product.model");

/**
 * JOB 1: Discount Expiry
 * Runs every minute to check if a sale period has ended.
 */
const autoExpireDiscounts = cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // Find products where sale has ended but isOnSale is still true
    const expiredProducts = await Product.find({
      isOnSale: true,
      saleEndDate: { $lte: now },
    });

    if (expiredProducts.length > 0) {
      for (const product of expiredProducts) {
        product.discount = 0;
        product.isOnSale = false;
        product.saleEndDate = null;
        // The pre-save middleware we wrote earlier will auto-calculate offerPrice
        await product.save();
      }
      console.log(
        `[Cron]: Expired discounts for ${expiredProducts.length} products.`,
      );
    }
  } catch (error) {
    console.error("[Cron Error]: Discount Expiry Job failed", error);
  }
});

/**
 * JOB 2: Low Stock Reporting
 * Runs daily at 9:00 AM to notify admins of low stock items.
 */
const checkLowStock = cron.schedule("0 9 * * *", async () => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ["$stock", "$restockThreshold"] },
      status: "ACTIVE",
    });

    if (lowStockItems.length > 0) {
      console.log(`[Alert]: ${lowStockItems.length} items are low on stock!`);
      // Here you would trigger an Email or Slack notification to the SuperAdmin
    }
  } catch (error) {
    console.error("[Cron Error]: Low Stock Job failed", error);
  }
});

module.exports = { autoExpireDiscounts, checkLowStock };
