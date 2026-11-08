// Central client-side safety gate: music-service links only for credible
// Artist - Title metadata. Native/AI titles open a catalogue SEARCH, never
// an asserted direct track match. A validated Spotify ID may link directly.
const radioText=/(?:\bdj[\s_-]*zone\b|\bradio[\s_-]*show\b|\bmix[\s_-]*show\b|\blive[\s_-]*dj\b|\bon[\s_-]*air\b|\bdj\s*set\b|\bdjset\b|\blive\s*(?:show|set|session|mix|radio|stream|broadcast)\b|\bon\s*air\b|\bradio\s*show\b|\btalk\s*show\b|\bnon[-\s]?stop\s*(?:music|mix)\b|\bpodcast\b|\bplaylist\b|\b(?:mix|set)\s*(?:live|\d{1,2}[:.]\d{2})\b|εκπομπ[ήη]|δελτ[ιί]ο\s*ειδ[ήη]σεων|ραδι[όο]φωνο|στον\s*α[έε]ρα)/i;
const standaloneNoise=/^(?:radio|station|web radio|live|live now|on air|now playing|playing now|unknown|music|streaming|dj|news|talk|μουσική|δελτίο|παίζει τώρα|διαφήμιση|αναζήτηση|σύνδεση)$/i;
const norm=value=>String(value||'').toLocaleLowerCase('el').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
export const parseMusicMetadata = (value,stationName='') => {
  if(typeof value!=='string'||value.length>300)return null;
  const raw=value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  const match=raw.match(/^(.{1,150}?)\s+[-–—]\s+(.{1,150})$/);
  if(!match)return null;
  const artist=match[1].trim(),title=match[2].trim();
  if(!artist||!title||standaloneNoise.test(artist)||standaloneNoise.test(title)||
     radioText.test(artist)||radioText.test(title))return null;
  const station=norm(stationName);
  if(station.length>=5&&(norm(artist)===station||norm(title)===station))return null;
  if(/^\d{1,2}[.:]\d{2}$/.test(artist)||/^\d{1,2}[.:]\d{2}$/.test(title))return null;
  return {artist,title,raw:artist+' - '+title};
};
export const spotifySongLink=(raw,stationName='')=>{
  const song=parseMusicMetadata(raw,stationName);
  return song?'https://open.spotify.com/search/'+encodeURIComponent(song.raw):null;
};

// Apple Music catalogue search: available without API credentials, an account
// connection, or an unsupported claim of an exact track match.
export const appleMusicSongLink=(raw,stationName='')=>{
  const song=parseMusicMetadata(raw,stationName);
  return song?'https://music.apple.com/gr/search?term='+encodeURIComponent(song.artist+' '+song.title):null;
};
