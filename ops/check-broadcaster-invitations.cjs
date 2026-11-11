'use strict';
// Source-level regression contract; no network, database, SMTP or production data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const model = read('backend/models/BroadcasterInvitation.js');
const api = read('backend/routes/broadcasterInvitationRoutes.js');
const stage = read('backend/utils/stagePublicAccess.js');
const station = read('backend/routes/stationRoutes.js');
const auth = read('backend/controllers/authController.js');
const admin = read('frontend/src/pages/AdminRadioSet.jsx');
const onboarding = read('frontend/src/pages/BroadcasterInvitation.jsx');
const goBroadcast = read('frontend/src/pages/GoBroadcast.jsx');
const broadcasterRegister = read('frontend/src/pages/BroadcasterRegister.jsx');
const app = read('frontend/src/App.jsx');
const terms = read('frontend/src/pages/TermsBroadcasters.jsx');

for (const snippet of ["status: 'pending'", "partialFilterExpression: { status: 'pending' }",
    "tokenHash: { type: String, required: true, unique: true, select: false }"]) {
  assert.ok(model.includes(snippet), 'missing stored invitation safety ' + snippet);
}
for (const snippet of [
  "crypto.randomBytes(32)", "crypto.createHash('sha256')",
  "INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000",
  "protect, authorizeRoles('admin')", "loadUnownedStation",
  "status: 'pending', expiresAt: { $gt: new Date() }",
  "normalizeEmail(req.user.email) !== invitation.email",
  "req.user.isVerified", "hasAcceptedCurrentBroadcasterTerms(req.user)",
  "Station.findOneAndUpdate(", "broadcasterId: null",
  "BroadcasterInvitation" // API basename comment or import not relevant; see require below
]) {
  if (snippet === 'BroadcasterInvitation') continue;
  assert.ok(api.includes(snippet), 'missing backend invitation guard ' + snippet);
}
assert.ok(api.includes("require('../models/BroadcasterInvitation')"), 'API uses dedicated persisted invitation model');
assert.ok(api.includes("return res.status(502)"), 'SMTP failure is not successful invitation');
assert.ok(api.includes("status: 'accepted'"), 'token is consumed once');
assert.ok(!api.includes('res.json({ token:'), 'never return invite token in admin JSON');
assert.ok(station.includes("router.put('/admin/stations/:id/assign', protect, authorizeRoles('admin')"),
  'manual assignment remains admin-only');
assert.ok(station.includes('BroadcasterInvitation.updateMany'), 'manual ownership invalidates old links');
assert.ok(stage.includes("'/api/auth/register-broadcaster'") && stage.includes("allowInvitedOnboarding(req, res, next)") &&
  stage.includes('if(req.body?.inviteToken!==undefined)return allowInvitedOnboarding(req,res,next);') &&
  stage.includes('if(!loginRateLimit(req,res))return;'),
  'staging allows Turnstile-gated public signup and separately validates invitations');
assert.ok(stage.includes("'/api/broadcaster-invitations/preview'"),
  'staging allows public token preview');
assert.ok(auth.includes("if (inviteToken !== undefined)") &&
          auth.includes("tokenHash: crypto.createHash('sha256')"),
  'normal broadcaster registration checks optional invitation token');
for (const snippet of ['modalTab', 'inviteEmail', 'handleSendInvite', 'handleRevokeInvite', 'Επαναποστολή'])
  assert.ok(admin.includes(snippet), 'admin invitation UI missing ' + snippet);
for (const snippet of ['activate-broadcaster', 'broadcaster-invitations/claim', 'hasAcceptedCurrentBroadcasterTerms'])
  assert.ok(onboarding.includes(snippet), 'onboarding flow missing ' + snippet);
assert.ok(app.includes('path="/broadcaster-invite"'), 'registered public invite route missing');
assert.ok(goBroadcast.includes('/broadcast/register?invite=') &&
  broadcasterRegister.includes('...(inviteToken?{inviteToken}:{})'),
  'invitation survives landing redirect and email-link registration');
assert.ok(auth.includes('verificationLinkEmail(fname,verification.token,{broadcaster:true})') &&
  auth.includes("role:{$in:['user','broadcaster']}"),
  'Broadcaster registration and confirmation use a single-use email link');
assert.ok(terms.includes('/broadcaster-invite?token='), 'B2B terms must resume invitation');
console.log('Broadcaster station invitation safety and UI integration contracts passed.');
