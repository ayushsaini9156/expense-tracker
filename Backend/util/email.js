const nodemailer = require("nodemailer");

const host = process.env.EMAIL_HOST;
const port = process.env.EMAIL_PORT
  ? Number(process.env.EMAIL_PORT)
  : undefined;
const user = (
  process.env.EMAIL_USER ||
  process.env.EMAIL_USERNAME ||
  ""
).trim();
const pass = (
  process.env.EMAIL_PASS ||
  process.env.EMAIL_PASSWORD ||
  ""
).trim();

const transporterOptions = {};

if (host && port) {
  transporterOptions.host = host;
  transporterOptions.port = port;
  transporterOptions.secure = port === 465; // true for 465, false for other ports
  transporterOptions.auth = { user, pass };
} else if (user && pass) {
  // fallback to well-known service (e.g., Gmail) when host/port not provided
  transporterOptions.service = process.env.EMAIL_SERVICE || "gmail";
  transporterOptions.auth = { user, pass };
} else {
  console.warn(
    "Email configuration is incomplete: no host/port or user/pass found in env vars."
  );
}

let transporter = null;
if (Object.keys(transporterOptions).length > 0) {
  transporter = nodemailer.createTransport(transporterOptions);

  // Verify transporter configuration at startup (will log useful errors)
  transporter.verify(async (err, success) => {
    if (err) {
      console.error(
        "Email transporter verification failed:",
        err.message || err
      );

      // If requested, fall back to Ethereal for testing
      if (process.env.USE_ETHEREAL === "true") {
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
          console.log(
            "Falling back to Ethereal test account for email sending."
          );
          console.log(`Ethereal user: ${testAccount.user}`);
        } catch (ethErr) {
          console.error("Failed to create Ethereal test account:", ethErr);
        }
      }
    } else {
      console.log("Email transporter is ready");
    }
  });
} else {
  console.warn(
    "Email configuration is incomplete: transporter not created. Set EMAIL_HOST/EMAIL_PORT or EMAIL_USERNAME/EMAIL_PASSWORD."
  );
}

const sendEmail = async (to, subject, text) => {
  if (!transporter) {
    const msg =
      "Email transporter is not configured. Please set SMTP env vars (EMAIL_HOST & EMAIL_PORT) or EMAIL_USERNAME & EMAIL_PASSWORD.";
    console.error(msg);
    throw new Error(msg);
  }

  const fromAddress = user ? `"Expense Tracker" <${user}>` : undefined;
  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    const previewUrl = nodemailer.getTestMessageUrl
      ? nodemailer.getTestMessageUrl(info)
      : null;
    if (previewUrl) {
      console.log(`Preview URL (Ethereal): ${previewUrl}`);
    }
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
};

module.exports = sendEmail;
