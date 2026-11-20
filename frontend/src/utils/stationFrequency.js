/**
 * Normalize the way an FM frequency is shown without modifying station data.
 * Legacy data may already include "FM", sometimes more than once.
 */
export function formatFMFrequency(raw) {
  const value=String(raw??'').trim();
  if(!value)return '';
  const withoutFM=value.replace(/fm/gi,' ').replace(/\s+/g,' ').trim();
  return withoutFM ? `${withoutFM} FM` : 'FM';
}
export function formatStationTransmission(station) {
  if(station?.transmissionType==='Επίγειο' && station.frequency) {
    return formatFMFrequency(station.frequency);
  }
  return station?.transmissionType || 'Web Radio';
}
