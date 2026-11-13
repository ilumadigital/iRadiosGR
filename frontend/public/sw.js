const CACHE_NAME = 'iradios-pwa-v3-brand-safe'; // Άλλαξα το v1 σε v2 για να καθαρίσει η παλιά cache των χρηστών

// Όταν εγκαθίσταται το PWA
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

// Καθαρισμός παλιών caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// --- Η ΣΩΣΤΗ ΛΟΓΙΚΗ FETCH ΓΙΑ ΡΑΔΙΟΦΩΝΟ ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. ΕΞΑΙΡΕΣΕΙΣ: Μην κάνεις ΠΟΤΕ cache τα API calls, τα streams, Ή ΤΑ WIDGETS!
  if (
      url.pathname.startsWith('/api') || 
      url.pathname.startsWith('/widget') || 
      url.pathname.endsWith('widget.js') || 
      url.hostname !== location.hostname || 
      event.request.url.includes('stream')
  ) {
    return; // Αφήνουμε το request να πάει κατευθείαν στο ίντερνετ χωρίς να το πειράξει ο Service Worker
  }

  // 2. NETWORK-FIRST για τα αρχεία του App (HTML, JS, CSS)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache only valid 200 image responses; never cache a 404 or SPA
        // HTML fallback under an SVG URL (would permanently break branding).
        const contentType = response.headers.get('content-type') || '';
        const validSvg = !url.pathname.endsWith('.svg') || contentType.includes('image/svg+xml');
        if (response.ok && validSvg) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png', // Same source artwork as the browser/PWA favicon
      badge: '/favicon.png', 
      vibrate: [200, 100, 200], 
      data: {
        url: data.url || '/' 
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Όταν ο χρήστης κάνει κλικ στην ειδοποίηση
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); 
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
