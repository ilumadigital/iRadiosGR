// The host field names a real person. It must not repeat the station identity.
// Compare complete words (not substrings), ignoring case, Greek accents and punctuation.
const words = value => String(value || '')
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase('el')
  .replace(/ς/g, 'σ')
  .match(/[\p{L}\p{N}]+/gu) || [];

// Returns the first conflicting word, or null. An empty producer is valid.
export function stationNameHostConflict(host, stationName) {
  const stationWords = new Set(words(stationName));
  if (!stationWords.size) return null;
  return words(host).find(word => stationWords.has(word)) || null;
}
