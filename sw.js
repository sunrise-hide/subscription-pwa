// sw.js - Service Worker（プッシュ通知・オフライン対応）

const CACHE_NAME = 'substracker-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
];

// ===== インストール =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ===== アクティベーション =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== フェッチ（キャッシュファースト） =====
self.addEventListener('fetch', (event) => {
  // Supabase API はキャッシュしない
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});

// ===== メインスレッドからのメッセージ受信 =====
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_SUBSCRIPTIONS') {
    checkAndNotify(event.data.subscriptions || []);
  }
});

// ===== Periodic Background Sync =====
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'subscription-check') {
    event.waitUntil(notifyFromCache());
  }
});

// ===== 通知チェックロジック =====

/**
 * サブスクデータを受け取って通知すべきものを通知する
 * @param {Array} subscriptions
 */
function checkAndNotify(subscriptions) {
  if (!subscriptions.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  subscriptions.forEach((sub) => {
    const billing = new Date(sub.next_billing_date);
    const diffDays = Math.ceil((billing - today) / (1000 * 60 * 60 * 24));

    // 通知を送る日数: 7日前・3日前・前日(1日前)
    if (diffDays === 7 || diffDays === 3 || diffDays === 1) {
      const notifKey = `notified-${sub.id}-${sub.next_billing_date}-${diffDays}`;

      // 同じ通知を重複して送らないよう localStorageキーを確認
      // (SW内では localStorageは使えないため IndexedDB or キャッシュを代用)
      getCachedNotifKey(notifKey).then((already) => {
        if (already) return;
        setCachedNotifKey(notifKey);

        const dayLabel = diffDays === 1 ? '明日' : `${diffDays}日後`;
        const amount = sub.amount.toLocaleString('ja-JP');
        const unit = sub.cycle === 'monthly' ? '月' : '年';

        self.registration.showNotification(`${sub.name} の更新が${dayLabel}`, {
          body: `¥${amount}/${unit} が請求されます`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: notifKey,
          data: { url: self.registration.scope },
        });
      });
    }
  });
}

/** キャッシュ済み通知キャッシュから確認 */
async function getCachedNotifKey(key) {
  const cache = await caches.open('notif-sent-v1');
  const resp = await cache.match(key);
  return !!resp;
}

/** キャッシュに通知送信済みを記録 */
async function setCachedNotifKey(key) {
  const cache = await caches.open('notif-sent-v1');
  await cache.put(key, new Response('1'));
}

/** Periodic Sync 用: キャッシュしたサブスクデータで通知チェック */
async function notifyFromCache() {
  const cache = await caches.open(CACHE_NAME);
  const resp = await cache.match('__subscriptions__');
  if (!resp) return;
  const subscriptions = await resp.json();
  checkAndNotify(subscriptions);
}

// ===== 通知クリック =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
