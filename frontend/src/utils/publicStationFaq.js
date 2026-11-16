// Public FAQ always comes from the approved-station SEO projection.
// Never load the authenticated /api/stations/:id/playlist history for crawlers.
export function normalizePublicStationFaq(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    const q = typeof item?.q === 'string' ? item.q.trim() : '';
    const a = typeof item?.a === 'string' ? item.a.trim() : '';
    if (!q || !a || q.length > 250 || a.length > 1000 ||
        seen.has(q.toLocaleLowerCase('el-GR'))) return false;
    seen.add(q.toLocaleLowerCase('el-GR'));
    return true;
  }).slice(0,5).map(item => ({q:item.q.trim(),a:item.a.trim()}));
}

export function faqFromJsonLd(schema, expectedUrl) {
  if (!schema || !Array.isArray(schema['@graph'])) return [];
  const webpage = schema['@graph'].find(node => node?.['@type'] === 'WebPage');
  if (!webpage || webpage.url !== expectedUrl) return [];
  const faq = schema['@graph'].find(node => node?.['@type'] === 'FAQPage');
  const items = Array.isArray(faq?.mainEntity) ? faq.mainEntity.map(item => ({
    q:item.name,
    a:item.acceptedAnswer?.text
  })) : [];
  return normalizePublicStationFaq(items);
}

export function readInitialPublicStationFaq(expectedUrl, documentRef) {
  if (!documentRef || !expectedUrl) return [];
  for (const tag of documentRef.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const items = faqFromJsonLd(JSON.parse(tag.textContent), expectedUrl);
      if (items.length) return items;
    } catch { /* Ignore unrelated or invalid schema tags. */ }
  }
  return [];
}
