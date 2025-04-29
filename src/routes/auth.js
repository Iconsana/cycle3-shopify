import express from 'express';
import shopify from '../../config/shopify.js';

const router = express.Router();

// Simple in-memory session store (replace with database later)
const sessions = {};

// Handle the initial login page
router.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: './public' });
});

// Handle initial authentication request
router.get('/auth', async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).send('Missing shop parameter. Please provide a shop name.');
    }

    console.log(`Starting auth flow for shop: ${shop}`);

    // Generate auth URL for Shopify OAuth
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: false,
    });

    console.log(`Redirecting to Shopify auth: ${authRoute}`);
    res.redirect(authRoute);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send(`Authentication error: ${error.message}`);
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    console.log('Auth callback received from Shopify');
    
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    if (!session || !session.accessToken) {
      console.error('Invalid session received from Shopify');
      return res.status(401).send('Authentication failed - invalid session');
    }

    console.log(`Authentication successful for shop: ${session.shop}`);

    // Store session in memory (temporary solution)
    sessions[session.shop] = {
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
      expires: session.expires,
      createdAt: new Date()
    };

    // Set cookie for browser
    res.cookie('shopify_shop', session.shop, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect to app home
    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send(`Authentication callback error: ${error.message}`);
  }
});

// Check authentication status
router.get('/auth/status', (req, res) => {
  const shop = req.cookies?.shopify_shop;
  
  if (!shop || !sessions[shop]) {
    return res.json({ authenticated: false });
  }
  
  // Check if session is expired
  const session = sessions[shop];
  if (session.expires && new Date() > new Date(session.expires)) {
    delete sessions[shop];
    return res.json({ authenticated: false });
  }
  
  return res.json({
    authenticated: true,
    shop: shop
  });
});

// Logout endpoint
router.get('/auth/logout', (req, res) => {
  const shop = req.cookies?.shopify_shop;
  
  if (shop && sessions[shop]) {
    delete sessions[shop];
  }
  
  res.clearCookie('shopify_shop');
  res.redirect('/login.html');
});

export default router;
