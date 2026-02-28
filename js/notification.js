// js/notification.js - プッシュ通知ロジック

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then((registration) => {
    console.log('Service Worker 登録完了:', registration.scope);

    // 定期的な通知チェックをスケジュール（24時間ごと）
    scheduleNotificationCheck(registration);
  }).catch((err) => {
    console.error('Service Worker 登録失敗:', err);
  });
}

function scheduleNotificationCheck(registration) {
  // 'periodicSync' が使えればそちらを使う、なければ通常の sync を使う
  if ('periodicSync' in registration) {
    registration.periodicSync.register('subscription-check', {
      minInterval: 24 * 60 * 60 * 1000, // 24時間
    }).catch((err) => {
      console.warn('Periodic Sync 登録失敗（対応ブラウザのみ）:', err);
      fallbackSchedule();
    });
  } else {
    fallbackSchedule();
  }
}

function fallbackSchedule() {
  // フォールバック: ページロード時にチェック
  // Service Worker にサブスクデータを送って通知させる
  if (navigator.serviceWorker.controller) {
    sendSubscriptionsToSW();
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    sendSubscriptionsToSW();
  });
}

export function sendSubscriptionsToSW(subscriptions) {
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'CHECK_SUBSCRIPTIONS',
    subscriptions: subscriptions || [],
  });
}
