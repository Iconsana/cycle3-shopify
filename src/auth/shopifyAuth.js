// src/auth/shopifyAuth.js
import shopify from '../../config/shopify.js';
import { Session } from '../models/session.js';
import jwt from 'jsonwebtoken';

// JWT Secret - store this in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate app-specific JWT token after Shopify auth
export const generateAppToken = (shopifySession) => {
  return jwt.sign({
    shop: shopifySession.shop,
    userId: shopifySession.onlineAccessInfo?.associated_user?.id,
    scope: shopifySession.scope
  }, JWT_SECRET, { expiresIn: '24h' });
};

// Verify app token
export const verifyAppToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
