'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const wizard=read('backend/routes/advertisingWizardRoutes.js');
const ui=read('frontend/src/pages/AdvertisingCampaignWizard.jsx');
const billing=read('backend/routes/advertisingCampaignRoutes.js');
const webhook=read('backend/services/advertisingPaymentEvents.js');
const agency=read('backend/routes/agencyRoutes.js');

test('Campaign wizard stages are exactly ordered and Agency final submission is last',()=>{
 for(const label of ['Καμπάνια','Visual / Audio','Budget','Overview','Πληρωμή','Έγκριση'])
  assert.ok(ui.includes("title:'"+label+"'"),label);
 assert.ok(ui.includes("admin?[...stages.slice(0,4)"));
 assert.ok(ui.includes('AdvertisingCampaignWizard({role='));
 assert.ok(ui.includes('Αποστολή στον Admin για έγκριση'));
 assert.ok(ui.includes('estimatedImpressions'));
 assert.ok(ui.includes('quote.paymentCents'));
 assert.ok(ui.includes('Η επιστροφή στην εφαρμογή δεν σημαίνει εξόφληση.'));
 assert.ok(ui.includes('window.setInterval(refresh,6000)'));
 assert.ok(ui.includes("await request('/api/advertising/payments/'+intent._id)"));
 assert.ok(ui.includes('Μόνο το υπογεγραμμένο webhook') || ui.includes('μόνο το υπογεγραμμένο webhook'));
 assert.ok(!ui.includes('server-side sandbox payment flag'));
 assert.ok(read('frontend/src/pages/AgencyAdvertisingV2.jsx').includes('<AdvertisingCampaignWizard role="agency"/>'));
 assert.ok(read('frontend/src/pages/AdminAdvertisingV2.jsx').includes('<AdvertisingCampaignWizard role="admin"'));
});

test('Wizard routes are scoped to their explicit authenticated prefix; no global guard',()=>{
 assert.match(wizard,/router\.use\(prefix,protect/);
 assert.match(wizard,/prefix:'\/advertising\/wizard',role:'agency'/);
 assert.match(wizard,/prefix:'\/admin\/advertising\/wizard',role:'admin'/);
 assert.doesNotMatch(wizard,/^\s*router\.use\(protect\b/m);
 assert.match(read('backend/server.js'),/app\.use\('\/api', require\('\.\/routes\/advertisingWizardRoutes'\)\)/);
 assert.match(wizard,/createdByRole:role,workflowVersion:2/);
 assert.match(wizard,/agencyId:req\.user\._id/);
 assert.match(wizard,/approvalStatus:'draft'/);
});

test('New creatives remain private drafts until verified payment and explicit submit',()=>{
 assert.match(wizard,/status:'draft',isStageCreative:true/);
 assert.match(wizard,/agencyDraftNoticeVersion:0/);
 assert.match(wizard,/if\(paid<campaign\.plannedBudgetCents\*10000\)/);
 assert.match(wizard,/source:'nexi_verified'/);
 assert.match(wizard,/kind:'paid_pending_review'/);
 assert.match(wizard,/approvalStatus:'pending',submittedAt:new Date\(\)/);
 assert.match(wizard,/agencyDraftNoticeVersion:1/);
 assert.match(webhook,/if\(campaign\.workflowVersion!==2\)/);
 assert.match(webhook,/if\(quote\.kind==='topup'\|\|campaign\.workflowVersion!==2\)/);
 assert.match(agency,/workflowVersion:\{\$ne:2\}/);
 assert.match(billing,/campaign\.plannedBudgetCents!==req\.body\?\.budgetCents/);
 assert.match(billing,/campaign\.workflowVersion===2\|\|!allowUnfundedReview\(\)/);
});

test('Admin free creation is separated from signed Nexi money and no fake credit',()=>{
 assert.match(wizard,/if\(role==='agency'\)/);
 assert.match(wizard,/if\(role==='admin'&&campaign\.approvalStatus==='pending'\)/);
 assert.match(wizard,/adminNoPayment:true/);
 assert.doesNotMatch(wizard,/Lot\.create\(/);
 assert.match(read('backend/models/AdvertisingFundingLot.js'),/admin_complimentary/);
 const eligibility=read('backend/services/advertisingDeliveryEligibility.js');
 assert.match(eligibility,/process\.env\.APP_ENV!=='staging'/);
 assert.match(eligibility,/createdByRole:'admin',approvalStatus:'approved'/);
 assert.match(eligibility,/roles\.get\(String\(c\.agencyId\)\)==='admin'/);
 assert.match(eligibility,/if\(!ATOMIC_SETTLEMENT_IMPLEMENTED\)/);
 // Agency placement QA is explicitly opt-in, requires verified funding,
 // and MUST NOT enable paid CPM settlement or counterfeit receipts.
 assert.match(eligibility,/paidPlacementPreviewEnabled\(\)/);
 assert.match(eligibility,/createdByRole:'agency',approvalStatus:'approved'/);
 assert.match(eligibility,/source:'nexi_verified'/);
 assert.match(eligibility,/affordablePaidPreview\(/);
 assert.match(eligibility,/ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
 assert.match(read('frontend/src/pages/AgencyCampaignTopUp.jsx'),/kind:'topup'/);
});

test('Pricing update does not $set and $inc the same Mongo path',()=>{
 assert.match(billing,/const \{version:obsoleteVersion,\.\.\.updatedFields\}=next/);
 assert.match(billing,/\$set:\{\.\.\.updatedFields,changedBy/);
 assert.doesNotMatch(billing,/\$set:\{\.\.\.next,changedBy/);
 assert.match(billing,/sandboxCheckoutReady/);
});

test('Only Admin can review wizard creatives after Agency submits verified funds',()=>{
 assert.match(wizard,/router\.get\('\/admin\/advertising\/wizard\/campaigns\/:id\/creatives-review'/);
 assert.match(wizard,/router\.put\('\/admin\/advertising\/wizard\/campaigns\/:id\/creatives-review\/:kind\/:creativeId'/);
 assert.match(wizard,/approvalStatus:'pending'/);
 assert.match(wizard,/source:'nexi_verified'/);
 assert.match(read('frontend/src/pages/AdminAdvertisingV2.jsx'),/Έλεγχος δημιουργικών/);
 assert.match(read('frontend/src/pages/AdminAdvertisingV2.jsx'),/reviewCreative/);
 // Admin can now see drafts for deletion; approval remains pending-only.
 const adminUI=read('frontend/src/pages/AdminAdvertisingV2.jsx');
 assert.match(adminUI,/setCampaigns\(data\)/);
 assert.match(adminUI,/c\.approvalStatus==='pending'/);
 assert.match(adminUI,/!c\.deletedAt&&c\.approvalStatus==='pending'/);
});
