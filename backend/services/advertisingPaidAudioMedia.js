'use strict';
// Verify an already reserved and cryptographically bound paid audio capability.
// No second available-balance check: the ticket already holds the funds.
function validCampaignAt(ad,campaign,now=new Date()){
 const date=now instanceof Date?now:new Date(now);
 return Boolean(ad?._id&&ad?.agencyId&&ad?.campaignId&&campaign?._id&&campaign?.agencyId&&
  String(ad.campaignId)===String(campaign._id)&&
  String(ad.agencyId)===String(campaign.agencyId)&&
  campaign.createdByRole==='agency'&&campaign.workflowVersion===2&&
  campaign.isStageCampaign===true&&campaign.approvalStatus==='approved'&&
  campaign.agencyEnabled===true&&campaign.adminSuspended!==true&&
  !campaign.deletedAt&&Number.isFinite(date.getTime())&&
  Number.isFinite(new Date(campaign.startsAt).getTime())&&
  Number.isFinite(new Date(campaign.endsAt).getTime())&&
  new Date(campaign.startsAt)<=date&&new Date(campaign.endsAt)>date);
}
function validPaidAudioMedia({ad,campaign,ticket,capability,visitorKey,
 verifyCapability,now=Date.now()}={}){
 if(!validCampaignAt(ad,campaign,now))return false;
 if(!ticket||ticket.kind!=='audio'||ticket.status!=='active'||
  String(ticket.creativeId)!==String(ad._id)||
  String(ticket.campaignId)!==String(campaign._id)||
  typeof capability!=='string'||typeof visitorKey!=='string'||
  typeof verifyCapability!=='function')return false;
 return verifyCapability(capability,ticket,visitorKey,Number(now));
}
module.exports={validCampaignAt,validPaidAudioMedia};
