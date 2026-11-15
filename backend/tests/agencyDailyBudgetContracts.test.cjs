'use strict';
// Static contracts are runnable without credentials or MongoDB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('only an authenticated Agency can change its own paid campaign daily cap',()=>{
 const routes=read('backend/routes/advertisingCampaignRoutes.js');
 const manager=read('backend/services/advertisingDailyBudgetManager.js');
 assert.match(routes,/router\.patch\('\/advertising\/campaigns\/:id\/daily-budget'/);
 assert.match(routes,/!isAgency\(req\)/);
 assert.match(manager,/agencyId:user,workflowVersion:2,createdByRole:'agency'/);
 assert.match(manager,/source:'nexi_verified',rateModel:'v2_event'/);
 assert.match(manager,/settlementMode:'mongo_transaction_v2'/);
 assert.match(manager,/expectedDailyBudgetCents/);
 assert.match(manager,/session\.withTransaction/);
 assert.match(manager,/limitNanos:newLimit/);
 assert.match(manager,/spent\+reserved/);
 assert.match(manager,/Change\.create\(/);
 assert.doesNotMatch(manager,/FundingLot\.(update|create|delete|findOneAndUpdate)/);
});
test('dashboard uses worst-case ticket reservation rather than positive credit',()=>{
 const analytics=read('backend/routes/advertisingV2Routes.js');
 const helper=read('backend/services/advertisingV2CampaignAvailability.js');
 const ui=read('frontend/src/components/AdvertisingV2CampaignStats.jsx');
 assert.match(analytics,/analyzeAvailability\(/);
 assert.match(analytics,/campaignRunning&&capacity\.nextTicketAffordable/);
 assert.match(helper,/eventReserveNanos/);
 assert.match(helper,/eligibleLots\.some/);
 assert.match(ui,/delivery\.payable/);
});
test('paid campaign goes to full Campaign Manager, not locked purchase wizard',()=>{
 const wizard=read('frontend/src/pages/AdvertisingCampaignWizard.jsx');
 const panel=read('frontend/src/components/AgencyCampaignControl.jsx');
 assert.match(wizard,/managingPaidCampaign/);
 assert.match(wizard,/<AgencyCampaignControl/);
 assert.match(panel,/Budget & χρεώσεις/);
 assert.match(panel,/Ημερήσιο όριο προβολών/);
 assert.match(panel,/expectedDailyBudgetCents/);
 assert.match(panel,/Ιστορικό αλλαγών/);
 assert.match(panel,/Επανενεργοποίηση/);
});
