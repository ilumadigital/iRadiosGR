'use strict';

// Public, read-oriented radio demo on staging with real imported production data.
// Private APIs are *deny-by-default* until each has a security review.
// No environment keys in Git; JWT verification uses the separate server-only secret.

const { protect } = require('./authMiddleware');
const { authorizeRoles } = require('./roleMiddleware');
const User = require('../models/User');

const publicReads = new Set([
  '/api/health',
  '/api/stations',
  '/api/stations/discovery',
  '/api/stats/network',
  '/api/ads/public',
  '/api/banners/active',
  '/api/cover-art',
  '/api/proxy-stream'
]);

function stagePublicAccess(req, res, next) {
  // The middleware is mounted at /api, and Express req.path excludes the mount prefix.
  const path = (req.baseUrl + req.path).replace(/\/+$/,'') || '/';
  if (req.method === 'GET' && publicReads.has(path)) return next();

  // Never allow real user registration, password resets, payment submission,
  // invitations or push subscriptions on an internet-facing clone of live data.
  if (req.method === 'POST' && path === '/api/auth/login') {
    const identifier = req.body && req.body.identifier;
    if (typeof identifier !== 'string' || identifier.length > 254 || identifier.length === 0)
      return res.status(400).json({error:'Invalid login identifier'});
    return User.exists({
      role:'admin', $or:[{username:identifier},{email:identifier}]
    }).then(isAdmin => {
      if (!isAdmin) return res.status(403).json({error:'Only staging admin accounts may sign in'});
      next();
    }).catch(() => res.status(503).json({error:'Authentication temporarily unavailable'}));
  }

  // Additional API access is restricted to signed-in administrators only.
  // Real user passwords and database details are not returned to anonymous clients.
  protect(req,res,() => authorizeRoles('admin')(req,res,next));
}

module.exports = { stagePublicAccess, publicReads };
