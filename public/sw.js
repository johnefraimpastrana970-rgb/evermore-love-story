const CACHE_NAME = 'evermore-shell-v1';
const APP_SHELL = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const page = await fetch(APP_SHELL);
      if (!page.ok) throw new Error(`Could not cache Evermore's app shell (${page.status}).`);
      const html = await page.clone().text();
      await cache.put(APP_SHELL, page);

      const appAssets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)]
        .map((match) => new URL(match[1], APP_SHELL))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
      const iconsAndManifest = [
        './manifest.webmanifest',
        './icons/evermore-192.png',
        './icons/evermore-512.png',
      ].map((asset) => new URL(asset, APP_SHELL).href);

      await Promise.all(
        [...appAssets, ...iconsAndManifest].map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Could not cache Evermore app asset ${url} (${response.status}).`);
          await cache.put(url, response);
        }),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('evermore-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.endsWith('/downloads/evermore-android.apk')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response.ok) {
            void cache.put(request, response.clone()).catch((error) =>
              console.warn('Evermore could not cache a page for offline use.', error),
            );
          }
          return response;
        } catch {
          return (await cache.match(request)) ?? (await cache.match(APP_SHELL));
        }
      }

      const cached = await cache.match(request);
      const update = fetch(request).then((response) => {
        if (response.ok) {
          void cache.put(request, response.clone()).catch((error) =>
            console.warn('Evermore could not cache a resource for offline use.', error),
          );
        }
        return response;
      });
      if (cached) {
        void update.catch((error) => console.warn('Evermore cache refresh failed.', error));
        return cached;
      }
      return update;
    }),
  );
});
