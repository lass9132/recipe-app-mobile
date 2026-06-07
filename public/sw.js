// Service worker — gør appen offline-dygtig (app-skallen caches).
// Brugerens data ligger i IndexedDB og røres IKKE her.
// Stier er relative til SW'ens placering, så den virker både i roden og i en undermappe (GitHub Pages).
const SCOPE = new URL('./', self.location).href
const CACHE = 'opskrifter-v2'
const APP_SHELL = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'favicon.svg'].map(
  (p) => new URL(p, SCOPE).href
)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Eksterne kald (fx Open Food Facts) håndteres ikke af cachen — de går direkte til netværket.
  if (url.origin !== self.location.origin) return

  // Sidenavigation: netværk først, fald tilbage til cached index.html når offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(new URL('index.html', SCOPE).href).then((r) => r || caches.match(SCOPE))
      )
    )
    return
  }

  // Statiske assets: svar fra cache med det samme, og opdatér cachen i baggrunden.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
