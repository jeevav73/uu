const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error("Mail transporter error ❌", err);
  } else {
    console.log("✅ Mail transporter ready");
  }
});

const sendResetEmail = async (to, resetLink) => {
  const mailOptions = {
    from: `"Legal Rights App" <${process.env.MAIL_USER}>`,
    to,
    subject: "Password Reset",
    html: `<p>Click here to reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail };
