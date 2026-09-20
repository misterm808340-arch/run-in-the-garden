/* Run in the Garden - Service Worker
   Full offline support: pre-caches every asset, then serves
   stale-while-revalidate so updates arrive on the second launch. */
'use strict';

var CACHE = 'ritg-v1.2.0';

var PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/config.js',
  'js/utils.js',
  'js/storage.js',
  'js/audio.js',
  'js/input.js',
  'js/world.js',
  'js/player.js',
  'js/entities.js',
  'js/particles.js',
  'js/admob.js',
  'js/ui.js',
  'js/game.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'favicon.png',
  'legal/privacy-policy.html',
  'legal/terms-and-conditions.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
          /* a missing optional file must not break the install */
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* stale-while-revalidate for same-origin GET requests */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (resp) {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            cache.put(req, resp.clone());
          }
          return resp;
        }).catch(function () {
          return cached || Response.error();
        });
        return cached || network;
      });
    })
  );
});
