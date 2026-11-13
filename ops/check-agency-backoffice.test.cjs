'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Agency uses player-free Backoffice shell for all operational pages',()=>{
 const app=read('frontend/src/App.jsx');
 const login=read('frontend/src/pages/Login.jsx');
 const shell=read('frontend/src/pages/Backoffice.jsx');
 const editor=read('frontend/src/pages/CampaignEditor.jsx');
 const v2=read('frontend/src/pages/AgencyAdvertisingV2.jsx');
 assert.match(app,/'\/agency\/dashboard':'\/backoffice'/);
 assert.match(app,/'\/agency\/v2\/campaigns':'\/backoffice\/agency\/campaigns'/);
 assert.match(app,/backoffice\/agency\/creatives\/.*location\.pathname/);
 assert.match(app,/location\.pathname\.startsWith\('\/backoffice\/'\)/);
 assert.match(login,/\['admin','broadcaster','producer','agency'\]/);
 assert.match(shell,/AgencyBackofficeHome/);
 assert.match(shell,/AgencyAdvertisingV2/);
 assert.match(shell,/\/backoffice\/agency\/creatives/);
 assert.match(shell,/if\(agency && !\[/);
 assert.match(shell,/hasAcceptedTerms!==true/);
 assert.match(v2,/AdvertisingCampaignWizard/);
 const wizard=read('frontend/src/pages/AdvertisingCampaignWizard.jsx');
 assert.match(wizard,/Συνέχεια στο Budget/);
 assert.match(wizard,/Αποστολή στον Admin για έγκριση/);
 assert.match(wizard,/Nexi Sandbox Payment/);
 assert.match(editor,/\/backoffice\/agency\/creatives/);
 assert.doesNotMatch(editor,/'\/agency\/dashboard'/);
});

test('Agency cannot use broadcaster/admin station API and has no station projection',()=>{
 const b=read('backend/routes/backofficeRoutes.js');
 const access=read('backend/utils/stagePublicAccess.js');
 assert.match(b,/authorizeRoles\('admin','broadcaster','producer','agency'\)/);
 assert.match(b,/req\.user\.role==='agency'\s*&&[\s\S]*req\.originalUrl\.split\('\?'\)\[0\]!=='\/api\/backoffice\/overview'/);
 assert.match(b,/if\(req\.user\.role==='agency'\)\{[\s\S]*stations:\[\]/);
 assert.match(access,/authorizeRoles\('admin','broadcaster','producer','agency'\)/);
 assert.match(access,/path\.startsWith\('\/api\/advertising\/'\)/);
 assert.match(access,/authorizeRoles\('agency','admin'\)/);
 assert.match(access,/path\.startsWith\('\/api\/admin\/advertising\/'\)/);
 assert.match(access,/authorizeRoles\('admin'\)/);
 // Previously fixed production-impacting regression: public radio remains public.
 assert.match(access,/'\/api\/proxy-stream'/);
 const campaign=read('backend/routes/advertisingCampaignRoutes.js');
 assert.match(campaign,/router\.use\(\['\/advertising','\/admin\/advertising'\],protect,stage\)/);
});

test('public Ad Network landing is nonfinancial, with account onboarding retained',()=>{
 const landing=read('frontend/src/pages/GoAgencyLanding.jsx');
 const account=read('frontend/src/pages/GoAgency.jsx');
 assert.match(landing,/iRadios Ad Network/);
 assert.match(landing,/Visual \+ Audio/);
 assert.match(landing,/Your brand/);
 assert.match(landing,/onAction/);
 assert.match(landing,/Οι χρεώσεις Advertising v2 και η πληρωμένη προβολή δεν έχουν ενεργοποιηθεί/);
 assert.doesNotMatch(landing,/marketingPrices|billingCycle|displayPrices/);
 assert.match(account,/GoAgencyLanding/);
 assert.match(account,/register-agency/);
 assert.match(account,/verify-otp/);
 assert.match(account,/Turnstile/);
 assert.match(account,/navigate\('\/backoffice'\)/);
});
