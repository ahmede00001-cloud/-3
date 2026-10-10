/* ============================================================
   firebase-messaging-sw.js
   Service Worker للإشعارات الحقيقية في الخلفية
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

/* ⚠️⚠️⚠️ استبدل هذه القيم من Firebase Console ⚠️⚠️⚠️
   
   للحصول على القيم:
   1. افتح console.firebase.google.com
   2. اختر مشروعك
   3. ⚙️ Project Settings
   4. تحت "Your apps" اختر تطبيق الويب
   5. انسخ القيم من firebaseConfig
*/
firebase.initializeApp({
  apiKey: "AIzaSy...ضع_مفتاحك",
  authDomain: "afaf-app.firebaseapp.com",
  projectId: "afaf-app",
  storageBucket: "afaf-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
});

const messaging = firebase.messaging();

/* ============================================================
   استقبال الرسائل في الخلفية
   يعمل حتى لو التطبيق مغلق تماماً
   ============================================================ */
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  /* إذا كان الإشعار يحتوي على notification جاهزة، FCM يعرضها تلقائياً */
  if (payload.notification) return;

  /* وإلا، نعرضها يدوياً من data */
  const title = payload.data?.title || 'طريق العفة';
  const options = {
    body: payload.data?.body || '',
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    tag: payload.data?.tag || 'afaf-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    data: { url: payload.data?.url || './' }
  };

  return self.registration.showNotification(title, options);
});

/* ============================================================
   عند الضغط على الإشعار — افتح التطبيق
   ============================================================ */
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        /* إذا كان التطبيق مفتوحاً، ركّز عليه */
        for (const client of clientList) {
          if (client.url.includes(location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        /* وإلا، افتح نافذة جديدة */
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

/* ============================================================
   تفعيل فوري
   ============================================================ */
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activated');
  event.waitUntil(clients.claim());
});

console.log('[SW] Firebase Messaging Service Worker loaded');