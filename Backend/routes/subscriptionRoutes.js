const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

// Create checkout session (frontend should redirect to returned url)
router.post(
  "/create-checkout-session",
  protect,
  subscriptionController.createCheckoutSession
);

// Verify payment signature (frontend calls this after successful checkout)
router.post(
  "/verify",
  protect,
  express.json(),
  subscriptionController.verifyPayment
);

// Webhook endpoint (needs raw body / stripe signature)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  subscriptionController.handleWebhook
);

module.exports = router;
