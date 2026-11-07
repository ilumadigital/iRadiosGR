// Staging compatibility layer for legacy React pages: many older admin pages
// call fetch('/api/...') without forwarding the login JWT.
// Apply token ONLY to same-origin API requests, never to radio hosts or third parties.
// Source control contains no token/secret; reads existing login token at call time.
export function installStageApiAuth() {
  if (typeof window === 'undefined' ||
      window.location.hostname !== 'stage.iradios.gr') return;
  if (window.__iradiosStageFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (resource, init) => {
    try {
      const raw = typeof resource === 'string' || resource instanceof URL
        ? String(resource) : resource.url;
      const target = new URL(raw, window.location.origin);
      const jwt = window.localStorage.getItem('iluma_token');
      if (target.origin !== window.location.origin ||
          !target.pathname.startsWith('/api/') ||
          !jwt) return nativeFetch(resource,init);

      const headers = new Headers(init?.headers || (resource instanceof Request
        ? resource.headers : undefined));
      if (!headers.has('Authorization'))
        headers.set('Authorization','Bearer ' + jwt);

      if (resource instanceof Request) {
        return nativeFetch(new Request(resource,{...init,headers}));
      }
      return nativeFetch(resource,{...init,headers});
    } catch {
      return nativeFetch(resource,init);
    }
  };
  window.__iradiosStageFetchInstalled = true;
}
