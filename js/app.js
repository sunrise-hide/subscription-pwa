// js/app.js - メインアプリケーションロジック

import { fetchSubscriptions, addSubscription, updateSubscription, deleteSubscription } from './supabase.js';
import { initAuth } from './auth.js';
import { requestNotificationPermission, registerServiceWorker, sendSubscriptionsToSW } from './notification.js';
import { renderAnalytics } from './analytics.js';

let subscriptions = [];
let editingId = null;

// ---- 初期化 ----

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();

  initAuth(
    async (user) => {
      // ログイン後
      showScreen('home-screen');
      document.getElementById('user-name').textContent = user.user_metadata?.user_name || user.email;
      await loadSubscriptions();
      requestNotificationPermission();
    },
    () => {
      // ログアウト後
      showScreen('login-screen');
      subscriptions = [];
    }
  );

  setupEventListeners();
  setupTabs();
});

// ---- 画面切り替え ----

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ---- タブ切り替え ----

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;

      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(panelId).classList.add('active');

      // FABはホームパネルのみ表示
      document.getElementById('fab-add').style.display =
        panelId === 'home-panel' ? 'flex' : 'none';

      // データパネルに切り替えたらチャートを描画
      if (panelId === 'data-panel') {
        renderAnalytics(subscriptions);
      }
    });
  });
}

function isDataPanelActive() {
  return document.getElementById('data-panel')?.classList.contains('active');
}

// ---- イベントリスナー ----

function setupEventListeners() {
  // FAB（追加ボタン）
  document.getElementById('fab-add').addEventListener('click', () => openModal());

  // モーダル閉じる
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // フォーム送信
  document.getElementById('sub-form').addEventListener('submit', handleFormSubmit);

  // 周期変更でラベル更新
  document.getElementById('cycle').addEventListener('change', updateAmountLabel);
}

// ---- サブスクリプション読み込み ----

async function loadSubscriptions() {
  try {
    subscriptions = await fetchSubscriptions();
    renderSubscriptions();
    updateSummary();
    sendSubscriptionsToSW(subscriptions);
  } catch (err) {
    console.error('データ取得エラー:', err?.message, '| code:', err?.code, '| details:', err?.details, err);
    showToast('データの取得に失敗しました', 'error');
  }
}

// ---- 一覧レンダリング ----

