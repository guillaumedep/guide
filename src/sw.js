// Service worker : rend l'appli utilisable hors ligne.
// VERSION, PRECACHE et IMAGES sont injectés par tools/build.mjs (ne pas modifier à la main dans dist/).
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;   // appli + données : téléchargés à l'installation
const IMAGES = __IMAGES__;       // images actuelles (noms contenant un hash du contenu)
const SHELL = 'recettes-' + VERSION;
const IMG = 'recettes-img';      // conservé d'une version à l'autre : seules les nouvelles images sont téléchargées

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })));
    // Images : on télécharge seulement celles qui manquent. Un échec ne bloque pas l'installation.
    const img = await caches.open(IMG);
    await Promise.all(IMAGES.map(async u => {
      if (await img.match(u)) return;
      try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await img.put(u, r); } catch (_) {}
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== IMG) await caches.delete(k);
    // Supprime les images qui ne sont plus utilisées.
    const img = await caches.open(IMG);
    const keep = new Set(IMAGES.map(u => new URL(u, self.registration.scope).href));
    for (const req of await img.keys()) if (!keep.has(req.url)) await img.delete(req);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await caches.open(SHELL);
      try { return await fetch(req); } catch (_) { return (await shell.match('./')) || (await shell.match('index.html')); }
    }
    const res = await fetch(req);
    if (res.ok && /\/img\//.test(new URL(req.url).pathname)) (await caches.open(IMG)).put(req, res.clone());
    return res;
  })());
});
