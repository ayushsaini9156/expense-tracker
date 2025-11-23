import React, { useState } from "react";
import axios from "../../utils/axiosInstance";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-sdk")) return resolve(true);
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Pricing = () => {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const resp = await axios.post(
        "/api/v1/subscription/create-checkout-session"
      );
      const { subscriptionId, keyId } = resp.data;

      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Failed to load Razorpay SDK");

      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: "Expense Tracker Premium",
        description: "Premium subscription",
        handler: async function (response) {
          // response contains: razorpay_payment_id, razorpay_subscription_id, razorpay_signature
          try {
            await axios.post("/api/v1/subscription/verify", response);
            // on success, refresh user or show success
            window.alert("Subscription successful!");
            window.location.reload();
          } catch (err) {
            console.error("Verification failed", err);
            window.alert("Verification failed. Contact support.");
          }
        },
        prefill: {
          email: localStorage.getItem("email") || "",
        },
        theme: { color: "#1976d2" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      window.alert("Unable to start checkout. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Upgrade to Premium</h2>
      <div className="bg-white shadow p-6 rounded">
        <h3 className="text-xl font-medium">Monthly Plan</h3>
        <p className="mt-2">Get AI features, priority support, and more.</p>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={startCheckout}
          disabled={loading}
        >
          {loading ? "Starting..." : "Subscribe"}
        </button>
      </div>
    </div>
  );
};

export default Pricing;
