import express from 'express';
import shopify from '../../config/shopify.js';
import { Session } from '../models/session.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// JWT Secret - store this in environment variables eventually
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token
function generateToken(session) {
    return jwt.sign({
        shop: session.shop,
        scope: session.scope
    }, JWT_SECRET, { expiresIn: '24h' });
}

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

        // Generate JWT token
        const token = generateToken(session);

        // Set token as cookie
        res.cookie('appToken', token, {
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

// Check authentication status
router.get('/auth/status', async (req, res) => {
    try {
        const token = req.cookies.appToken;
        
        if (!token) {
            return res.json({ authenticated: false });
        }
        
        try {
            // Verify the token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Check if session exists in database
            const session = await Session.findOne({
                shop: decoded.shop,
                accessToken: { $exists: true },
                expires: { $gt: new Date() }
            });
            
            if (!session) {
                return res.json({ authenticated: false });
            }
            
            return res.json({
                authenticated: true,
                shop: decoded.shop
            });
        } catch (jwtError) {
            return res.json({ authenticated: false });
        }
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Authentication status check failed' });
    }
});

// Logout endpoint
router.get('/auth/logout', (req, res) => {
    res.clearCookie('appToken');
    res.redirect('/');
});

export default router;
