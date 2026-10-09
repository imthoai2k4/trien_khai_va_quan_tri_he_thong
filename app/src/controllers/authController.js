'use strict';

const db = require('../services/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authController = {
  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Check database
      const [rows] = await db.execute(
        'SELECT id, name, password_hash, role, is_active FROM users WHERE email = ?',
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = rows[0];

      if (user.is_active === 0) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name },
        secret,
        { expiresIn: '8h' }
      );

      // Trả về token và info (KHÔNG trả về password_hash)
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: email,
          role: user.role
        }
      });

    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
