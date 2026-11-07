'use strict';

// Public, read-oriented radio demo on staging with real imported production data.
// Private APIs are *deny-by-default* until each has a security review.
// No environment keys in Git; JWT verification uses the separate server-only secret.

const { protect } = require('./authMiddleware');
const { authorizeRoles } = require('./roleMiddleware');
const User = require('../models/User');

// In-process IP limiter for the staging admin login. Cloudflare WAF rate limiting
// should also be enabled when this hostname is proxied through Cloudflare.
const attempts = new Map();
function loginRateLimit(req,res) {
  const ip = String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'local').slice(0,128);
  const now = Date.now();
  let state = attempts.get(ip);
  if (!state || now-state.since > 15*60*1000) state = {since:now,hits:0};
  state.hits++;
  if(attempts.size > 4096) attempts.clear();
  attempts.set(ip,state);
  if(state.hits > 20) {
    res.setHeader?.('Retry-After','900');
    res.status(429).json({error:'Πάρα πολλές προσπάθειες. Δοκίμασε αργότερα.'});
    return false;
  }
  return true;
}

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

  // The normal login form sends {identifier,password}. Allow existing verified
  // listeners/broadcasters/admins to sign in with their staging JWT; never
  // offer unauthenticated access to user lists or account management.
  if (req.method === 'POST' && path === '/api/auth/login') {
    if (!loginRateLimit(req,res)) return;
    const identifier = req.body && req.body.identifier;
    const password = req.body && req.body.password;
    if (typeof identifier !== 'string' || !identifier.trim() ||
        identifier.length > 254 || typeof password !== 'string' ||
        password.length < 1 || password.length > 1024) {
      return res.status(400).json({error:'Invalid login request'});
    }
    return next();
  }

  // A user may read their own profile and favorites, never another user's.
  if (req.method === 'GET' && path === '/api/auth/me') return protect(req,res,next);

  const favoriteMatch = req.method === 'POST' &&
    /^\\/api\\/users\\/[0-9a-fA-F]{24}\\/favorites$/.exec(path);
  if (favoriteMatch) {
    return protect(req,res,()=>{
      const userId = path.split('/')[3];
      if (String(req.user._id) === userId || req.user.role === 'admin') return next();
      return res.status(403).json({error:'Forbidden'});
    });
  }

  // Existing signed-in station owners can view only their own stations and analytics.
  const ownerRead = req.method === 'GET' &&
    /^\\/api\\/broadcaster\\/[0-9a-fA-F]{24}\\/(?:stations|analytics|ads)$/.exec(path);
  if (ownerRead) {
    return protect(req,res,()=>{
      const userId = path.split('/')[3];
      if (String(req.user._id) === userId || req.user.role === 'admin') return next();
      return res.status(403).json({error:'Forbidden'});
    });
  }

  // Remaining private routes are restricted to signed-in admins until each
  // production route has proper resource-level authorization.
  protect(req,res,() => authorizeRoles('admin')(req,res,next));
}

module.exports = { stagePublicAccess, publicReads };
