import { activeStationShow, validShowImage } from './liveBroadcast.js';
import { getAthensClock, minutes } from './schedule.js';

// The home page uses the same Athens-local, legacy-aware programme matching
// as the station player. Only scheduled, named on-air producers are eligible.
export function getOnAirProducers(stations = [], clock = getAthensClock()) {
  if (!Array.isArray(stations) || !Number.isInteger(clock?.day) || !Number.isFinite(clock?.minute)) return [];

  return stations.flatMap(station => {
    if (!station?._id || (station.status && station.status !== 'approved') ||
        station.isOffline === true || !station.stream) return [];

    const show = activeStationShow(station, clock);
    const host = typeof show?.host === 'string' ? show.host.trim() : '';
    if (!host) return [];

    const endMinute = minutes(show.endTime, true);
    const endsInMinutes = endMinute - clock.minute;
    if (!Number.isFinite(endsInMinutes) || endsInMinutes <= 0) return [];

    return [{
      station,
      show,
      host,
      endsInMinutes,
      endLabel: show.endTime === '24:00' ? '00:00' : show.endTime,
      backgroundUrl: validShowImage(show.imageUrl) ? show.imageUrl : station.logo,
      hasProducerPhoto: validShowImage(show.imageUrl)
    }];
  }).sort((a, b) =>
    a.endsInMinutes - b.endsInMinutes ||
    a.station.name.localeCompare(b.station.name, 'el') ||
    a.host.localeCompare(b.host, 'el')
  );
}
