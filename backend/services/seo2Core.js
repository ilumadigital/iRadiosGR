'use strict';
// SEO 2.0: shared, deterministic source for public page metadata and structured data.
// All facts come from approved station records; paid/private playlist data is never read.
const crypto = require('node:crypto');
const ORIGIN = (process.env.FRONTEND_URL || '__IRADIOS_SITE_ORIGIN__').replace(/\/+$/, '');
const DAYS = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const pick = (s, max = 4000) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const escapeHtml = value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeXml = escapeHtml;
const short = (value, limit = 158) => {
  const input = pick(value, 4000);
  if (input.length <= limit) return input;
  const part = input.slice(0, limit + 1);
  const end = part.lastIndexOf(' ');
  return (end > limit * .65 ? part.slice(0, end) : part.slice(0, limit)).trimEnd() + '…';
};
const origin = () => ORIGIN;
const urlFor = path => ORIGIN + path;
const stationId = st => encodeURIComponent(String(st.slug || st._id || ''));
const stationUrl = st => urlFor('/station/' + stationId(st));
const isApproved = st => st && st.status === 'approved';
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
const links = st => [st.website, st.facebook, st.instagram, st.twitter, st.tiktok].filter(value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}).slice(0, 5);
function normalizedSchedule(st) {
  const data = Array.isArray(st.schedule) ? st.schedule : [];
  const base = st.scheduleDayBase === 0 || st.scheduleDayBase === 1 ? st.scheduleDayBase :
    data.some(x => Number(x.day) === 0) ? 0 : data.some(x => Number(x.day) === 7) ? 1 : 0;
  return data.filter(x => x && pick(x.title, 130) && TIME.test(x.startTime) &&
      (TIME.test(x.endTime) || x.endTime === '24:00'))
    .map(x => ({ day: Number(x.day) + (base === 0 ? 1 : 0), startTime: x.startTime,
      endTime: x.endTime, title: pick(x.title, 130), host: pick(x.host, 100),
      description: pick(x.description, 600) }))
    .filter(x => Number.isInteger(x.day) && x.day >= 1 && x.day <= 7)
    .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
    .slice(0, 160);
}
function athensDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Athens',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const at = key => parts.find(p => p.type === key)?.value || '';
  return at('year') + '-' + at('month') + '-' + at('day');
}
function localDatePlus(dateString, days) {
  const base = new Date(dateString + 'T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
function athensOffset(localDate) {
  // Noon avoids a DST edge at 03:00; event times are local programme times.
  const reference = new Date(localDate + 'T12:00:00Z');
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Athens', timeZoneName: 'shortOffset'
  }).formatToParts(reference).find(p => p.type === 'timeZoneName')?.value || 'GMT+2';
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return match ? match[1] + match[2].padStart(2, '0') + ':' + (match[3] || '00') : '+02:00';
}
function upcomingEvents(st, now = new Date()) {
  const schedule = normalizedSchedule(st);
  const localToday = athensDate(now);
  const weekday = ((new Date(localToday + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;
  const list = [];
  for (let ahead = 0; ahead < 7; ahead++) {
    const day = ((weekday - 1 + ahead) % 7) + 1;
    const date = localDatePlus(localToday, ahead);
    for (const entry of schedule.filter(x => x.day === day)) {
      const endsTomorrow = entry.endTime === '24:00' || entry.endTime <= entry.startTime;
      const endDate = endsTomorrow ? localDatePlus(date, 1) : date;
      list.push({
        '@type': 'BroadcastEvent',
        name: entry.title,
        ...(entry.description ? {description: entry.description} :
          entry.host ? {description: 'Εκπομπή με ' + entry.host} : {}),
        startDate: date + 'T' + entry.startTime + ':00' + athensOffset(date),
        endDate: endDate + 'T' + (entry.endTime === '24:00' ? '00:00' : entry.endTime) +
          ':00' + athensOffset(endDate),
        eventStatus: 'https://schema.org/EventScheduled'
      });
      if (list.length >= 8) return list;
    }
  }
  return list;
}
function stationFaq(st) {
  const name = pick(st.name, 100);
  const faq = [{q:'Πού μπορώ να ακούσω τον ' + name + ';',
    a:'Μπορείτε να ακούσετε τον ' + name + ' ζωντανά μέσα από τη σελίδα του στο iRadios.'}];
  if (st.city) faq.push({q:'Από πού εκπέμπει ο ' + name + ';',
    a:'Η δηλωμένη πόλη του σταθμού είναι ' + pick(st.city, 90) +
      (st.region ? ', ' + pick(st.region, 90) : '') + '.'});
  const shows = normalizedSchedule(st);
  if (shows.length) faq.push({q:'Πού θα βρω το πρόγραμμα του ' + name + ';',
    a:'Το καταχωρισμένο πρόγραμμα εκπομπών εμφανίζεται στο προφίλ του σταθμού. Οι ώρες είναι Ελλάδας.'});
  const hosted = shows.find(show => show.host);
  if (hosted) faq.push({q:'Ποιος παρουσιάζει την εκπομπή ' + hosted.title + ';',
    a:'Στο δημοσιευμένο πρόγραμμα του σταθμού αναφέρεται ο/η ' + hosted.host + '.'});
  return faq;
}
// A concise description assembled exclusively from public broadcaster profile facts.
// Keep actual editorial copy first, adding relevant programme/category/location facts
// only when they are not already present. Never consume protected playlist history.
function stationSummary(st, schedule = normalizedSchedule(st)) {
  const name = pick(st.name, 100) || 'Ραδιοφωνικός σταθμός';
  const source = pick(st.description, 4000) || pick(st.slogan, 400) ||
    'Άκου ζωντανά τον ' + name + ' στο iRadios.';
  const existing = source.toLocaleLowerCase('el-GR');
  const facts = [];
  const show = schedule.find(entry => entry.title);
  if (show && !existing.includes(show.title.toLocaleLowerCase('el-GR')))
    facts.push('Εκπομπή: ' + show.title);
  const genre = pick(st.genre, 90);
  if (genre && !existing.includes(genre.toLocaleLowerCase('el-GR'))) facts.push(genre);
  const place = pick(st.city || st.region, 90);
  if (place && !existing.includes(place.toLocaleLowerCase('el-GR'))) facts.push('από ' + place);
  const extra = short(facts.join(' · '), 78);
  const lead = short(source, extra ? 155 - extra.length : 158);
  return short(lead + (extra ? ' · ' + extra : ''), 158);
}
function stationSeo(st) {
  const name = pick(st.name, 100) || 'Ραδιοφωνικός σταθμός';
  const freq = st.transmissionType === 'Επίγειο' && pick(st.frequency, 24) ?
    ' ' + pick(st.frequency, 24) : '';
  const genre = pick(st.genre, 90);
  const genres = [...new Set([st.genre, st.secondaryGenre,
    ...(Array.isArray(st.secondaryGenres) ? st.secondaryGenres : [])]
    .map(value => pick(value, 90)).filter(Boolean))];
  const location = pick(st.city || st.region || '', 90);
  const schedule = normalizedSchedule(st);
  const title = short(name + freq + ' — Άκου ζωντανά | iRadios', 75);
  const description = stationSummary(st, schedule);
  const url = stationUrl(st);
  const version = hash([st.name, st.slogan, st.description, st.genre, st.secondaryGenre,
    st.secondaryGenres, st.city, st.region, st.cover, st.logo, st.frequency,
    st.transmissionType, st.schedule, st.scheduleDayBase]);
  const image = urlFor('/og-image/' + stationId(st) + '.png?v=' + version);
  const faq = stationFaq(st);
  const nodes = [
    {'@type':'WebPage','@id':url + '#webpage',url,name:title,description,
      inLanguage:'el-GR',isPartOf:{'@id':urlFor('/#website')},about:{'@id':url + '#station'}},
    {'@type':'RadioStation','@id':url + '#station',name,url,description,image,
      ...(genres.length ? {genre: genres.length === 1 ? genres[0] : genres} : {}),
      ...(freq ? {broadcastFrequency:pick(st.frequency, 24)} : {}),
      ...(pick(st.slogan, 140) ? {slogan:pick(st.slogan, 140)} : {}),
      ...(links(st).length ? {sameAs:links(st)} : {}),
      ...(location ? {address:{'@type':'PostalAddress',addressLocality:location,
        ...(st.region ? {addressRegion:pick(st.region, 90)} : {}),
        addressCountry:pick(st.country, 70) || 'Ελλάδα'}} : {})},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'iRadios',item:urlFor('/')},
      {'@type':'ListItem',position:2,name,item:url}
    ]},
    {'@type':'FAQPage',mainEntity:faq.map(item=>({
      '@type':'Question',name:item.q,acceptedAnswer:{'@type':'Answer',text:item.a}
    }))}
  ];
  if (schedule.length) nodes.push({'@type':'BroadcastService','@id':url + '#broadcast-service',
    name:'Πρόγραμμα ' + name,broadcaster:{'@id':url + '#station'},
    hasBroadcastChannel:{'@type':'BroadcastChannel',broadcastServiceTier:'Internet'}});
  nodes.push(...upcomingEvents(st));
  return {title,description,h1:name + (freq ? freq : ''),url,image,genre,location,
    version,schedule,faq,ld:{'@context':'https://schema.org','@graph':nodes}};
}
function directorySeo({type, name, stations}) {
  const cleaned = pick(name, 120);
  const scope = type === 'genre' ? 'ραδιόφωνα' : 'ραδιόφωνα περιοχής';
  const path = type === 'genre' ? '/genre/' : '/region/';
  const url = urlFor(path + encodeURIComponent(cleaned));
  const title = short(cleaned + ' — ' + scope + ' Live | iRadios', 75);
  const description = short('Ανακάλυψε ' + cleaned + ' ραδιοφωνικούς σταθμούς και άκου ζωντανά στο iRadios. ' +
    (stations.length ? stations.slice(0, 5).map(x => pick(x.name, 100)).join(', ') + '.' : ''), 158);
  return {title,description,url,image:urlFor('/og-image.png'),h1:cleaned + ' ραδιόφωνα',
    ld:{'@context':'https://schema.org','@graph':[
      {'@type':'CollectionPage',url,name:title,description,inLanguage:'el-GR'},
      {'@type':'ItemList',itemListElement:stations.slice(0, 100).map((st, i)=>({
        '@type':'ListItem',position:i+1,name:pick(st.name,100),url:stationUrl(st)}))}
    ]}};
}
function homeSeo(stations) {
  const title = 'iRadios — Ελληνικό ραδιόφωνο live online';
  const description = 'Άκου ζωντανά ελληνικούς και διαδικτυακούς ραδιοφωνικούς σταθμούς. Βρες μουσική, ενημέρωση και το πρόγραμμα των αγαπημένων σου σταθμών στο iRadios.';
  const url = urlFor('/');
  return {title,description,url,image:urlFor('/og-image.png'),
    h1:'Άκου ραδιόφωνο ζωντανά στο iRadios',
    ld:{'@context':'https://schema.org','@graph':[
      {'@type':'Organization','@id':url + '#organization',name:'iRadios',url},
      {'@type':'WebSite','@id':url + '#website',name:'iRadios',url,inLanguage:'el-GR',
        publisher:{'@id':url+'#organization'}},
      {'@type':'WebApplication',name:'iRadios',url,applicationCategory:'MultimediaApplication',
        operatingSystem:'Web',description},
      {'@type':'CollectionPage',url,name:title,description,
        mainEntity:{'@type':'ItemList',itemListElement:stations.slice(0,100).map((st,i)=>({
          '@type':'ListItem',position:i+1,name:pick(st.name,100),url:stationUrl(st)}))}}
    ]}};
}
module.exports = {origin,urlFor,pick,short,escapeHtml,escapeXml,stationUrl,stationId,isApproved,links,
  normalizedSchedule,upcomingEvents,stationFaq,stationSummary,stationSeo,directorySeo,homeSeo,athensDate,hash};
