// src/middleware/auth.js
import { verifyAppToken } from '../auth/shopifyAuth.js';
import { Session } from '../models/session.js';

// Middleware to verify authentication
export const verifyAuth = async (req, res, next) => {
  try {
    // Check for token in cookies or headers
    const token = req.cookies.appToken || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token
    const decoded = verifyAppToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if session exists in database
    const session = await Session.findOne({
      shop: decoded.shop,
      accessToken: { $exists: true },
      expires: { $gt: new Date() }
    });
    
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Add user info to request object
    req.user = {
      shop: decoded.shop,
      userId: decoded.userId,
      sessionId: session.id
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication error' });
  }
};
