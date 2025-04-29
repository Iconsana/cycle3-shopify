// src/routes/auth.js
import express from 'express';
import shopify from '../../config/shopify.js';
import { Session } from '../models/session.js';
import { generateAppToken, verifyAppToken } from '../auth/shopifyAuth.js';

const router = express.Router();

// Handle initial authentication request
router.get('/auth', async (req, res) => {
  try {
    const shop = req.query.shop;
    
    // Generate auth URL for Shopify OAuth
    const authUrl = await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: true // Use online tokens for user-specific actions
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication error');
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    // Complete OAuth flow
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });
    
    // Save session to database
    await Session.findOneAndUpdate(
      { id: session.id },
      {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        accessToken: session.accessToken,
        expires: session.expires,
        onlineAccessInfo: session.onlineAccessInfo
      },
      { upsert: true, new: true }
    );
    
    // Generate app-specific token
    const appToken = generateAppToken(session);
    
    // Set token as cookie
    res.cookie('appToken', appToken, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Redirect to app home
    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication error');
  }
});

// Verify current auth status
router.get('/auth/status', async (req, res) => {
  try {
    const appToken = req.cookies.appToken;
    
    if (!appToken) {
      return res.json({ authenticated: false });
    }
    
    const decoded = verifyAppToken(appToken);
    if (!decoded) {
      return res.json({ authenticated: false });
    }
    
    // Get the shop from the token
    const shop = decoded.shop;
    
    // Find valid session in database
    const session = await Session.findOne({
      shop,
      accessToken: { $exists: true },
      expires: { $gt: new Date() }
    });
    
    if (!session) {
      return res.json({ authenticated: false });
    }
    
    res.json({
      authenticated: true,
      shop: decoded.shop,
      userId: decoded.userId
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.json({ authenticated: false, error: error.message });
  }
});

// Logout endpoint
router.get('/auth/logout', (req, res) => {
  res.clearCookie('appToken');
  res.redirect('/auth?shop=' + req.query.shop);
});

export default router;
