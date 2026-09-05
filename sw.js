/* Firebase Cloud Messaging Service Worker — Finanzas
   Ubicación recomendada en GitHub Pages: /Finanzas/sw.js
*/
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBG3rfE0gBnB816utXgFqcqvrpa6Xz0-x8",
  authDomain: "finanzas-e04ef.firebaseapp.com",
  projectId: "finanzas-e04ef",
  storageBucket: "finanzas-e04ef.firebasestorage.app",
  messagingSenderId: "331577489242",
  appId: "1:331577489242:web:0b1065acd3b3de2eeb2563"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Finanzas';
  const options = {
    body: payload.notification?.body || 'Tienes una actualización en Finanzas.',
    icon: '/Finanzas/icons/icon-192.png',
    badge: '/Finanzas/icons/icon-192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/Finanzas/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
