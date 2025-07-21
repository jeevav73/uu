const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../awsdb');

const router = express.Router();

// Helper function to generate reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper function to send email (you'll need to implement this with your email service)
const sendResetEmail = async (email, token) => {
  // For now, we'll just log the reset link
  // In production, you should use a service like SendGrid, Nodemailer, etc.
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;
  console.log(`Password reset link for ${email}: ${resetLink}`);
  
  // TODO: Implement actual email sending
  // Example with nodemailer:
  // await transporter.sendMail({
  //   from: process.env.FROM_EMAIL,
  //   to: email,
  //   subject: 'Password Reset Request',
  //   html: `Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.`
  // });
  
  return true;
};

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password_hash: passwordHash,
      is_active: true,
      role: 'user'
    };

    db.query('INSERT INTO users SET ?', newUser, (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      return res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length === 0) return res.status(400).json({ message: 'Invalid email or password' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    return res.json({ message: 'Login successful' });
  });
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (results.length === 0) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      const user = results[0];
      
      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Save reset token to database
      db.query(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [resetToken, resetTokenExpires, user.id],
        async (updateErr) => {
          if (updateErr) {
            console.error('Database update error:', updateErr);
            return res.status(500).json({ message: 'Server error' });
          }

          try {
            // Send reset email
            await sendResetEmail(email, resetToken);
            res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
          } catch (emailErr) {
            console.error('Email sending error:', emailErr);
            res.status(500).json({ message: 'Error sending reset email' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    // Find user with valid reset token
    db.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token],
      async (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (results.length === 0) {
          return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const user = results[0];
        
        try {
          // Hash new password
          const passwordHash = await bcrypt.hash(newPassword, 10);

          // Update password and clear reset token
          db.query(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [passwordHash, user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('Database update error:', updateErr);
                return res.status(500).json({ message: 'Server error' });
              }

              res.json({ message: 'Password reset successfully' });
            }
          );
        } catch (hashErr) {
          console.error('Password hashing error:', hashErr);
          res.status(500).json({ message: 'Server error' });
        }
      }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
