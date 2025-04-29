import express from 'express';
import shopify from '../../config/shopify.js';
import { Session } from '../models/session.js';

const router = express.Router();

// Handle initial authentication request
router.get('/auth', async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).send('Missing shop parameter');
    }

    // Generate auth URL for Shopify OAuth
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: false,
    });

    res.redirect(authRoute);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication error');
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
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
        expires: session.expires
      },
      { upsert: true, new: true }
    );

    // For now, just set a simple cookie
    res.cookie('shopify_shop', session.shop, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect to app home
    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication callback error');
  }
});

// Simple auth status endpoint (we'll enhance this later with JWT)
router.get('/auth/status', async (req, res) => {
  try {
    const shop = req.cookies?.shopify_shop;
    
    if (!shop) {
      return res.json({ authenticated: false });
    }
    
    // Check if session exists in database
    const session = await Session.findOne({
      shop,
      accessToken: { $exists: true },
      expires: { $gt: new Date() }
    });
    
    if (!session) {
      return res.json({ authenticated: false });
    }
    
    return res.json({
      authenticated: true,
      shop: shop
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Authentication status check failed' });
  }
});

// Logout endpoint
router.get('/auth/logout', (req, res) => {
  res.clearCookie('shopify_shop');
  res.redirect('/');
});

export default router;
