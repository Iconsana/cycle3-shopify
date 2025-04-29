import express from 'express';
import shopify from '../../config/shopify.js';

const router = express.Router();

// Simple memory storage for sessions
const sessions = {};

// Serve login page
router.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: './public' });
});

// Handle initial authentication request
router.get('/auth', (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).send('Missing shop parameter');
    }
    
    console.log(`Auth request for shop: ${shop}`);
    
    // Create the authorization URL manually instead of using shopify.auth.begin
    const nonce = Math.random().toString(36).substring(2, 15);
    const redirectUri = `${process.env.APP_URL}/auth/callback`;
    const scopes = 'read_products,write_products,read_orders,write_orders,read_inventory,write_inventory';
    
    // Store nonce in session for verification
    sessions[nonce] = { shop };
    
    // Create authorization URL manually
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
    
    console.log(`Redirecting to: ${authUrl}`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send(`Authentication error: ${error.message}`);
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    
    console.log(`Auth callback received - Shop: ${shop}, State: ${state}`);
    
    // Verify the state matches what we stored (CSRF protection)
    if (!sessions[state] || sessions[state].shop !== shop) {
      return res.status(403).send('Invalid state parameter');
    }
    
    // Exchange the authorization code for an access token
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    
    const { access_token } = await response.json();
    
    if (!access_token) {
      throw new Error('No access token received from Shopify');
    }
    
    console.log(`Got access token for shop: ${shop}`);
    
    // Store the session
    sessions[shop] = {
      shop,
      accessToken: access_token,
      createdAt: new Date().toISOString()
    };
    
    // Set a cookie to maintain the session client-side
    res.cookie('shopify_shop', shop, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Redirect back to the app
    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send(`Authentication error: ${error.message}`);
  }
});

// Status check endpoint
router.get('/auth/status', (req, res) => {
  const shop = req.cookies?.shopify_shop;
  
  if (!shop || !sessions[shop]) {
    return res.json({ authenticated: false });
  }
  
  return res.json({
    authenticated: true,
    shop
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
