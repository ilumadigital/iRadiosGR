'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const filename of ['Login', 'Register', 'GoAgency']) {
  const source = read(`frontend/src/pages/${filename}.jsx`);
  assert.match(source, /const turnstileRef = useRef\(null\)/, `${filename}: widget must be resettable`);
  assert.match(source, /turnstileRef\.current\?\.reset\(\)/, `${filename}: reset widget after failed request`);
  assert.match(source, /ref=\{turnstileRef\}/, `${filename}: connect widget ref`);
  assert.match(source, /onSuccess=\{\(token\) => setCfToken\(token\)\}/, `${filename}: new token accepted after reset`);
  assert.doesNotMatch(source, /disabled=\{loading\s*\|\|\s*!cfToken\}/, `${filename}: don't permanently disable retry`);
  assert.match(source, /if \(!cfToken\)/, `${filename}: server request must require verified token`);
  assert.match(source, /resetTurnstile\(\)/, `${filename}: recover from failed submissions`);
}
for (const filename of ['Login', 'Register', 'ResetPassword']) {
  const source = read(`frontend/src/pages/${filename}.jsx`);
  assert.match(source, /<AuthShell>/, `${filename}: shared shell`);
  assert.match(source, /<AuthIntro/, `${filename}: common heading`);
  assert.match(source, /ir-auth-card/, `${filename}: glass card`);
}
// Listener is token-link; Agency may still show OTP. Broadcaster uses a separate page.
for (const filename of ['Login', 'GoAgency']) {
  assert.match(read(`frontend/src/pages/${filename}.jsx`), /ir-auth-modal/, `${filename}: glass modal`);
}
const broadcasterRegistration=read('frontend/src/pages/BroadcasterRegister.jsx');
const broadcasterLanding=read('frontend/src/pages/GoBroadcast.jsx');
assert.match(broadcasterRegistration,/const turnstileRef\s*=\s*useRef\(null\)/,'Broadcaster signup stores the Turnstile widget ref');
assert.match(broadcasterRegistration,/turnstileRef\.current\?\.reset\(\)/,'Broadcaster signup resets failed Turnstile');
assert.match(broadcasterRegistration,/ref=\{turnstileRef\}/,'Broadcaster signup has a live widget');
assert.match(broadcasterRegistration,/onSuccess=\{setCfToken\}/,'Broadcaster signup accepts a fresh Turnstile token');
assert.match(broadcasterRegistration,/if\(!cfToken\)/,'Broadcaster signup requires Turnstile verification');
assert.match(broadcasterRegistration,/resetCaptcha\(\)/,'Broadcaster signup recovers after a failed request');
assert.doesNotMatch(broadcasterRegistration,/ir-auth-modal|showOtpModal|handleVerifyOtp|verify-otp/,
 'Broadcaster account registration and email verification must never use a modal or OTP');
assert.match(broadcasterRegistration,/auth\/register-broadcaster/,'Broadcaster signup retains its API');
assert.match(broadcasterRegistration,/auth\/resend-verification/,'Broadcaster verification pending screen can request a new email link');
assert.doesNotMatch(broadcasterLanding,/ir-auth-modal|showOtpModal|register-broadcaster/,
 'Broadcaster marketing landing is independent from the registration form');
const listenerRegistration=read('frontend/src/pages/Register.jsx');
assert.doesNotMatch(listenerRegistration,/ir-auth-modal|showOtpModal|handleVerifyOtp/,
  'Listener signup must not block on OTP');
assert.match(listenerRegistration,/localStorage\.setItem\('iluma_token', data\.token\)/,
  'Listener signup establishes a session immediately');
assert.match(read('frontend/src/components/EmailVerificationBanner.jsx'),/auth\/resend-verification/,
  'Unverified listener sees a resend action');
const css = read('frontend/src/styles/auth.css');
assert.match(read('frontend/src/index.css'), /@import "\.\/styles\/auth\.css"/);
assert.match(read('frontend/src/components/AuthShell.jsx'), /iradios-app-logo\.png/);
assert.match(css, /@media \(max-width: 480px\)/, 'small-screen breakpoints');
assert.match(css, /backdrop-filter: blur/, 'translucent glass');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion support');
console.log('Authentication glass layout + retry contracts passed');

const app=read('frontend/src/App.jsx');
const shell=read('frontend/src/components/AuthShell.jsx');
assert.match(app,/if\(location\.pathname==='\/login'\)return <StandaloneAuthPage type="login"\/>/,
  'Login must be routed outside MainApp and audio player');
assert.match(app,/if\(location\.pathname==='\/register'\)return <StandaloneAuthPage type="register"\/>/,
  'Listener Register must be routed outside MainApp and player');
assert.ok(app.indexOf("if(location.pathname==='/login')") < app.indexOf("return location.pathname==='/backoffice'"),
  'Authentication route is evaluated before the listener app is created');
assert.match(shell,/ir-auth-page--/, 'Authentication shell exposes scoped layout classes');
assert.match(css,/\.ir-auth-page--login \.ir-auth-shell[\s\S]*?height: 90dvh;/,
  'Desktop login shell uses 90dvh');
assert.match(css,/\.ir-auth-page--register \.ir-auth-card/,
  'Registration has its own responsive sizing and does not inherit login 90vh');
assert.match(read('frontend/src/pages/Login.jsx'),/ir-auth-card--login/, 'Login has compact layout marker');
assert.match(read('frontend/src/pages/Register.jsx'),/ir-auth-card--register/, 'Register has its own compact card');
