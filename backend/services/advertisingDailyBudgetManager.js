'use strict';
// Campaign budget editing is a limit change, NEVER a purchase or wallet credit.
// Serializing the campaign + today's cap with the financial ledger transaction
// prevents live ticket reservations from using an inconsistent ceiling.
const mongoose=require('mongoose');
const Campaign=require('../models/AdvertisingCampaign');
const Daily=require('../models/AdvertisingDailyBudget');
const FundingLot=require('../models/AdvertisingFundingLot');
const Change=require('../models/AdvertisingDailyBudgetChange');
const policy=require('./advertisingV2Policy');
const ledger=require('./advertisingV2Ledger');
const error=(message,status)=>Object.assign(new Error(message),{status});
const scope=(id,user)=>({
 _id:id,agencyId:user,workflowVersion:2,createdByRole:'agency',
 isStageCampaign:true,deletedAt:null,
 approvalStatus:{$in:['pending','approved','rejected']}
});
function validateDailyChange({dailyBudgetCents,expectedDailyBudgetCents},campaign){
 if(!Number.isSafeInteger(expectedDailyBudgetCents)||expectedDailyBudgetCents<1)
  throw error('Ανανέωσε τη σελίδα πριν αλλάξεις το ημερήσιο όριο.',400);
 if(!Number.isSafeInteger(dailyBudgetCents)||!policy.validDailyBudget(
   dailyBudgetCents,campaign.plannedBudgetCents))
  throw error('Το ημερήσιο όριο πρέπει να είναι θετικό και έως το συνολικό budget.',422);
 if(campaign.dailyBudgetCents!==expectedDailyBudgetCents)
  throw error('Το ημερήσιο όριο άλλαξε από άλλη συνεδρία. Ανανέωσε τη σελίδα.',409);
 return dailyBudgetCents;
}
const availableAt=(spent,reserved,limit)=>Math.max(0,limit-spent-reserved);
async function getDailyBudget({campaignId,agencyId}){
 const campaign=await Campaign.findOne(scope(campaignId,agencyId))
  .select('_id dailyBudgetCents plannedBudgetCents').lean();
 if(!campaign)throw error('Η καμπάνια δεν βρέθηκε.',404);
 const day=policy.athensDay();
 const [today,history]=await Promise.all([
  Daily.findOne({campaignId:campaign._id,day}).lean(),
  Change.find({campaignId:campaign._id}).sort({createdAt:-1}).limit(12)
   .select('day oldDailyBudgetCents newDailyBudgetCents createdAt').lean()
 ]);
 const limit=campaign.dailyBudgetCents*policy.NANOS_PER_CENT;
 const spent=today?.spentNanos||0,reserved=today?.reservedNanos||0;
 return {campaignId:campaign._id,day,
  dailyBudgetCents:campaign.dailyBudgetCents,
  plannedBudgetCents:campaign.plannedBudgetCents,
  limitNanos:limit,spentNanos:spent,reservedNanos:reserved,
  availableNanos:availableAt(spent,reserved,limit),history};
}
async function changeDailyBudget({campaignId,agencyId,dailyBudgetCents,
 expectedDailyBudgetCents}){
 const readiness=await ledger.financialReadiness();
 if(!readiness.mongoReplicaSetReady)
  throw error('Η ασφαλής ενημέρωση budget απαιτεί MongoDB transactions.',503);
 const session=await mongoose.startSession();
 let result;
 try{
  await session.withTransaction(async()=>{
   const campaign=await Campaign.findOne(scope(campaignId,agencyId))
    .session(session).lean();
   if(!campaign)throw error('Η καμπάνια δεν βρέθηκε.',404);
   const next=validateDailyChange({dailyBudgetCents,expectedDailyBudgetCents},campaign);
   const verified=await FundingLot.findOne({campaignId:campaign._id,
    source:'nexi_verified',rateModel:'v2_event',
    settlementMode:'mongo_transaction_v2'}).select('rateCardSnapshot')
    .session(session).lean();
   if(!verified||!policy.matchesRateCardSnapshot(verified.rateCardSnapshot))
    throw error('Απαιτείται επιβεβαιωμένη πίστωση Advertising v2.',409);
   const day=policy.athensDay();
   const today=await Daily.findOne({campaignId:campaign._id,day})
    .session(session).lean();
   const oldLimit=campaign.dailyBudgetCents*policy.NANOS_PER_CENT;
   const newLimit=next*policy.NANOS_PER_CENT;
   const spent=today?.spentNanos||0,reserved=today?.reservedNanos||0;
   if(today&&today.limitNanos!==oldLimit)
    throw error('Το ημερήσιο ledger έχει ενημερωθεί. Ανανέωσε τη σελίδα.',409);
   if(newLimit<spent+reserved)
    throw error('Το νέο όριο δεν καλύπτει τις σημερινές χρεώσεις και ενεργές κρατήσεις.',409);
   if(next===campaign.dailyBudgetCents){
    result={changed:false,day,dailyBudgetCents:next,spentNanos:spent,
     reservedNanos:reserved,availableNanos:availableAt(spent,reserved,newLimit)};
    return;
   }
   // Campaign CAS blocks concurrent UI changes; Daily writes conflict with
   // live reservations. Both writes and the audit are majority committed.
   const updated=await Campaign.updateOne({...scope(campaignId,agencyId),
    dailyBudgetCents:expectedDailyBudgetCents},
    {$set:{dailyBudgetCents:next}},{session});
   if(updated.modifiedCount!==1)
    throw error('Το budget άλλαξε ταυτόχρονα. Ανανέωσε τη σελίδα.',409);
   if(today){
    const ledgerUpdate=await Daily.updateOne({_id:today._id,limitNanos:oldLimit,
     $expr:{$lte:[{$add:['$spentNanos','$reservedNanos']},newLimit]}},
     {$set:{limitNanos:newLimit}},{session});
    if(ledgerUpdate.modifiedCount!==1)
     throw error('Η ημερήσια πίστωση ενημερώθηκε ταυτόχρονα. Δοκίμασε ξανά.',409);
   }else{
    await Daily.create([{campaignId:campaign._id,day,limitNanos:newLimit,
     spentNanos:0,reservedNanos:0}],{session});
   }
   await Change.create([{campaignId:campaign._id,agencyId:campaign.agencyId,
    changedBy:agencyId,day,oldDailyBudgetCents:campaign.dailyBudgetCents,
    newDailyBudgetCents:next,spentNanos:spent,reservedNanos:reserved}],{session});
   result={changed:true,day,dailyBudgetCents:next,spentNanos:spent,
    reservedNanos:reserved,availableNanos:availableAt(spent,reserved,newLimit)};
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},
   readPreference:'primary',maxCommitTimeMS:10000});
  return result;
 }catch(e){
  if(e.status)throw e;
  if(e.code===11000||e.hasErrorLabel?.('TransientTransactionError')||
     e.codeName==='WriteConflict')
   throw error('Το ημερήσιο όριο ενημερώθηκε ταυτόχρονα. Ανανέωσε και ξαναδοκίμασε.',409);
  throw e;
 }finally{await session.endSession();}
}
module.exports={validateDailyChange,getDailyBudget,changeDailyBudget,availableAt};
