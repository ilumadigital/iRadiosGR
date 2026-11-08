// Central client-side safety gate: Spotify and song UI only for credible
// Artist - Title metadata. An unverified native title opens Spotify SEARCH,
// not an asserted direct Spotify track link. ACR ID is the direct-link source.
const radioText=/(?:\bdj\s*set\b|\bdjset\b|\blive\s*(?:show|set|session|mix|radio|stream|broadcast)\b|\bon\s*air\b|\bradio\s*show\b|\btalk\s*show\b|\bnon[-\s]?stop\s*(?:music|mix)\b|\bpodcast\b|\bplaylist\b|\b(?:mix|set)\s*(?:live|\d{1,2}[:.]\d{2})\b|εκπομπ[ήη]|δελτ[ιί]ο\s*ειδ[ήη]σεων|ραδι[όο]φωνο|στον\s*α[έε]ρα)/i;
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
