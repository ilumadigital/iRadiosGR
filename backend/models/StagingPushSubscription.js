const mongoose = require('mongoose');
const Subscription = require('./Subscription');

// Staging registrations are QA-only. Never read or alter the live/legacy
// subscriptions collection, even when the staging DB was imported from production.
// The notification dispatcher is hard-disabled by APP_ENV=staging.
module.exports = mongoose.models.StagingPushSubscription ||
  mongoose.model('StagingPushSubscription', Subscription.schema.clone(), 'staging_push_subscriptions');
