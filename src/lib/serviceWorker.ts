import { getDb } from './db';

const CACHE_NAME = 'sprite-studio-cache-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/',
        '/index.html',
        '/style.css',
        '/main.js'
      ]);
    })
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle background sync for generations
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-generations') {
    event.waitUntil(syncGenerations());
  }
});

async function syncGenerations() {
  const db = await getDb();
  
  // Get pending generations
  const pendingGenerations = await db.query(
    `SELECT * FROM generations WHERE metadata->>'synced' = 'false'`
  );

  // Process each pending generation
  for (const generation of pendingGenerations.rows) {
    try {
      // Update metadata to mark as synced
      await db.query(
        `UPDATE generations 
         SET metadata = jsonb_set(metadata, '{synced}', 'true') 
         WHERE id = $1`,
        [generation.id]
      );

      // Send notification of successful sync
      await self.registration.showNotification('Generation Synced', {
        body: `Successfully synced ${generation.type} generation`,
        icon: '/icon.png'
      });
    } catch (error) {
      console.error('Sync failed for generation:', error);
    }
  }
}

// Handle push notifications
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png',
      data: data.data
    })
  );
});