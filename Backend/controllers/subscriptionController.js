const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../models/User");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a Razorpay subscription for a plan
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const user = req.user; // protect middleware should set this
    if (!user) return res.status(401).json({ message: "Not authorized" });

    const planId = process.env.RAZORPAY_PLAN_ID; // configured in env
    if (!planId)
      return res.status(500).json({ message: "Pricing not configured" });

    // Ensure customer exists in Razorpay
    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpayInstance.customers.create({
        name: user.fullName,
        email: user.email,
      });
      customerId = customer.id;
      user.razorpayCustomerId = customerId;
      await user.save();
    }

    // Create subscription
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      // optionally override total_count or addons
      // total_count: 12,
      customer_id: customerId,
    });

    // Save subscription id on user
    user.razorpaySubscriptionId = subscription.id;
    user.isPremium = true; // mark premium until webhook modifies
    await user.save();

    // Return subscription info; frontend can use this to open Razorpay checkout
    res.json({
      subscriptionId: subscription.id,
      subscription,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
};

// Webhook endpoint to handle Razorpay events
exports.handleWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const bodyBuffer = req.body; // express.raw was used for this route

    if (webhookSecret) {
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(bodyBuffer)
        .digest("hex");
      if (expected !== signature) {
        console.error("Invalid webhook signature");
        return res.status(400).send("Invalid signature");
      }
    }

    const event = JSON.parse(bodyBuffer.toString());

    switch (event.event) {
      case "subscription.charged": {
        const payload = event.payload.subscription.entity;
        const subscriptionId = payload.id;
        const customerId = payload.customer_id;
        const user = await User.findOne({ razorpayCustomerId: customerId });
        if (user) {
          user.isPremium = true;
          // Optionally update premiumExpiresAt based on next_charge_at
          if (payload.current_end)
            user.premiumExpiresAt = new Date(payload.current_end * 1000);
          await user.save();
        }
        break;
      }
      case "subscription.cancelled": {
        const payload = event.payload.subscription.entity;
        const subscriptionId = payload.id;
        const customerId = payload.customer_id;
        const user = await User.findOne({ razorpayCustomerId: customerId });
        if (user) {
          user.isPremium = false;
          user.razorpaySubscriptionId = null;
          user.premiumExpiresAt = null;
          await user.save();
        }
        break;
      }
      case "payment.failed": {
        // handle payment failure if needed
        break;
      }
      default:
        // ignore other events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

// Verify payment signature after checkout (called by frontend)
exports.verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = req.body;
    if (
      !razorpay_payment_id ||
      !razorpay_subscription_id ||
      !razorpay_signature
    ) {
      return res
        .status(400)
        .json({ message: "Missing verification parameters" });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_payment_id + "|" + razorpay_subscription_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    // Mark user as premium (req.user should be populated by protect middleware)
    const user = req.user;
    if (user) {
      user.isPremium = true;
      user.razorpaySubscriptionId = razorpay_subscription_id;
      await user.save();
    }

    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
};
