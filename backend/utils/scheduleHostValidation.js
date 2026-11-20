'use strict';
// Keep this rule aligned with frontend/src/utils/scheduleHostValidation.js.
// Compare complete station-name words, accent/case/punctuation-insensitively.
const words = value => String(value || '')
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase('el')
  .replace(/ς/g, 'σ')
  .match(/[\p{L}\p{N}]+/gu) || [];

function stationNameHostConflict(host, stationName) {
  const stationWords = new Set(words(stationName));
  if (!stationWords.size) return null;
  return words(host).find(word => stationWords.has(word)) || null;
}

module.exports = { stationNameHostConflict };
