'use strict';
// Only an unfunded APPROVAL decision for visual Agency/Admin staging QA.
// It NEVER creates funding lots, unlocks quotes, or changes public eligibility.
// If someone later enables paid delivery, this bypass fails CLOSED.
function allowUnfundedReview(env=process.env){
 return env.APP_ENV==='staging' &&
  env.AD_STAGE_QA_APPROVAL_ENABLED==='1' &&
  env.AD_DELIVERY_BILLING_ENABLED!=='1' &&
  env.AD_PAYMENTS_SANDBOX_ENABLED!=='1';
}
module.exports={allowUnfundedReview};
