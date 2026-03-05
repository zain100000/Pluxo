/**
 * @fileoverview Main entry point for all Cron Jobs
 */
const {
  autoExpireDiscounts,
  checkLowStock,
} = require("./catalog-jobs/catalog.job");

const { recoverAbandonedCarts } = require("./cart-jobs/cart.job");

const initCronJobs = () => {
  console.log("Initializing Scheduled Background Tasks...");

  // Start Catalog Jobs
  autoExpireDiscounts.start();
  checkLowStock.start();

  // Start Cart Cleanup Job
  recoverAbandonedCarts.start();

  console.log("✅ Cron Jobs Running");
};

module.exports = initCronJobs;
