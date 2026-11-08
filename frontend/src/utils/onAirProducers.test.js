import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnAirProducers } from './onAirProducers.js';

const station = (id, endTime, overrides = {}) => ({
  _id: id,
  name: id,
  status: 'approved',
  isOffline: false,
  stream: 'https://radio.example/stream',
  logo: 'https://radio.example/logo.png',
  scheduleDayBase: 1,
  schedule: [{ day: 1, startTime: '18:00', endTime, host: 'DJ ' + id, title: 'Evening show', imageUrl: '' }],
  ...overrides
});

test('active producers are ordered by earliest end, not station position', () => {
  const result = getOnAirProducers([
    station('Ends at nine', '21:00', { position: 1 }),
    station('Ends at seven', '19:00', { position: 100 }),
    station('Ends at eight', '20:00', { position: 2 })
  ], { day: 1, minute: 18 * 60 + 9 });
  assert.deepEqual(result.map(({station: s}) => s.name), ['Ends at seven', 'Ends at eight', 'Ends at nine']);
  assert.deepEqual(result.map(x => x.endsInMinutes), [51, 111, 171]);
});

test('programme end is exclusive and a title is shown if producer field is empty', () => {
  const noHost = station('Automatic', '20:00', {
    schedule: [{ day: 1, startTime: '18:00', endTime: '20:00', title: 'Music', host: '' }]
  });
  const result = getOnAirProducers([station('Ended', '19:00'), noHost],
    { day: 1, minute: 19 * 60 });
  assert.deepEqual(result.map(x => x.station.name), ['Automatic']);
  assert.equal(result[0].host, 'Music');
  assert.equal(result[0].endsInMinutes, 60);
});

test('offline and unapproved stations never become playable on-air cards', () => {
  const result = getOnAirProducers([
    station('Offline', '20:00', { isOffline: true }),
    station('Pending', '20:00', { status: 'pending' }),
    station('Online', '20:00')
  ], { day: 1, minute: 18 * 60 + 9 });
  assert.deepEqual(result.map(x => x.station.name), ['Online']);
});

test('legacy Monday 0 and a normalized programme after midnight are supported', () => {
  const legacy = station('Legacy', '19:00', {
    scheduleDayBase: 0,
    schedule: [{ day: 0, startTime: '18:00', endTime: '19:00', title: 'Show', host: 'DJ Legacy' }]
  });
  const afterMidnight = station('Night', '01:00', {
    schedule: [{ day: 2, startTime: '00:00', endTime: '01:00', title: 'Night', host: 'DJ Night' }]
  });
  assert.equal(getOnAirProducers([legacy], { day: 1, minute: 18 * 60 + 9 }).length, 1);
  assert.equal(getOnAirProducers([afterMidnight], { day: 2, minute: 15 }).length, 1);
});

test('photo from programme is preferred and logo is the fallback', () => {
  const photo = 'https://images.example.com/producer.jpg';
  const withPhoto = station('Photo', '20:00', {
    schedule: [{ day: 1, startTime: '18:00', endTime: '20:00', title: 'Show', host: 'DJ Photo', imageUrl: photo }]
  });
  const result = getOnAirProducers([station('Logo', '19:00'), withPhoto],
    { day: 1, minute: 18 * 60 + 9 });
  // A later-ending show with a real programme photo outranks an earlier
  // show with logo fallback.
  assert.equal(result[0].station.name, 'Photo');
  assert.equal(result[0].backgroundUrl, photo);
  assert.equal(result[0].hasProducerPhoto, true);
  assert.equal(result[1].station.name, 'Logo');
  assert.equal(result[1].backgroundUrl, result[1].station.logo);
  assert.equal(result[1].hasProducerPhoto, false);
});

test('24:00 is displayed as 00:00 and sorted by remaining minutes', () => {
  const result = getOnAirProducers([station('Midnight', '24:00', {
    schedule: [{ day: 1, startTime: '22:00', endTime: '24:00', title: 'Late', host: 'Night DJ' }]
  })], { day: 1, minute: 23 * 60 + 59 });
  assert.equal(result[0].endLabel, '00:00');
  assert.equal(result[0].endsInMinutes, 1);
});

test('within photo and logo groups, programmes ending soonest come first', () => {
  const withPhoto = (id, end) => station(id, end, {
    schedule: [{ day: 1, startTime: '18:00', endTime: end, title: 'Show', host: 'DJ ' + id, imageUrl: 'https://images.example.com/' + id + '.jpg' }]
  });
  const result = getOnAirProducers([
    station('Logo seven', '19:00'),
    withPhoto('Photo nine', '21:00'),
    station('Logo eight', '20:00'),
    withPhoto('Photo eight', '20:00')
  ], { day: 1, minute: 18 * 60 + 9 });
  assert.deepEqual(result.map(x => x.station.name),
    ['Photo eight', 'Photo nine', 'Logo seven', 'Logo eight']);
});

test('Deseo-like show with photo and no producer survives a 24-hour placeholder', () => {
  const deseo = station('Deseo Radio', '23:59', {
    schedule: [
      { day: 1, startTime: '00:00', endTime: '23:59', title: 'Music 24/7', host: '', imageUrl: '' },
      { day: 1, startTime: '18:00', endTime: '19:00', title: 'DJ Show', host: '', imageUrl: 'https://images.example.com/deseo-dj.jpg' }
    ]
  });
  const result = getOnAirProducers([station('Early without photo', '18:50'), deseo],
    { day: 1, minute: 18 * 60 + 9 });
  assert.equal(result[0].station.name, 'Deseo Radio');
  assert.equal(result[0].host, 'DJ Show');
  assert.equal(result[0].endLabel, '19:00');
  assert.equal(result[0].hasProducerPhoto, true);
});

test('photo first, then nearest ending show without photo, finally continuous programmes', () => {
  const photo = station('Photo Show', '21:00', {
    schedule: [{ day: 1, startTime: '18:00', endTime: '21:00', title: 'Photo', imageUrl: '/uploads/programme/photo.jpg' }]
  });
  const allDay = station('24-hour radio', '23:59', {
    schedule: [{ day: 1, startTime: '00:00', endTime: '23:59', title: 'Best Music', host: '' }]
  });
  const result = getOnAirProducers([
    allDay, station('No photo late', '22:00'), photo, station('No photo soon', '19:00')
  ], { day: 1, minute: 18 * 60 + 9 });
  assert.deepEqual(result.map(x => x.station.name),
    ['Photo Show', 'No photo soon', 'No photo late', '24-hour radio']);
  assert.equal(result[0].backgroundUrl, '/uploads/programme/photo.jpg');
});

test('overnight scheduled shows work before and after midnight', () => {
  const night = station('Night', '02:00', {
    schedule: [{ day: 7, startTime: '22:00', endTime: '02:00', title: 'Night DJ', host: 'DJ Night', imageUrl: '' }]
  });
  assert.equal(getOnAirProducers([night], { day: 7, minute: 23 * 60 })[0].endsInMinutes, 180);
  assert.equal(getOnAirProducers([night], { day: 1, minute: 30 })[0].endsInMinutes, 90);
});
