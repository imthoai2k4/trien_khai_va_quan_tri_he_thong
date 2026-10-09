'use strict';

const jwt = require('jsonwebtoken');

const authMiddleware = {
  // Xác thực token và check role
  verifyTokenAndRole: (roles = []) => {
    return (req, res, next) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

      try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { id, role, ... }

        if (roles.length > 0 && !roles.includes(decoded.role)) {
          return res.status(403).json({ error: 'Access denied: Insufficient privileges' });
        }

        next();
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    };
  }
};

module.exports = authMiddleware;
