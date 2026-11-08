// Service Worker for 100% Free Web Push Notifications & Background Order Status Alerts
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event Listener (Foreground & Closed Browser)
self.addEventListener('push', (event) => {
  try {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        data = { body: event.data.text() };
      }
    }

    const payload = data.notification || data;
    const title = payload.title || data.title || 'Grand Palace 🏨';
    const body = payload.body || data.body || 'Your order status has been updated.';
    const icon = payload.icon || '/logo.png';
    const url = payload.url || data.url || '/';
    const tag = payload.tag || (data.order_id ? `order-status-${data.order_id}` : 'order-status-update');

    const options = {
      body,
      icon,
      badge: icon,
      vibrate: [200, 100, 200, 100, 300],
      tag,
      renotify: true,
      data: {
        url,
        order_id: data.order_id || payload.order_id
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Service worker push event error:', err);
  }
});

// Notification Click Handler (Navigates to Live Tracking Page)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If customer tracking window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/order/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab/window to tracking URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
