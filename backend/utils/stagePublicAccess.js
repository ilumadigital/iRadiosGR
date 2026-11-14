'use strict';

// Public, read-oriented radio demo on staging with real imported production data.
// Private APIs are *deny-by-default* until each has a security review.
// No environment keys in Git; JWT verification uses the separate server-only secret.

const { protect } = require('./authMiddleware');
const { authorizeRoles } = require('./roleMiddleware');
const User = require('../models/User');
const crypto = require('node:crypto');
const BroadcasterInvitation = require('../models/BroadcasterInvitation');

// Staging remains deny-by-default. Public Broadcaster signup requires rate
// limiting and Cloudflare Siteverify, while invite-bound requests also prove
// the valid emailed invitation token.
async function allowInvitedOnboarding(req, res, next) {
  const token = req.body?.inviteToken;
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(403).json({ error: 'Απαιτείται έγκυρη πρόσκληση broadcaster.' });
  }
  if (!loginRateLimit(req, res)) return;
  try {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await BroadcasterInvitation.findOne({
      tokenHash: hash, email, status: 'pending', expiresAt: { $gt: new Date() }
    }).select('_id');
    if (!invitation) return res.status(403).json({ error: 'Η πρόσκληση έχει λήξει ή δεν ταιριάζει στο email.' });
    return next();
  } catch (_error) {
    return res.status(503).json({ error: 'Δεν ήταν δυνατή η επιβεβαίωση πρόσκλησης.' });
  }
}


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
  '/api/live/updates',
  '/api/live/revision',
  '/api/billing/catalog',
  '/api/stations',
  '/api/stations/discovery',
  '/api/stats/network',
  '/api/ads/public',
  '/api/banners/active',
  '/api/home-slides',
  '/api/newsfeed',
  '/api/promoted-station',
  '/api/catalog/now-playing',
  '/api/cover-art',
  '/api/proxy-stream'
]);

