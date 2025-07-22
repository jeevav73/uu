const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../awsdb');

const router = express.Router();

// Helper: Generate reset token
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

// Helper: Send reset email (with fallback for development)
const sendResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;
  
  // Check if email is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('\n=== PASSWORD RESET LINK ===');
    console.log(`Email: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('=========================\n');
    console.log('⚠️  Email not configured. Using console output for development.');
    console.log('📧 To enable email sending, configure EMAIL_USER and EMAIL_PASS in .env file');
    return true; // Return success for development
  }

  try {
    // Only require nodemailer if email is configured
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request - QuestionPaper AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>You requested a password reset for your QuestionPaper AI account. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${resetLink}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px;">
            Best regards,<br>
            QuestionPaper AI Team
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    console.log('📧 Falling back to console output for development');
    throw error;
  }
};

// 🔹 SIGNUP
router.post('/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      name,
      email,
      phone,
      password_hash: passwordHash,
      is_active: true,
      role: 'user',
    };

    db.query('INSERT INTO users SET ?', user, (err) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// 🔹 LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length === 0) return res.status(400).json({ message: 'Invalid email or password' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, role: user.role } });
  });
});

// 🔹 FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });

    // Always return success message for security (prevent email enumeration)
    const successMessage = 'If an account with that email exists, a reset link has been sent.';
    
    if (results.length === 0) {
      return res.json({ message: successMessage });
    }

    const user = results[0];
    const resetToken = generateResetToken();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, user.id],
      async (updateErr) => {
        if (updateErr) {
          console.error('Database update error:', updateErr);
          return res.status(500).json({ message: 'Server error' });
        }

        try {
          await sendResetEmail(email, resetToken);
          res.json({ message: successMessage });
        } catch (emailErr) {
          console.error('Email error:', emailErr.message);
          // Still return success but log the reset link for development
          const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;
          console.log('\n=== PASSWORD RESET LINK (Email Failed) ===');
          console.log(`Email: ${email}`);
          console.log(`Reset Link: ${resetLink}`);
          console.log('========================================\n');
          res.json({ message: successMessage });
        }
      }
    );
  });
});

// 🔹 RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) return res.status(400).json({ message: 'Token and password required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  db.query(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
    [token],
    async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (results.length === 0) return res.status(400).json({ message: 'Invalid or expired token' });

      const user = results[0];
      const passwordHash = await bcrypt.hash(newPassword, 10);

      db.query(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [passwordHash, user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Server error' });
          res.json({ message: 'Password reset successfully' });
        }
      );
    }
  );
});

module.exports = router;