function renderSubscriptions() {
  const list = document.getElementById('sub-list');
  const empty = document.getElementById('empty-state');

  if (subscriptions.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = subscriptions.map((sub) => createSubCard(sub)).join('');

  // イベント委任
  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

function createSubCard(sub) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const billing = new Date(sub.next_billing_date);
  const diffDays = Math.ceil((billing - today) / (1000 * 60 * 60 * 24));

  let urgencyClass = '';
  let urgencyBadge = '';
  if (diffDays <= 3) {
    urgencyClass = 'urgent';
    urgencyBadge = `<span class="badge badge-danger">${diffDays <= 0 ? '本日' : diffDays + '日後'}</span>`;
  } else if (diffDays <= 7) {
    urgencyClass = 'warning';
    urgencyBadge = `<span class="badge badge-warning">${diffDays}日後</span>`;
  }

  const cycleLabel = sub.cycle === 'monthly' ? '月次' : '年次';
  const formattedDate = billing.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const formattedAmount = sub.amount.toLocaleString('ja-JP');

  return `
    <div class="sub-card ${urgencyClass}" data-id="${sub.id}">
      <div class="sub-card-header">
        <div class="sub-icon">${sub.name.charAt(0).toUpperCase()}</div>
        <div class="sub-info">
          <h3 class="sub-name">${escapeHtml(sub.name)}</h3>
          <span class="sub-cycle">${cycleLabel}</span>
        </div>
        <div class="sub-actions">
          <button class="btn-icon btn-edit" data-id="${sub.id}" aria-label="編集">✏️</button>
          <button class="btn-icon btn-delete" data-id="${sub.id}" aria-label="削除">🗑️</button>
        </div>
      </div>
      <div class="sub-card-footer">
        <div class="sub-amount">¥${formattedAmount}<span class="sub-amount-unit">/${sub.cycle === 'monthly' ? '月' : '年'}</span></div>
        <div class="sub-date">
          ${urgencyBadge}
          <span class="date-label">次回: ${formattedDate}</span>
        </div>
      </div>
    </div>
  `;
}

// ---- 合計金額計算 ----

function updateSummary() {
  let monthlyTotal = 0;
  let yearlyTotal = 0;

  subscriptions.forEach((sub) => {
    if (sub.cycle === 'monthly') {
      monthlyTotal += sub.amount;
      yearlyTotal += sub.amount * 12;
    } else {
      // 年次: 年間合計にそのまま加算、月額換算も計算
      yearlyTotal += sub.amount;
      monthlyTotal += Math.round(sub.amount / 12);
    }
  });

  document.getElementById('monthly-total').textContent = '¥' + monthlyTotal.toLocaleString('ja-JP');
  document.getElementById('yearly-total').textContent = '¥' + yearlyTotal.toLocaleString('ja-JP');
  document.getElementById('sub-count').textContent = subscriptions.length + '件';
}

// ---- モーダル操作 ----

function openModal(id = null) {
  editingId = id;
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('sub-form');

  form.reset();
  updateAmountLabel();

  if (id) {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;
    title.textContent = 'サブスク編集';
    document.getElementById('sub-name').value = sub.name;
    document.getElementById('amount').value = sub.amount;
    document.getElementById('cycle').value = sub.cycle;
    document.getElementById('next-billing-date').value = sub.next_billing_date;
    updateAmountLabel();
  } else {
    title.textContent = 'サブスク追加';
    // デフォルトで今日の1ヶ月後を設定
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('next-billing-date').value = nextMonth.toISOString().split('T')[0];
  }

  modal.classList.add('active');
  document.getElementById('sub-name').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  editingId = null;
}

function updateAmountLabel() {
  const cycle = document.getElementById('cycle').value;
  const label = document.getElementById('amount-label');
  label.textContent = cycle === 'monthly' ? '金額（月額）' : '金額（年額）';
}

// ---- フォーム送信 ----

async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '保存中...';

  const subData = {
    name: document.getElementById('sub-name').value.trim(),
    amount: parseInt(document.getElementById('amount').value, 10),
    cycle: document.getElementById('cycle').value,
    next_billing_date: document.getElementById('next-billing-date').value,
  };

  try {
    if (editingId) {
      const updated = await updateSubscription(editingId, subData);
      const idx = subscriptions.findIndex((s) => s.id === editingId);
      if (idx !== -1) subscriptions[idx] = updated;
      showToast('更新しました');
    } else {
      const created = await addSubscription(subData);
      subscriptions.unshift(created);
      showToast('追加しました');
    }

    // 日付順に再ソート
    subscriptions.sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date));
    renderSubscriptions();
    updateSummary();
    sendSubscriptionsToSW(subscriptions);
    if (isDataPanelActive()) renderAnalytics(subscriptions);
    closeModal();
  } catch (err) {
    console.error('保存エラー:', err?.message, '| code:', err?.code, '| details:', err?.details, err);
    showToast('保存に失敗しました', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '保存';
  }
}

// ---- 削除 ----

async function handleDelete(id) {
  const sub = subscriptions.find((s) => s.id === id);
  if (!sub) return;
  if (!confirm(`「${sub.name}」を削除しますか？`)) return;

  try {
    await deleteSubscription(id);
    const card = document.querySelector(`.sub-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('fade-out');
      await new Promise((r) => setTimeout(r, 300));
    }
    subscriptions = subscriptions.filter((s) => s.id !== id);
    renderSubscriptions();
    updateSummary();
    sendSubscriptionsToSW(subscriptions);
    if (isDataPanelActive()) renderAnalytics(subscriptions);
    showToast('削除しました');
  } catch (err) {
    console.error('削除エラー:', err);
    showToast('削除に失敗しました', 'error');
  }
}

// ---- ユーティリティ ----

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
