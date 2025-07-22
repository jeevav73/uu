const express = require("express");
const crypto = require("crypto");
const db = require("../awsdb"); // Replace with actual DB file path
const { sendResetEmail } = require("../utils/mailer"); // <-- Import this!
const router = express.Router();

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const [user] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);

    if (!user.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    // Save to DB
    await db.promise().query(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [resetToken, tokenExpires, user[0].id]
    );

    const resetLink = `http://localhost:8080/reset-password?token=${resetToken}`;
    console.log("=== PASSWORD RESET LINK ===");
    console.log("Email:", email);
    console.log("Reset Link:", resetLink);
    console.log("===========================");

    // 🔥 Send the email!
    await sendResetEmail(email, resetLink);

    res.status(200).json({ message: "Reset email sent successfully" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;
