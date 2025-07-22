const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../awsdb');

const router = express.Router();

// Helper: Generate reset token
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

// Helper: Send reset email (Mock — replace with Nodemailer or AWS SES)
const sendResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${token}`;
  console.log(`Reset link for ${email}: ${resetLink}`);
  return true;
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

    if (results.length === 0) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = results[0];
    const resetToken = generateResetToken();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, user.id],
      async (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Server error' });

        try {
          await sendResetEmail(email, resetToken);
          res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
        } catch (emailErr) {
          res.status(500).json({ message: 'Failed to send reset email' });
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
