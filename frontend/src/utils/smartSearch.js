import { PRIMARY_CATEGORIES, SECONDARY_CATEGORIES } from './stationCategories.js';

export const SEARCH_TYPES = [
  { id: 'all', label: 'Όλα' },
  { id: 'station', label: 'Σταθμοί' },
  { id: 'region', label: 'Περιοχές' },
  { id: 'genre', label: 'Είδη' },
  { id: 'news', label: 'Ειδήσεις' }
];

export const normalizeSearch = value => String(value ?? '')
  .toLocaleLowerCase('el-GR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const greeklish = value => normalizeSearch(value)
  .replace(/ου/g, 'ou').replace(/αι/g, 'ai').replace(/ει/g, 'ei')
  .replace(/οι/g, 'oi').replace(/γγ/g, 'ng').replace(/γκ/g, 'gk')
  .replace(/θ/g, 'th').replace(/χ/g, 'ch').replace(/ψ/g, 'ps')
  .replace(/α/g, 'a').replace(/β/g, 'v').replace(/γ/g, 'g')
  .replace(/δ/g, 'd').replace(/ε/g, 'e').replace(/ζ/g, 'z')
  .replace(/η/g, 'i').replace(/ι/g, 'i').replace(/κ/g, 'k')
  .replace(/λ/g, 'l').replace(/μ/g, 'm').replace(/ν/g, 'n')
  .replace(/ξ/g, 'x').replace(/ο/g, 'o').replace(/π/g, 'p')
  .replace(/ρ/g, 'r').replace(/σ/g, 's').replace(/τ/g, 't')
  .replace(/υ/g, 'y').replace(/φ/g, 'f').replace(/ω/g, 'o');

const textFields = values => values.filter(x => x !== null && x !== undefined && String(x).trim()).map(String);
const unique = values => [...new Set(textFields(values))];

export function createSearchIndex(stations = [], articles = []) {
  const eligible = Array.isArray(stations)
    ? stations.filter(s => s?._id && s.name && (!s.status || s.status === 'approved'))
    : [];
  const entries = eligible.map(s => ({
    id: 'station:' + s._id,
    type: 'station',
    label: s.name,
    subtitle: [s.genre, s.city || s.region].filter(Boolean).join(' · '),
    image: s.logo || '',
    path: '/station/' + encodeURIComponent(s.slug || s._id),
    stationId: String(s._id),
    offline: s.isOffline === true,
    aliases: unique([s.name, s.slug, s.genre, s.secondaryGenre, s.region, s.city, s.slogan,
      s.frequency, ...(Array.isArray(s.tags) ? s.tags : [])])
  }));

  const regions = new Map();
  for (const s of eligible) {
    for (const value of [s.region, s.city]) {
      if (!value || !String(value).trim()) continue;
      const key = normalizeSearch(value);
      regions.set(key, { label: String(value).trim(), count: (regions.get(key)?.count || 0) + 1 });
    }
  }
  for (const { label, count } of regions.values()) {
    entries.push({
      id: 'region:' + label, type: 'region', label,
      subtitle: count + (count === 1 ? ' σταθμός' : ' σταθμοί'),
      path: '/region/' + encodeURIComponent(label),
      aliases: unique([label, label === 'Αθήνα' ? 'athens athina' : '', label === 'Θεσσαλονίκη' ? 'thessaloniki salonica' : ''])
    });
  }

  const genres = new Map();
  for (const s of eligible) {
    for (const genre of [s.genre, s.secondaryGenre]) {
      if (!genre || !String(genre).trim()) continue;
      const key = normalizeSearch(genre);
      genres.set(key, { label: String(genre).trim(), count: (genres.get(key)?.count || 0) + 1 });
    }
  }
  const ordered = [...PRIMARY_CATEGORIES, ...SECONDARY_CATEGORIES];
  for (const { label, count } of genres.values()) {
    entries.push({
      id: 'genre:' + label, type: 'genre', label,
      subtitle: count + (count === 1 ? ' σταθμός' : ' σταθμοί'),
      path: '/genre/' + encodeURIComponent(label),
      aliases: unique([label, normalizeSearch(label) === 'ροκ' ? 'rock' : '', ordered.find(v => normalizeSearch(v) === normalizeSearch(label))])
    });
  }

  entries.push({
    id: 'news:feed', type: 'news', label: 'Όλες οι ειδήσεις',
    subtitle: 'Newsfeed iRadiosGR',
    path: '/newsfeed',
    aliases: ['ειδησεις', 'νέα', 'news', 'newsfeed', 'ενημερωση']
  });

  if (Array.isArray(articles)) {
    const seen = new Set();
    for (const article of articles) {
      if (!article?.key || !article?.title || seen.has(article.key)) continue;
      seen.add(article.key);
      entries.push({
        id: 'news:' + article.key,
        type: 'news',
        label: article.title,
        subtitle: [article.source, article.category].filter(Boolean).join(' · '),
        image: article.imageUrl || '',
        path: '/newsfeed/' + encodeURIComponent(article.key),
        aliases: unique([article.title, article.summary, article.source, article.category]),
        publishedAt: Date.parse(article.publishedAt) || 0
      });
    }
  }
  return entries;
}

const scoreItem = (item, needle) => {
  const q = normalizeSearch(needle);
  if (!q) return 0;
  const gl = greeklish(needle);
  const label = normalizeSearch(item.label);
  const labelLatin = greeklish(item.label);
  if (q === label || gl === labelLatin) return 140;
  if (label.startsWith(q) || labelLatin.startsWith(gl)) return 110;
  if (label.includes(q) || labelLatin.includes(gl)) return 82;
  let best = 0;
  for (const field of item.aliases || []) {
    const value = normalizeSearch(field);
    const latin = greeklish(field);
    if (value === q || latin === gl) best = Math.max(best, 103);
    else if (value.startsWith(q) || latin.startsWith(gl)) best = Math.max(best, 72);
    else if (value.includes(q) || latin.includes(gl)) best = Math.max(best, 52);
  }
  const parts = q.split(' ').filter(Boolean);
  const haystack = normalizeSearch([item.label, ...(item.aliases || [])].join(' '));
  const latinStack = greeklish([item.label, ...(item.aliases || [])].join(' '));
  if (parts.length > 1 && parts.every(p => haystack.includes(p) || latinStack.includes(greeklish(p)))) {
    best = Math.max(best, 44);
  }
  return best;
};

export function rankSearch(index, query, scope = 'all') {
  if (!normalizeSearch(query)) return [];
  return (Array.isArray(index) ? index : [])
    .filter(item => scope === 'all' || item.type === scope)
    .map(item => ({ ...item, score: scoreItem(item, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score
      || Number(a.offline) - Number(b.offline)
      || (a.type === 'news' && b.type === 'news' ? (b.publishedAt || 0) - (a.publishedAt || 0) : 0)
      || a.label.localeCompare(b.label, 'el'));
}

export function groupedSearch(index, query, scope = 'all') {
  const matches = rankSearch(index, query, scope);
  const groupSize = scope === 'all' ? 3 : 9;
  const groups = SEARCH_TYPES.filter(type => type.id !== 'all' && (scope === 'all' || type.id === scope))
    .map(type => ({
      ...type,
      total: matches.filter(item => item.type === type.id).length,
      items: matches.filter(item => item.type === type.id).slice(0, groupSize)
    }))
    .filter(group => group.total)
    .sort((a, b) => b.items[0].score - a.items[0].score);
  return { matches, groups, visible: groups.flatMap(group => group.items) };
}

export function spokenQuery(transcript) {
  // Normalize accents before stripping Greek voice commands.
  const phrase = normalizeSearch(transcript);
  return phrase
    .replace(/^(?:σε παρακαλω |παρακαλω )?(?:ανοιξε μου|ανοιξε|δειξε μου|δειξε|βρεσ μου|βρεσ|ψαξε|αναζητησε|βαλε|παιξε|πηγαινε με|πηγαινε|θελω να ακουσω|θελω να δω)\s+/, '')
    .replace(/^(?:την|τον|τισ|τουσ|τα|τη|το|στο|στην|σε|ενα|εναν|μια|ενασ)\s+/, '')
    .replace(/^(?:ραδιοφωνικο σταθμο|ραδιοφωνο|σταθμο)\s+/, '')
    .trim();
}

export function directVoiceMatch(index, transcript) {
  const query = spokenQuery(transcript);
  const matches = rankSearch(index, query);
  const normalized = normalizeSearch(query);
  const latin = greeklish(query);
  const equals = value => normalizeSearch(value) === normalized || greeklish(value) === latin;
  // Generic station genre/city fields must NOT steal voice navigation from the
  // actual genre/region page. Only exact destination names/known aliases count.
  const exact = matches.filter(item => {
    if (equals(item.label)) return true;
    if (item.type === 'station') return equals(item.aliases?.[1] || '');
    if (item.type === 'news' && item.id !== 'news:feed') return false;
    return (item.aliases || []).some(equals);
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // Never jump to an ambiguous destination.
  if (matches[0]?.score >= 110 && (!matches[1] || matches[0].score - matches[1].score >= 28)) return matches[0];
  return null;
}
