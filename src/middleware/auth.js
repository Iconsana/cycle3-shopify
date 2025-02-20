import shopify from '../../config/shopify.js';
import { Session } from '../models/session.js';

export const verifyRequest = async (req, res, next) => {
  try {
    // Get shop from query or session
    const shop = req.query.shop || req.session?.shop;
    
    if (!shop) {
      return res.status(401).send('Unauthorized - No shop found');
    }

    // Find session in database
    const session = await Session.findOne({
      shop,
      accessToken: { $exists: true },
      expires: { $gt: new Date() }
    });

    if (!session) {
      // Redirect to auth if no valid session
      return res.redirect(`/auth?shop=${shop}`);
    }

    // Add session to request
    req.shopifySession = {
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).send('Authentication error');
  }
};

export const validateHmac = async (req, res, next) => {
  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const shop = req.get('X-Shopify-Shop-Domain');

    if (!hmac || !shop) {
      return next();
    }

    const verified = await shopify.auth.validateHmac(req);
    if (!verified) {
      return res.status(401).send('Invalid HMAC');
    }

    req.shop = shop;
    next();
  } catch (error) {
    console.error('HMAC validation error:', error);
    res.status(401).send('HMAC validation failed');
  }
};
