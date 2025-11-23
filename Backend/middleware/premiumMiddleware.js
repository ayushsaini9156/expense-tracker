const User = require("../models/User");

// Requires `protect` middleware to have already populated `req.user`
module.exports = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authorized" });

    // consider user.isPremium true OR premiumExpiresAt in future
    const now = new Date();
    const premiumActive =
      user.isPremium ||
      (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now);
    if (!premiumActive) {
      return res
        .status(403)
        .json({ message: "Premium feature. Please upgrade to access." });
    }
    next();
  } catch (err) {
    next(err);
  }
};
