// TravelX Background Service Worker for Mobile & Desktop Push Notifications
const CACHE_NAME = 'travelx-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications (even when app/tab is backgrounded)
self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 TravelX New Booking Request!',
    body: 'A new seat hold inquiry has arrived from an agent. Click to review.',
    icon: '/travelx-logo.png',
    badge: '/travelx-logo.png',
    tag: 'travelx-booking-' + Date.now(),
    vibrate: [500, 200, 500, 200, 800],
    data: { url: '/staff' }
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/travelx-logo.png',
      badge: data.badge || '/travelx-logo.png',
      tag: data.tag || ('travelx-alert-' + Date.now()),
      vibrate: data.vibrate || [600, 150, 600, 150, 600, 150, 900],
      requireInteraction: true,
      renotify: true,
      data: data.data || { url: '/admin' }
    })
  );
});

// Clicking notification brings staff/admin directly to the Booking Requests Desk
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/staff';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
