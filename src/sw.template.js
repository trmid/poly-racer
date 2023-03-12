const cacheName = `$PACKAGE_VERSION`; // Change value to force update
const essentialFilesToCache = `$ESSENTIAL_FILES_TO_CACHE`; // Generated filenames as string array
const secondaryFilesToCache = `$SECONDARY_FILES_TO_CACHE`; // Generated filenames as string array

self.addEventListener("install", event => {

	// Delete any non-current cache
	event.waitUntil(
		caches.keys().then(keys => 
			Promise.all(
				keys.map(key => {
					if (![cacheName].includes(key)) {
						return caches.delete(key);
					}
				})
			)
		)
	);
	
	// Kick out the old service worker
	self.skipWaiting();

  // Wait for essential file installation:
	event.waitUntil(
		caches.open(cacheName).then(cache => {
			return cache.addAll(JSON.parse(essentialFilesToCache));
		})
	);

  // Trigger async, non-essential file installation:
  caches.open(cacheName).then(cache => {
    return Promise.allSettled(
      JSON.parse(secondaryFilesToCache).map(file => cache.add(file).catch(console.warn))
    );
  }).catch(console.error);

});

// Get data on screen as quickly as possible, then update once the network has returned the latest data. 
self.addEventListener("fetch", event => {
	event.respondWith(
		caches.open(cacheName).then(cache => 
			cache.match(event.request).then(response => {
        const networkResponse = fetch(event.request).then(networkResponse => {
					if(Math.floor(networkResponse.status / 100) == 2) cache.put(event.request, networkResponse.clone());
					return networkResponse;
				}).catch(console.warn);
				return response ?? networkResponse;
			})
		)
	);
});