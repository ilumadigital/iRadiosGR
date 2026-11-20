import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarCampaignDays,budgetSuggestion,minimumAudioReservationNanos,maximumAudioReservationNanos,audioReservationPlacements} from './advertisingBudgetRecommendations.js';
test('proposals retain canonical 7/30/90/180/365-day prices',()=>{
 for(const [days,amount] of [[7,25000],[30,80000],[90,210000],[180,390000],[365,720000]]){
  const result=budgetSuggestion(days);
  assert.equal(result.budgetCents,amount);
  assert.equal(result.dailyCents,Math.ceil(amount/days));
 }
});
test('free-form duration is interpolated and larger than a year is supported',()=>{
 assert.ok(budgetSuggestion(20).budgetCents>25000);
 assert.ok(budgetSuggestion(20).budgetCents<80000);
 assert.ok(budgetSuggestion(730).budgetCents>=1440000);
 assert.ok(budgetSuggestion(90,'maximum').budgetCents>budgetSuggestion(90,'intense').budgetCents);
});
test('Athens calendar day counts remain stable through DST',()=>{
 assert.equal(calendarCampaignDays('2026-03-28T10:00:00+02:00','2026-03-30T10:00:00+03:00'),2);
 assert.equal(calendarCampaignDays('2026-11-01T08:00:00+02:00','2027-11-01T08:00:00+02:00'),365);
 assert.equal(calendarCampaignDays('x','2026-01-01'),0);
});
test('complete ticket reserve includes CTA and completion with exact nanos',()=>{
 assert.equal(minimumAudioReservationNanos([{frequencies:['entry','twice_a_day']}]),962000000);
 assert.equal(minimumAudioReservationNanos([{frequency:'entry'}]),1810000000);
 assert.equal(minimumAudioReservationNanos([]),0);
});

test('unaffordable placement is flagged by the most expensive full reservation',()=>{
 const creatives=[{frequencies:['entry','twice_a_day','entry']}];
 assert.equal(minimumAudioReservationNanos(creatives),962000000);
 assert.equal(maximumAudioReservationNanos(creatives),1810000000);
 assert.deepEqual(audioReservationPlacements(creatives).map(r=>r.placement),['entry','twice_a_day']);
});
