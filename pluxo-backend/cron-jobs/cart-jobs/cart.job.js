const cron = require("node-cron");
const Cart = require("../../models/cart-model/cart.model");

/**
 * JOB: Abandoned Cart Reminder
 * Runs every hour to find carts that haven't been updated in 2 hours.
 */
const recoverAbandonedCarts = cron.schedule("0 * * * *", async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find active carts older than 2 hours that haven't received a reminder
    const abandonedCarts = await Cart.find({
      status: "active",
      lastUpdated: { $lte: twoHoursAgo },
      reminderSent: false,
    }).populate("user");

    if (abandonedCarts.length > 0) {
      for (const cart of abandonedCarts) {
        // Logic to send Email/Push Notification goes here
        console.log(`[Cron]: Sending recovery email to ${cart.user.email}`);

        // Mark as sent so we don't spam the user
        cart.reminderSent = true;
        cart.status = "abandoned";
        await cart.save();
      }
      console.log(`[Cron]: Sent ${abandonedCarts.length} recovery reminders.`);
    }
  } catch (error) {
    console.error("[Cron Error]: Cart Recovery Job failed", error);
  }
});

module.exports = { recoverAbandonedCarts };
