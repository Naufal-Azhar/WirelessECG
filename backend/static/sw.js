/**
 * Service Worker - Cache-first strategy for static assets.
 * Enables PWA offline capability for the app shell.
 */

const CACHE_NAME = 'ecg-web-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/websocket.js',
    '/js/ecg_canvas.js',
    '/js/ui_manager.js',
    '/assets/bt_on.svg',
    '/assets/bt_off.svg',
    '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first for static, network-first for API/WS
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip WebSocket and API requests
    if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then((response) => {
                // Cache new static assets
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
