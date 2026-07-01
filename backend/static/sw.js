/**
 * Service Worker - Cache-first for static assets, network-first for API/WS.
 * Enables PWA offline capability for the app shell.
 */

const CACHE_NAME = 'ecg-web-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/websocket.js',
    '/js/ecg_canvas.js',
    '/js/ui_manager.js',
    '/assets/bt_on.svg',
    '/assets/bt_off.svg',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/icon-maskable-192.png',
    '/assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // addAll fails the whole install if any 404s; tolerate missing files
            Promise.all(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch(() => null)
                )
            )
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // WebSocket and REST API: always network
    if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api/')) {
        return;
    }

    // Network-first for HTML navigations so updates are picked up quickly
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Cache-first for everything else (JS, CSS, images)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
