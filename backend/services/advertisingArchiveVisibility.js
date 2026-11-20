'use strict';
// Campaign archival hides its creatives from operational dashboards without
// rewriting historical approval, impression, or financial records.
const Campaign=require('../models/AdvertisingCampaign');
async function excludeArchivedCampaignCreatives(creatives){
 if(!Array.isArray(creatives)||creatives.length===0)return creatives;
 const ids=[...new Set(creatives.map(c=>c?.campaignId).filter(Boolean).map(String))];
 if(!ids.length)return creatives;
 const deleted=await Campaign.find({_id:{$in:ids},deletedAt:{$ne:null}}).select('_id').lean();
 if(!deleted.length)return creatives;
 const excluded=new Set(deleted.map(c=>String(c._id)));
 return creatives.filter(c=>!c.campaignId||!excluded.has(String(c.campaignId)));
}
module.exports={excludeArchivedCampaignCreatives};
