const CACHE_NAME = 'read-later-v23';
const ASSETS = [
    './',
    './index.html',
    './src/theme.css',
    './src/read-later-app.js',
    './src/app-styles.js',
    './src/components/link-input.js',
    './src/components/link-item.js',
    './src/components/reader-view.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://esm.run/lit',
    'https://esm.run/yjs',
    'https://esm.run/y-webrtc',
    'https://esm.run/y-indexeddb',
    'https://esm.run/idb-keyval'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
