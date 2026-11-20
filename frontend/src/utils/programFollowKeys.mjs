// Keep this algorithm identical to backend/utils/programFollows.js.
// A show belongs to one station; a DJ can be followed across stations.
export const normalizeFollowLabel = value => String(value || '')
  .trim().toLocaleLowerCase('el-GR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function programFollowKey(kind, stationId, label) {
  const normalized = normalizeFollowLabel(label);
  if (!normalized || normalized.length > 150) return null;
  if (kind === 'show' && stationId) return 'show:' + String(stationId) + ':' + normalized;
  if (kind === 'dj') return 'dj:' + normalized;
  return null;
}

export const findProgramFollow = (follows, kind, stationId, label) => {
  const key = programFollowKey(kind, stationId, label);
  return key ? (follows || []).find(follow => follow.key === key) : undefined;
};
