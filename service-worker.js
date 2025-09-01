const CACHE_NAME = 'stanforis-cache-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  '/css/output.css',
  '/js/app.js',
  '/img/logo.png',
  '/img/Governance.png',
  '/offline.html'
];

const queueName = 'post-requests';

/* ----------------- INSTALL ----------------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* ----------------- ACTIVATE ----------------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ----------------- FETCH ----------------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip unsupported schemes
  if (!url.protocol.startsWith('http')) return;

  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cachedResponse => {
        if (cachedResponse) {
          // Background update
          fetch(req).then(response => {
            caches.open(CACHE_NAME).then(cache => cache.put(req, response.clone()));
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(req).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(req, response.clone());
            return response;
          });
        }).catch(() => {
          if (req.destination === 'document') return caches.match('/offline.html');
        });
      })
    );
  }

  // Only save POST requests (don’t cache)
  if (req.method === 'POST') {
    event.respondWith(
      fetch(req.clone()).catch(() => savePostRequest(req.clone()))
    );
  }
});

/* ----------------- BACKGROUND SYNC ----------------- */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncQueuedRequests());
  }
});

/* ----------------- SAVE FAILED POST ----------------- */
async function savePostRequest(request) {
  const db = await openDatabase();
  const data = {
    url: request.url,
    method: request.method,
    headers: [...request.headers],
    body: await request.clone().text(),
    timestamp: Date.now()
  };
  const tx = db.transaction(queueName, 'readwrite');
  tx.objectStore(queueName).put(data);

  return new Response(JSON.stringify({ success: false, offline: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/* ----------------- SYNC QUEUED REQUESTS ----------------- */
async function syncQueuedRequests() {
  const db = await openDatabase();
  const tx = db.transaction(queueName, 'readwrite');
  const store = tx.objectStore(queueName);
  const allRequests = await store.getAll();

  for (const req of allRequests) {
    try {
      await fetch(req.url, {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.body
      });
      store.delete(req.timestamp);
    } catch (err) {
      console.error('Sync failed for', req.url, err);
    }
  }

  // Notify user
  self.registration.showNotification('✅ Sync Complete', {
    body: 'All offline submissions were sent successfully!',
    icon: '/img/logo.png'
  });
}

/* ----------------- OPEN DATABASE ----------------- */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('stanforis-sync-db', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(queueName)) {
        db.createObjectStore(queueName, { keyPath: 'timestamp' });
      }
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}
































// const CACHE_NAME = 'stanforis-cache-v1';

// const urlsToCache = [
//   // Root
//   '/',
//   '/index.html',
//   '/favicon.ico',
//   '/manifest.json',

//   // CSS
//   '/css/index.css',
//   '/css/input.css',
//   '/css/output.css',

//   // JS core
//   '/js/app.js',
//   '/js/bootstrap.js',
//   '/js/firebase.js',
//   '/js/FirebaseAdapter.js',
//   '/js/index.js',
//   '/js/SyncManager.js',

//   // JS components
//   '/js/components/cards.js',
//   '/js/components/inspector.js',
//   '/js/components/tables.js',

//   // JS utils
//   '/js/utils/dom.js',
//   '/js/utils/filters.js',
//   '/js/utils/toast.js',

//   // JS pages
//   '/js/pages/about.js',
//   '/js/pages/alerts.js',
//   '/js/pages/automation.js',
//   '/js/pages/contucts.js',
//   '/js/pages/dashboard.js',
//   '/js/pages/devices.js',
//   '/js/pages/emergency.js',
//   '/js/pages/IoTdevices.js',
//   '/js/pages/load-familiars.js',
//   '/js/pages/logs.js',
//   '/js/pages/notifications.js',
//   '/js/pages/profile.js',
//   '/js/pages/register-familiar.js',
//   '/js/pages/settings.js',
//   '/js/pages/social_dashbaord.js',
//   '/js/pages/staff.js',
//   '/js/pages/support.js',
//   '/js/pages/auth/login.js',
//   '/js/pages/auth/signup.js',

//   // JS tests (optional, you can remove if not needed)
//   '/js/tests/db.spec.js',
//   '/js/tests/shims.js',
//   '/js/tests/sync.spec.js',

//   // HTML pages
//   '/pages/abou.html',
//   '/pages/about.html',
//   '/pages/alerts.html',
//   '/pages/automation.html',
//   '/pages/contacts.html',
//   '/pages/dashboard.html',
//   '/pages/devices.html',
//   '/pages/emergency.html',
//   '/pages/IoTdevices.html',
//   '/pages/load-familiars.html',
//   '/pages/logs.html',
//   '/pages/notifications.html',
//   '/pages/register-familiar.html',
//   '/pages/settings.html',
//   '/pages/staff.html',
//   '/pages/support.html',
//   '/pages/systemStatus.html',
//   '/pages/auth/login.html',
//   '/pages/auth/signup.html',

//   // GOV pages
//   '/pages/gov/admin-audit.html',
//   '/pages/gov/admin-users.html',
//   '/pages/gov/analytics.html',
//   '/pages/gov/budgets.html',
//   '/pages/gov/committees.html',
//   '/pages/gov/dashboard.html',
//   '/pages/gov/dwellings.html',
//   '/pages/gov/exports.html',
//   '/pages/gov/issue.html',
//   '/pages/gov/issues.html',
//   '/pages/gov/leaders.html',
//   '/pages/gov/map.html',
//   '/pages/gov/meetings.html',
//   '/pages/gov/notifications.html',
//   '/pages/gov/reports.html',
//   '/pages/gov/resident.html',
//   '/pages/gov/residents.html',
//   '/pages/gov/security-alerts.html',
//   '/pages/gov/security-incidents.html',
//   '/pages/gov/security-patrols.html',
//   '/pages/gov/settings.html',
//   '/pages/gov/tasks.html',

//   // Images
//   '/img/avatar-placeholder.png',
//   '/img/Governance.png',
//   '/img/logo.png',

//   // Icons
//   '/android-icon-192x192.png'
//   // Add /android-icon-512x512.png if you create it
// ];

// self.addEventListener('install', event => {
//   event.waitUntil(
//     caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
//   );
// });

// self.addEventListener('fetch', event => {
//   event.respondWith(
//     caches.match(event.request).then(response => {
//       return response || fetch(event.request);
//     })
//   );
// });
