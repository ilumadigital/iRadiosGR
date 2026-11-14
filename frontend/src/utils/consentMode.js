// Google Consent Mode v2: the default 'denied' state and stored-choice replay
// are initialized synchronously in index.html BEFORE any Google tags load.
export const CONSENT_COOKIE = 'iradios_consent_v2';
const AGE_SECONDS = 60 * 60 * 24 * 180;

export function readConsent() {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find(value => value.startsWith(CONSENT_COOKIE + '='));
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1)));
    if (value?.version !== 2 ||
        typeof value.analytics !== 'boolean' ||
        typeof value.ads !== 'boolean' ||
        typeof value.personalization !== 'boolean') return null;
    return {
      analytics: value.analytics,
      ads: value.ads,
      personalization: value.ads && value.personalization
    };
  } catch { return null; }
}

export function updateConsent(settings) {
  const payload = {
    analytics_storage: settings.analytics ? 'granted' : 'denied',
    ad_storage: settings.ads ? 'granted' : 'denied',
    ad_user_data: settings.ads ? 'granted' : 'denied',
    ad_personalization: settings.ads && settings.personalization ? 'granted' : 'denied'
  };
  if (typeof window !== 'undefined') {
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', payload);
    // First-party integrations may listen without creating marketing cookies
    // before authorization. This event conveys choices, not permission to ignore them.
    window.dispatchEvent(new CustomEvent('iradios:consent-changed', { detail: payload }));
  }
  return payload;
}

export function saveConsent(settings) {
  const choices = {
    version: 2, analytics: Boolean(settings.analytics), ads: Boolean(settings.ads),
    personalization: Boolean(settings.ads && settings.personalization),
    savedAt: new Date().toISOString()
  };
  document.cookie = CONSENT_COOKIE + '=' + encodeURIComponent(JSON.stringify(choices)) +
    '; Max-Age=' + AGE_SECONDS + '; Path=/; SameSite=Lax' +
    (location.protocol === 'https:' ? '; Secure' : '');
  updateConsent(choices);
  return choices;
}
