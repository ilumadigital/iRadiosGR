'use strict';
const mongoose = require('mongoose');
const Slide = require('../models/HomeSlide');
const Station = require('../models/Station');

// Avoid arbitrary schemes, relative redirects, userinfo or non-HTTPS external images.
const safeHttps = value => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch { return false; }
};
const safeImage = value => safeHttps(value) ||
  (typeof value === 'string' && /^\/media\/visuals\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(value));
const clean = v => typeof v === 'string' ? v.trim() : '';
function normalize(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const title = clean(body.title);
  const subtitle = clean(body.subtitle);
  const eyebrow = clean(body.eyebrow) || 'ΠΡΟΤΕΙΝΟΥΜΕ';
  const ctaLabel = clean(body.ctaLabel) || 'Ανακάλυψε';
  const imageUrl = clean(body.imageUrl);
  const legacyPlacement = body.placement || 'home';
  const legacyValue = clean(body.placementValue);
  const rawPlacements = Array.isArray(body.placements) && body.placements.length
    ? body.placements : [{placement:legacyPlacement,placementValue:legacyValue}];
  if (rawPlacements.length > 12) {
    const err=new Error('Έως 12 θέσεις προβολής ανά slide.');err.status=400;throw err;
  }
  const placements = [...new Map(rawPlacements.map(item=>{
    const placement=clean(item?.placement),placementValue=clean(item?.placementValue);
    if (!['home','genre','region','news'].includes(placement) ||
      (['genre','region'].includes(placement) && (!placementValue||placementValue.length>120))) {
      const err=new Error('Μη έγκυρη τοποθέτηση slide.');err.status=400;throw err;
    }
    const record={placement,placementValue:['home','news'].includes(placement)?'':placementValue};
    return [record.placement+':'+record.placementValue,record];
  })).values()];
  if (!placements.length){const err=new Error('Επίλεξε τουλάχιστον μία θέση προβολής.');err.status=400;throw err;}
  const {placement,placementValue}=placements[0];
  const targetType = body.targetType || 'none';
  const audience = body.audience || 'all';
  const status = body.status || 'draft';
  const genre = clean(body.genre);
  const externalUrl = clean(body.externalUrl);
  const priority = Number(body.priority ?? 0);
  if (!title || title.length > 100 || subtitle.length > 220 || eyebrow.length > 60 || ctaLabel.length > 48 ||
    !safeImage(imageUrl) || !['none','station','genre','external'].includes(targetType) ||
    !['all','guest','member','premium'].includes(audience) ||
    !['draft','published'].includes(status) ||
    !Number.isInteger(priority) || priority < 0 || priority > 1000) {
    const err = new Error('Μη έγκυρα στοιχεία slide (τίτλος, εικόνα, κατάσταση ή σειρά).'); err.status = 400; throw err;
  }
  const stationId = targetType === 'station' ? clean(body.stationId) : null;
  if (targetType === 'station' && !mongoose.isValidObjectId(stationId)) {
    const err = new Error('Επίλεξε έγκυρο σταθμό.'); err.status = 400; throw err;
  }
  if (targetType === 'genre' && (!genre || genre.length > 100)) {
    const err = new Error('Επίλεξε μουσική κατηγορία.'); err.status = 400; throw err;
  }
  if (targetType === 'external' && !safeHttps(externalUrl)) {
    const err = new Error('Ο εξωτερικός σύνδεσμος πρέπει να είναι HTTPS.'); err.status = 400; throw err;
  }
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime())) ||
      (startsAt && endsAt && endsAt <= startsAt)) {
    const err = new Error('Ελέγξτε την ημερομηνία αρχής/λήξης.'); err.status = 400; throw err;
  }
  return { title, subtitle, eyebrow, ctaLabel, imageUrl, placement, placementValue, placements, targetType,
    stationId, genre: targetType === 'genre' ? genre : '',
    externalUrl: targetType === 'external' ? externalUrl : '',
    audience, priority, status, startsAt, endsAt };
}
async function validateStation(payload) {
  if (payload.stationId && !await Station.exists({ _id: payload.stationId, status: 'approved' })) {
    const err = new Error('Ο σταθμός δεν είναι εγκεκριμένος.'); err.status = 400; throw err;
  }
}
const fail = (res,e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Σφάλμα διαχείρισης slides.' });
exports.normalize = normalize; // pure input validation for offline tests
exports.publicSlides = async (req,res) => {
  try {
    const placement = req.query.placement || 'home';
    const value = clean(req.query.value);
    const tileFeed = req.query.tiles === '1';
    if (!['home','genre','region','news'].includes(placement) ||
        (tileFeed && ['home','news'].includes(placement)) ||
        (['genre','region'].includes(placement) && (!value || value.length > 120) && !tileFeed)) {
      return res.status(400).json({error:'Μη έγκυρη τοποθέτηση editorial slide.'});
    }
    // Existing pre-placement documents remain visible on Home without a data migration.
    const legacy = placement === 'home'
      ? {$or:[{placement:'home'},{placement:{$exists:false}}]}
      : tileFeed ? {placement} : placement === 'news' ? {placement:'news'} : {placement,placementValue:value};
    const modern = tileFeed ? {'placements.placement':placement} :
      {placements:{$elemMatch:{placement,placementValue:['home','news'].includes(placement)?'':value}}};
    const scope = {$or:[legacy,modern]};
    const now = new Date();
    const slides = await Slide.find({
      ...scope,
      status: 'published',
      $and: [
        { $or: [{startsAt: null}, {startsAt: {$lte:now}}] },
        { $or: [{endsAt: null}, {endsAt: {$gt:now}}] }
      ]
    }).select('title subtitle eyebrow imageUrl ctaLabel targetType stationId genre externalUrl audience priority placement placementValue placements')
      .sort({ priority:-1, createdAt:-1 }).limit(tileFeed ? 80 : 16).lean();
    // A single CMS creative can target multiple category/region tiles. Expand
    // each configured destination instead of leaking the legacy first placement
    // into unrelated tiles. Keep the CMS priority order and audience rules.
    const tiles = tileFeed ? slides.flatMap(slide => {
      const placements = Array.isArray(slide.placements) && slide.placements.length
        ? slide.placements : [{placement:slide.placement,placementValue:slide.placementValue}];
      return placements.filter(item=>item.placement===placement && clean(item.placementValue))
        .map(item=>({...slide,placement,placementValue:item.placementValue}));
    }).slice(0,80) : slides;
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(tiles);
  } catch(e) { fail(res,e); }
};
exports.adminSlides = async (_req,res) => {
  try { res.json(await Slide.find().sort({priority:-1,createdAt:-1}).limit(200).lean()); }
  catch(e) { fail(res,e); }
};
exports.create = async (req,res) => {
  try { const payload=normalize(req.body); await validateStation(payload); res.status(201).json(await Slide.create(payload)); }
  catch(e) { fail(res,e); }
};
exports.update = async (req,res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Μη έγκυρο ID.'});
    const payload=normalize(req.body); await validateStation(payload);
    const doc=await Slide.findByIdAndUpdate(req.params.id,{$set:payload},{new:true,runValidators:true});
    if (!doc) return res.status(404).json({error:'Το slide δεν βρέθηκε.'});
    res.json(doc);
  } catch(e) { fail(res,e); }
};
exports.remove = async (req,res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Μη έγκυρο ID.'});
    const result=await Slide.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({error:'Το slide δεν βρέθηκε.'});
    // Media images are shared assets and deliberately not unlinked here.
    res.json({success:true});
  } catch(e) { fail(res,e); }
};
