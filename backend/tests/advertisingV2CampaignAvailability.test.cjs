'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const availability=require('../services/advertisingV2CampaignAvailability');
const policy=require('../services/advertisingV2Policy');
const liveAudio={status:'active',isStageCreative:true,mediaReady:true,
 frequencies:['entry']};
const paidLot={remainingNanos:20_000_000_000,reservedNanos:0};
test('First Play stops showing as payable when daily EUR 2 cap has only EUR 1.64 left',()=>{
 const capacity=availability.analyzeAvailability({audios:[liveAudio],
  eligibleLots:[paidLot],dayAvailableNanos:1_640_000_000});
 assert.equal(policy.eventReserveNanos('audio','entry'),1_810_000_000);
 assert.equal(capacity.minimumReservationNanos,1_810_000_000);
 assert.equal(capacity.hasEligibleCreative,true);
 assert.equal(capacity.walletCapable,true);
 assert.equal(capacity.dayCapable,false);
 assert.equal(capacity.nextTicketAffordable,false);
 assert.equal(capacity.dayShortfallNanos,170_000_000);
});
test('raising daily cap to EUR 5 makes a whole First Play ticket affordable',()=>{
 const capacity=availability.analyzeAvailability({audios:[liveAudio],
  eligibleLots:[paidLot],dayAvailableNanos:4_640_000_000});
 assert.equal(capacity.nextTicketAffordable,true);
 assert.equal(capacity.slots[0].ready,true);
});
test('readiness respects a single indivisible lot, media and visual placements',()=>{
 const noLot=availability.analyzeAvailability({audios:[liveAudio],
  eligibleLots:[{remainingNanos:1_000_000_000},{remainingNanos:1_000_000_000}],
  dayAvailableNanos:10_000_000_000});
 assert.equal(noLot.nextTicketAffordable,false);
 const missingMedia=availability.analyzeAvailability({audios:[{...liveAudio,mediaReady:false}],
  eligibleLots:[paidLot],dayAvailableNanos:10_000_000_000});
 assert.equal(missingMedia.hasEligibleCreative,false);
 const visual=availability.analyzeAvailability({banners:[{status:'active',isStageCreative:true,
  isActive:true,imageUrl:'/media/visuals/example.webp',placement:['hero','home']}],
  eligibleLots:[{remainingNanos:10_000_000,reservedNanos:0}],
  dayAvailableNanos:40_000_000});
 assert.equal(visual.slots.length,2);
 assert.equal(visual.slots[0].requiredNanos,4_000_000);
 assert.equal(visual.nextTicketAffordable,true);
});
test('pending and unapproved creatives cannot make a campaign appear ready',()=>{
 const candidate=availability.analyzeAvailability({audios:[
  {...liveAudio,status:'pending'}, {...liveAudio,isStageCreative:false}
 ],banners:[{status:'active',isStageCreative:true,isActive:false,
  imageUrl:'url',placement:['home']}],
 eligibleLots:[paidLot],dayAvailableNanos:10_000_000_000});
 assert.equal(candidate.slots.length,0);
});
