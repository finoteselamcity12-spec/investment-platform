const CACHE_NAME = 'blackrock-cache-v4-disabled'
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json', '/favicon.svg']

function shouldBypass(request) {
  if (request.method !== 'GET') return true

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return true
  if (url.hostname.includes('supabase.co')) return true
  if (url.pathname.startsWith('/api')) return true

  return false
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
          return undefined
        })
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (shouldBypass(event.request)) {
    return
  }

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(event.request)
        if (cached) return cached

        const response = await fetch(event.request)

        if (
          response &&
          response.ok &&
          response.type === 'basic' &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }

        return response
      } catch (err) {
        console.warn('[service-worker] fetch failed:', err)

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/index.html')
          if (fallback) return fallback
        }

        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    })()
  )
})
