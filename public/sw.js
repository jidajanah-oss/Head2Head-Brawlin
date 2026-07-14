const SHELL_CACHE = "head2head-brawlin-shell-v1";
const RUNTIME_CACHE = "head2head-brawlin-runtime-v1";
const CACHE_PREFIX = "head2head-brawlin-";

const appRoot = new URL("./", self.location.href);
const appAsset = (path) => new URL(path, appRoot).toString();

const APP_SHELL = [
  appRoot.toString(),
  appAsset("index.html"),
  appAsset("manifest.webmanifest"),
  appAsset("icons/pwa-192x192.png"),
  appAsset("icons/pwa-512x512.png"),
  appAsset("icons/pwa-maskable-512x512.png"),
  appAsset("icons/apple-touch-icon.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map((url) => cache.add(url)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(CACHE_PREFIX) &&
                cacheName !== SHELL_CACHE &&
                cacheName !== RUNTIME_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

async function networkFirstNavigation(request) {
  const shellCache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await shellCache.put(
        appAsset("index.html"),
        response.clone(),
      );
    }

    return response;
  } catch {
    return (
      (await shellCache.match(request)) ??
      (await shellCache.match(appAsset("index.html"))) ??
      (await shellCache.match(appRoot.toString())) ??
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await runtimeCache.match(request);

  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await runtimeCache.put(
          request,
          response.clone(),
        );
      }

      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    void networkResponsePromise;
    return cachedResponse;
  }

  return (
    (await networkResponsePromise) ??
    Response.error()
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (
    requestUrl.origin !== self.location.origin ||
    !requestUrl.pathname.startsWith(
      appRoot.pathname,
    )
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirstNavigation(request),
    );
    return;
  }

  event.respondWith(
    staleWhileRevalidate(request),
  );
});
