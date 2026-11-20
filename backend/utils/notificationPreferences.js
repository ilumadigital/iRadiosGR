'use strict';

// A single contract for the Profile API and all email/push delivery paths.
// Functional notifications are enabled by default; marketing needs explicit
// consent in Greece even if another preference is on.
const TOPICS = Object.freeze(['newStations', 'favoriteSchedule', 'shows', 'news', 'promotions']);
const DEFAULT_TOPICS = Object.freeze({
  newStations: true,
  favoriteSchedule: true,
  shows: true,
  news: true,
  promotions: false
});
const DEFAULTS = Object.freeze({push: true, email: true, topics: DEFAULT_TOPICS});

function notificationPreferencesOf(user) {
  const prefs = user?.notificationPreferences || {};
  const topics = prefs.topics || {};
  return {
    push: Boolean((user?.pushNotifications === false) ? false : prefs.push !== false),
    email: prefs.email !== false,
    topics: Object.fromEntries(TOPICS.map(topic => [topic,
      topic === 'promotions' ? (topics.promotions === true && Boolean(prefs.marketingConsentAt)) : topics[topic] !== false])),
    newsCategories: Array.isArray(prefs.newsCategories) ? prefs.newsCategories.filter(s=>typeof s==='string') : [],
    marketingConsentAt: prefs.marketingConsentAt || null
  };
}

function canNotify(user, channel, topic) {
  if (!TOPICS.includes(topic) || !['push', 'email'].includes(channel)) return false;
  const prefs = notificationPreferencesOf(user);
  return prefs[channel] && prefs.topics[topic];
}

function validateChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.some(key => !['channel', 'topic', 'enabled', 'newsCategories'].includes(key))) return null;
  if (Array.isArray(body.newsCategories) && keys.length === 1 && body.newsCategories.length <= 12 &&
      body.newsCategories.every(v => typeof v === 'string' && v.length <= 50 && v.trim() && !/[<>$]/.test(v))) {
    return {path:'notificationPreferences.newsCategories',newsCategories:[...new Set(body.newsCategories)]};
  }
  if (typeof body.enabled !== 'boolean') return null;
  if (typeof body.channel === 'string' && ['push', 'email'].includes(body.channel)
      && body.topic === undefined && keys.length === 2) {
    return {path: 'notificationPreferences.' + body.channel, enabled: body.enabled, channel: body.channel};
  }
  if (typeof body.topic === 'string' && TOPICS.includes(body.topic)
      && body.channel === undefined && keys.length === 2) {
    return {path: 'notificationPreferences.topics.' + body.topic, enabled: body.enabled, topic: body.topic};
  }
  return null;
}

module.exports = {TOPICS, DEFAULTS, notificationPreferencesOf, canNotify, validateChange};