function stagePublicAccess(req, res, next) {
  // The middleware is mounted at /api, and Express req.path excludes the mount prefix.
  const path = (req.baseUrl + req.path).replace(/\/+$/,'') || '/';
  if (req.method === 'GET' && publicReads.has(path)) return next();
  // Media bytes are served only after the Ad controller verifies this exact
  // active campaign and resolves a local /uploads/audio file. No directory access.
  if ((req.method==='GET'||req.method==='HEAD') &&
      /^\/api\/ads\/[a-f0-9]{24}\/media$/i.test(path))return next();
  // Only campaign metrics are public writes; stage creative/status checks happen in controllers.
  if (req.method === 'POST' && /^\/api\/(?:ads|banners)\/[a-f0-9]{24}\/(?:impression|click|completed|skipped)$/i.test(path)) return next();
  // A preview capability is checked by its own HMAC verifier, never issued here.
  if (req.method === 'POST' && path === '/api/widget-previews/verify') return next();
  // Approved station widgets read native-only RDS; the controller excludes
  // private Premium AI and validates the 24-character station ID.
  if (req.method === 'GET' && /^\/api\/catalog\/widget-native\/[a-f0-9]{24}$/i.test(path)) return next();
  // Only approved-schedule producer photos; the controller validates the exact
  // image against the station and uses DNS-pinned, size-bounded upstream fetch.
  if (req.method === 'GET' && /^\/api\/catalog\/widget-show-image\/[a-f0-9]{24}$/i.test(path)) return next();
  if (req.method === 'GET' && /^\/api\/catalog\/widget-native\/[a-f0-9]{24}\/playlist$/i.test(path)) return next();
  if (req.method === 'GET' && path === '/api/broadcaster-invitations/preview') return next();
  // The VAPID public key contains no secret. Device writes remain JWT scoped.
  if (req.method === 'GET' && path === '/api/notifications/vapidPublicKey') return next();
  if ((req.method === 'PUT' || req.method === 'DELETE') && path === '/api/notifications/my-device')
    return protect(req,res,next);
  if (req.method === 'POST' && path === '/api/notifications/my-device/status')
    return protect(req,res,next);
  // The runtime public site key is intentionally public; the secret is never returned.
  if (req.method === 'GET' && path === '/api/auth/turnstile-config') return next();
  if (req.method === 'POST' && (path === '/api/auth/register' ||
      path === '/api/auth/register-agency')) {
    if (!loginRateLimit(req,res))return;
    const email=req.body?.email, username=req.body?.username;
    if (typeof email!=='string' || email.length>254 ||
        typeof username!=='string' || username.length>60)
      return res.status(400).json({error:'Μη έγκυρα στοιχεία εγγραφής.'});
    return next(); // Cloudflare verification is mandatory at the next router.
  }
  if(req.method==='POST' && path==='/api/auth/verify-email'){
    if(!loginRateLimit(req,res))return;
    if(typeof req.body?.token!=='string'||!/^[a-f0-9]{64}$/i.test(req.body.token))
      return res.status(400).json({error:'Μη έγκυρος σύνδεσμος επαλήθευσης.'});
    return next();
  }
  if(req.method==='POST' && path==='/api/auth/resend-verification')return protect(req,res,next);
  if (req.method==='POST' && path==='/api/auth/register-broadcaster') {
    if(req.body?.inviteToken!==undefined)return allowInvitedOnboarding(req,res,next);
    if(!loginRateLimit(req,res))return;
    const email=req.body?.email, username=req.body?.username;
    if(typeof email!=='string'||email.length>254||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
       typeof username!=='string'||username.length>60||
       !/^[a-zA-Z0-9_.-]{3,60}$/.test(username))
      return res.status(400).json({error:'Μη έγκυρα στοιχεία εγγραφής Broadcaster.'});
    // Auth route performs mandatory server-side Cloudflare Turnstile validation.
    return next();
  }
  if (req.method==='POST' && path==='/api/auth/verify-otp') {
    if(req.body?.inviteToken)return allowInvitedOnboarding(req,res,next);
    if(!loginRateLimit(req,res))return;
    if(typeof req.body?.email!=='string' || req.body.email.length>254 ||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email) ||
       typeof req.body?.otp!=='string' || !/^\d{6}$/.test(req.body.otp))
      return res.status(400).json({error:'Συμπλήρωσε έγκυρο email και 6ψήφιο κωδικό.'});
    return next();
  }
  if(req.method==='POST'&&path==='/api/auth/admin-2fa/verify'){
    if(!loginRateLimit(req,res))return;
    if(typeof req.body?.challenge!=='string'||!/^[a-f0-9]{64}$/.test(req.body.challenge)||
       typeof req.body?.code!=='string'||!/^[0-9]{6}$/.test(req.body.code))
      return res.status(400).json({error:'Συμπλήρωσε έγκυρο κωδικό 6 ψηφίων.'});
    return next();
  }
  if (req.method === 'POST' && (path === '/api/broadcaster-invitations/claim' ||
      path === '/api/broadcaster-invitations/activate-broadcaster')) return protect(req, res, next);

  if (req.method === 'GET' && /^\/api\/newsfeed\/articles\/[a-f0-9]{24}$/.test(path)) return next();
  // Public radio playback can report an anonymous, bounded listening heartbeat.
  // This endpoint cannot read metadata, choose streams or trigger recognition directly.
  if (req.method === 'POST' && path === '/api/listen/heartbeat') return next();

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

  // Password recovery is public, but constrained to validated requests.
  // The recovery token is checked by authController before changing a password.
  if (req.method === 'POST' && path === '/api/auth/forgot-password') {
    if (!loginRateLimit(req, res)) return;
    const email = req.body?.email;
    const normalized = typeof email === 'string' ? email.trim() : '';
    if (!normalized || normalized.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return res.status(400).json({ error: 'Συμπλήρωσε έγκυρη διεύθυνση email.' });
    }
    return next();
  }
  if (req.method === 'POST' && path === '/api/auth/reset-password') {
    if (!loginRateLimit(req, res)) return;
    const token = req.body?.token;
    const password = req.body?.newPassword;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) ||
        typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Μη έγκυρος σύνδεσμος ή κωδικός επαναφοράς.' });
    }
    return next();
  }

  // A producer invitation is proven by a signed one-time JWT in the body.
  // The existing guest-facing invite page must remain accessible without
  // granting anonymous access to any other producer management operation.
  if(req.method==='POST' && path==='/api/producers/accept-invite'){
    const token=req.body?.token,pass=req.body?.newPassword;
    if(typeof token!=='string'||token.length<40||token.length>2048||
      typeof pass!=='string'||pass.length<10||pass.length>128)
      return res.status(400).json({error:'Μη έγκυρα στοιχεία πρόσκλησης.'});
    if(!loginRateLimit(req,res))return;
    return next();
  }

  // A user may read their own profile and favorites, never another user's.
  if (req.method === 'GET' && path === '/api/auth/me') return protect(req,res,next);
  if (req.method === 'GET' && (path === '/api/billing/me/grants' ||
    path === '/api/billing/me/entitlements' ||
    path === '/api/billing/me/station-entitlements')) return protect(req,res,next);

  // Sandbox checkout is authenticated and allowed only for the user's OWN
  // paid intent. The controller also enforces the explicit staging feature gate.
  if (req.method==='POST'&&path==='/api/billing/checkout')return protect(req,res,next);
  if (req.method==='POST'&&path==='/api/billing/me/renewal-notice/snooze')return protect(req,res,next);
  if(req.method==='POST'&&path==='/api/billing/me/payment-method/revoke')return protect(req,res,next);
  if(req.method==='POST'&&path==='/api/billing/me/recurring/cancel')return protect(req,res,next);
  if (req.method==='GET'&&(path==='/api/billing/me/orders'||
    path==='/api/billing/me/renewal-notice'||
    path==='/api/billing/me/winback'||
    path==='/api/billing/me/recurring-status'||
    path==='/api/billing/me/payment-method'||
    path==='/api/billing/me/overview'||
    /^\/api\/billing\/orders\/[a-f0-9]{24}$/i.test(path)))return protect(req,res,next);

  // Broadcaster checkout/renewal uses the authenticated account only.
  // The purchase controller separately validates role, SKU and owned station.
  const broadcasterBilling=(req.method==='POST'&&[
    '/api/billing/broadcaster/checkout','/api/billing/broadcaster/recurring/cancel'
   ].includes(path))||(req.method==='GET'&&(
    ['/api/billing/broadcaster/orders','/api/billing/broadcaster/recurring'].includes(path)
    ||/^\/api\/billing\/broadcaster\/orders\/[a-f0-9]{24}$/i.test(path)
   ));
  if(broadcasterBilling)return protect(req,res,next);
  if((req.method==='GET'||req.method==='POST')&&
   path==='/api/billing/broadcaster/premium-boost')return protect(req,res,next);

  // Signed operator gate before the WebDSP controller's per-station billing
  // entitlement and ownership check. Other Broadcaster writes remain separate.
  if(req.method==='PUT' && /^\/api\/stations\/[a-f0-9]{24}\/dsp$/i.test(path))
    return protect(req,res,()=>authorizeRoles('admin','broadcaster')(req,res,next));
  if((req.method==='PUT'&&
      /^\/api\/broadcaster\/stations\/[a-f0-9]{24}\/network-ads$/i.test(path))||
     (req.method==='POST'&&path==='/api/broadcaster/stations'))
    return protect(req,res,next);

  // Self-service listener actions are scoped by req.user in protected handlers.
  // Without this allowlist the default admin-only staging policy hides Profile
  // preferences and causes the entire account form to look empty.
  const listenerSelfRead = req.method === 'GET' &&
    ['/api/users/me/notification-preferences','/api/users/me/follows',
      '/api/users/me/inbox','/api/users/me/inbox/count'].includes(path);
  const listenerSelfWrite = (
    (req.method === 'PUT' && path === '/api/users/me') ||
    (req.method === 'PATCH' && path === '/api/users/me/notification-preferences') ||
    (req.method === 'POST' && path === '/api/users/me/follows') ||
    (req.method === 'POST' && path === '/api/users/me/inbox/read-all') ||
    (req.method === 'DELETE' && path === '/api/users/me/inbox') ||
    (req.method === 'POST' && /^\/api\/users\/me\/inbox\/[a-f0-9]{24}\/read$/i.test(path)) ||
    (req.method === 'DELETE' && /^\/api\/users\/me\/follows\/[a-f0-9]{24}$/i.test(path)) ||
    (req.method === 'DELETE' && /^\/api\/users\/me\/inbox\/[a-f0-9]{24}$/i.test(path))
  );
  if (listenerSelfRead || listenerSelfWrite) return protect(req,res,next);
  // Authenticated station contact only; staging delivers to Mailpit, not production SMTP.
  if (req.method === 'POST' && /^\/api\/stations\/[a-f0-9]{24}\/contact$/i.test(path))
    return protect(req,res,next);
  // All other sensitive email, payment and push APIs remain admin-only on staging.

  // The station list was rejected by staging's default admin-only policy.
  // Explicitly admit authenticated Admin/Broadcaster; the DSP controller
  // still checks that an owner has an active new station WebDSP entitlement.
  if(req.method==='GET'&&path==='/api/stations/dsp-access')
    return protect(req,res,()=>authorizeRoles('admin','broadcaster')(req,res,next));
  // Invitation acceptance alone is not enough: the preview route also checks
  // approved station ownership and active billing rights before returning streams.
  if(req.method==='GET'&&path==='/api/stations/dsp-preview-access')
    return protect(req,res,()=>authorizeRoles('broadcaster')(req,res,next));

  // Agency can load only the dedicated overview projection. Every other
  // Backoffice path is still denied inside backofficeRoutes's role gate.
  if (path === '/api/backoffice' || path.startsWith('/api/backoffice/')) {
    return protect(req,res,()=>authorizeRoles('admin','broadcaster','producer','agency')(req,res,next));
  }

  // Hardened stage Ad Control actions: route verifies owner AND station
  // entitlement. Uploaded audio is validated and limited before persistence.
  if ((req.method==='POST'&&
       (path==='/api/broadcaster/ads'||path==='/api/uploads/upload-ad'))||
      ((req.method==='PUT'||req.method==='DELETE')&&
       /^\/api\/broadcaster\/ads\/[a-f0-9]{24}$/i.test(path)))
    return protect(req,res,next);

  // Advertising v2 must be reachable by its own Agency. The actual routes
  // also validate tenant ownership and Admin-only actions. Never open a broad
  // /api pass-through: public radio still requires its own allowlisted route.
  if (path.startsWith('/api/advertising/'))
    return protect(req,res,()=>authorizeRoles('agency','admin')(req,res,next));
  if (path.startsWith('/api/admin/advertising/'))
    return protect(req,res,()=>authorizeRoles('admin')(req,res,next));

  // Agency sandbox actions are authenticated; handlers verify role and ownership.
  if (path.startsWith('/api/agency/') ||
      (req.method==='POST' && ['/api/uploads/upload-banner','/api/uploads/upload-logo'].includes(path)))
    return protect(req,res,next);

  // Listener-only song metadata, station playlist history and ACRCloud recognition.
  if (req.method === 'GET' && /^\/api\/stations\/[0-9a-fA-F]{24}\/playlist$/.test(path)) return protect(req,res,next);
  if (req.method === 'GET' && path === '/api/metadata') return protect(req,res,next);
  if (req.method === 'GET' && path === '/api/metadata/live') return protect(req,res,next);
  if (req.method === 'POST' && path === '/api/recognize-proxy') return protect(req,res,next);

  // Signed-in users can accept terms for their own JWT identity only.
  // The controller never accepts a client-supplied user ID.
  if (req.method === 'PUT' && path === '/api/users/me/accept-terms') return protect(req,res,next);

  const favoriteMatch = req.method === 'POST' &&
    new RegExp('^/api/users/[0-9a-fA-F]{24}/favorites$').test(path);
  if (favoriteMatch) {
    return protect(req,res,()=>{
      const userId = path.split('/')[3];
      if (String(req.user._id) === userId || req.user.role === 'admin') return next();
      return res.status(403).json({error:'Forbidden'});
    });
  }

  // Existing signed-in station owners can view only their own stations and analytics.
  const ownerRead = req.method === 'GET' &&
    new RegExp('^/api/broadcaster/[0-9a-fA-F]{24}/(stations|analytics|ads)$').test(path);
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
