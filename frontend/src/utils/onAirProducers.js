import { validShowImage } from './liveBroadcast.js';
import { getAthensClock, minutes, nextDay, scheduleDayBase, toCanonical } from './schedule.js';

// Stations can have legacy (Monday=0), normalized (Monday=1), or overnight
// schedules. Do not use the first overlapping slot: all-day placeholders may
// coexist with a genuine show ending soon (and carrying artwork).
const imageFromProgramme = raw => {
  if (typeof raw !== 'string') return '';
  const src = raw.trim();
  if (!src || src.length > 800) return '';
  if (validShowImage(src)) return src;
  // Historical uploaded programme artwork may be stored as a same-origin path.
  if (/^\/(?!\/)[\w%./-]+(?:\?[\w%=&.-]+)?$/.test(src) &&
      !src.split('?')[0].split('/').includes('..')) return src;
  return '';
};

const activeSlots = (station, clock) => {
  const entries = station?.schedule;
  if (!Array.isArray(entries) || !entries.length) return [];
  const base = scheduleDayBase(entries, station.scheduleDayBase);
  return toCanonical(entries, base).flatMap((show, index) => {
    const start = minutes(show.startTime);
    const rawEnd = entries[index]?.endTime;
    const end = minutes(rawEnd === '24:00' ? rawEnd : show.endTime, true);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    const day = Number(show.day);
    const minute = clock.minute;
    let remaining;
    if (end > start && day === clock.day && start <= minute && minute < end)
      remaining = end - minute;
    else if (end < start) {
      if (day === clock.day && minute >= start) remaining = 1440 - minute + end;
      else if (nextDay(day) === clock.day && minute < end) remaining = end - minute;
    } else if (start === 0 && end === 0 && day === clock.day)
      remaining = 1440 - minute; // Historic 00:00–00:00 full-day entries.
    if (!Number.isFinite(remaining) || remaining <= 0) return [];

    const artwork = imageFromProgramme(show.imageUrl);
    const duration = end > start ? end - start : end < start ? 1440 - start + end : 1440;
    const isContinuous = duration >= 23 * 60 + 30;
    const host = typeof show.host === 'string' ? show.host.trim() : '';
    const title = typeof show.title === 'string' ? show.title.trim() : '';
    if (!host && !title) return [];
    return [{
      show, host: host || title, artwork, hasProducerPhoto: Boolean(artwork),
      // 0: photo, 1: scheduled show, 2: all-day radio programme/fallback.
      priority: artwork ? 0 : isContinuous ? 2 : 1,
      endsInMinutes: remaining,
      endLabel: rawEnd === '24:00' || rawEnd === '00:00' ? '00:00' : show.endTime
    }];
  });
};

export function getOnAirProducers(stations = [], clock = getAthensClock()) {
  if (!Array.isArray(stations) || !Number.isInteger(clock?.day) ||
      clock.day < 1 || clock.day > 7 ||
      !Number.isFinite(clock?.minute) || clock.minute < 0 || clock.minute >= 1440) return [];

  return stations.flatMap(station => {
    if (!station?._id || (station.status && station.status !== 'approved') ||
        station.isOffline === true || !station.stream) return [];

    // Choose the best actual active show, not the first all-day placeholder.
    const [selected] = activeSlots(station, clock).sort((a, b) =>
      a.priority - b.priority ||
      a.endsInMinutes - b.endsInMinutes ||
      Number(Boolean(b.show.host)) - Number(Boolean(a.show.host))
    );
    if (!selected) return [];

    return [{
      station, ...selected,
      backgroundUrl: selected.artwork || station.logo
    }];
  }).sort((a, b) =>
    a.priority - b.priority ||
    a.endsInMinutes - b.endsInMinutes ||
    a.station.name.localeCompare(b.station.name, 'el') ||
    a.host.localeCompare(b.host, 'el')
  );
}
