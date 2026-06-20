const CACHE_NAME = "alien-kick-buster-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./src/game.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/characters/kicker.png",
  "./assets/characters/kicker-prekick.png",
  "./assets/characters/kicker-kick.png",
  "./assets/characters/slime.png",
  "./assets/characters/mantis.png",
  "./assets/characters/psychic.png",
  "./assets/characters/alien-block.png",
  "./assets/characters/alien-hardhit.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
