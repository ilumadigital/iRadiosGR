'use strict';
// One contract for both the feed and campaign analytics. Old imported campaigns
// remain in the database but are never served on the public staging site.
const isStage = () => process.env.APP_ENV === 'staging';
const activeCampaignQuery = (now = new Date()) => ({
  status: 'active',
  expiresAt: { $not: { $lte: now } },
  ...(isStage() ? { isStageCreative: true } : {})
});
const live = (campaign, now = new Date()) => Boolean(
  campaign && campaign.status === 'active' &&
  (!campaign.expiresAt || new Date(campaign.expiresAt) > now) &&
  (!isStage() || campaign.isStageCreative === true)
);
const legacyFrequencies = {
  first_station: 'entry',
  every_2: 'every_2_stations',
  every_4: 'every_4_stations'
};
const publicAd = (doc) => {
  const object = doc.toObject ? doc.toObject() : { ...doc };
  return { ...object, frequency: legacyFrequencies[object.frequency] || object.frequency };
};
const fields = (body, whitelist) => Object.fromEntries(
  whitelist.filter(key => body?.[key] !== undefined).map(key => [key, body[key]])
);
// Avoid counting the same render or media event from concurrent UI surfaces.
// Counters here are lightweight, not a replacement for audited billing events.
const recent = new Map();
function permitMetric(req, kind, id, interval = 3000) {
  const now = Date.now();
  if (recent.size > 50000) recent.clear();
  const ip = String(req.ip || req.socket?.remoteAddress || '').slice(0, 80);
  const key = [kind, id, ip, String(req.get('user-agent') || '').slice(0, 100)].join(':');
  if ((recent.get(key) || 0) + interval > now) return false;
  recent.set(key, now);
  return true;
}
module.exports = { isStage, activeCampaignQuery, live, publicAd, fields, permitMetric };
