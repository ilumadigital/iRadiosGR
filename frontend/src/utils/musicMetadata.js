// Only display verifiable music metadata, never station slogans or radio status text.
// Never exposes metadata to guests; callers must also require a logged-in user.
export const parseMusicMetadata = value => {
  if (typeof value !== 'string' || value.length > 300) return null;
  const raw = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw || /^(?:live|on air|now playing|unknown|stopped|παίζει τώρα|αναζήτηση|διαφήμιση)/i.test(raw)) return null;
  const match = raw.match(/^(.{1,140}?)\s+[-–—]\s+(.{1,140})$/);
  if (!match) return null;
  const artist = match[1].trim();
  const title = match[2].trim();
  if (!artist || !title) return null;
  if (/^(?:radio|station|on air|live|unknown|playing now|now playing|μουσική|εκπομπή|ραδιόφωνο|σύνδεση)$/i.test(artist)) return null;
  if (/^(?:στον αέρα|live|live now|on air|now playing|unknown|διαφήμιση|παίζει τώρα)$/i.test(title)) return null;
  return { artist, title, raw: artist + ' - ' + title };
};
