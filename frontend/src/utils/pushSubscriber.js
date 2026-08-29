import api from '../services/api';

/**
 * Convert VAPID base64 string to Uint8Array for pushManager subscription
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker & Subscribe to Web Push Notifications
 */
export async function registerWebPushSubscription(orderId = null) {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, reason: 'Push notifications not supported on this browser' };
    }

    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'Notification permission denied' };
    }

    // 2. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID public key from backend
    const keyRes = await api.get('/push/public-key');
    if (!keyRes.data || !keyRes.data.success || !keyRes.data.data.publicKey) {
      return { success: false, reason: 'Failed to retrieve VAPID key' };
    }

    const publicKey = keyRes.data.data.publicKey;
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 4. Subscribe with PushManager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // 5. Send subscription to backend API
    const customerIdentity = localStorage.getItem('guest_identity_token') || null;

    await api.post('/push/subscribe', {
      order_id: orderId,
      customer_identity_id: customerIdentity,
      subscription: subscription.toJSON()
    });

    return { success: true, subscription };
  } catch (err) {
    console.warn('registerWebPushSubscription notice:', err.message);
    return { success: false, error: err.message };
  }
}
