/* Service worker: lets Sideline Stats open with no internet (gyms often have bad wifi).

   How it works:
   - On install, it downloads every file in FILES into a cache on the phone.
   - After that, every request is answered from the cache straight away, so the
     app opens instantly even offline. At the same time it quietly fetches a
     fresh copy (when online) and stores it for next time ("stale-while-revalidate").
     So after you publish a change, users see it the second time they open the app.

   When you ADD, REMOVE or RENAME a file the app needs, update FILES and bump
   VERSION so phones download the new list. Editing an existing file doesn't
   need a bump.

   This only caches the app's own files. Player data lives in localStorage and
   is never touched here. */
var VERSION = "v1";
var CACHE = "sideline-stats-" + VERSION;
var FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "fonts/barlow-400.woff2",
  "fonts/barlow-500.woff2",
  "fonts/barlow-600.woff2",
  "fonts/barlow-condensed-600.woff2",
  "fonts/barlow-condensed-700.woff2",
  "fonts/barlow-condensed-800.woff2"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      // cache:"reload" skips the browser's HTTP cache so we store the newest files.
      return cache.addAll(FILES.map(function(f){ return new Request(f, {cache:"reload"}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  // Delete caches left by older versions.
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k.indexOf("sideline-stats-") === 0 && k !== CACHE;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Opening the app (with or without "index.html" or "?something") always uses one cached copy.
  var isPage = req.mode === "navigate" && /\/(index\.html)?$/.test(url.pathname);

  // Fetch a fresh copy in the background and save it for next time.
  var fresh = fetch(req, {cache:"no-cache"}).then(function(res){
    if (res.ok && !res.redirected){
      var copy = res.clone();
      caches.open(CACHE).then(function(cache){ cache.put(isPage ? "./" : req, copy); });
    }
    return res;
  });
  e.waitUntil(fresh.then(function(){}, function(){}));

  e.respondWith(
    caches.match(isPage ? "./" : req).then(function(cached){
      return cached || fresh.catch(function(){ return Response.error(); });
    })
  );
});
