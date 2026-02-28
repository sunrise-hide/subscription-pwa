// js/calendar.js - カレンダー・履歴画面

const COLORS = [
  '#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77',
  '#ff9f43', '#a29bfe', '#fd79a8', '#00cec9',
  '#e17055', '#74b9ff',
];

let currentYear;
let currentMonth;
let calData = [];
let navReady = false;

// ---- 初期化（ナビゲーションボタンのセットアップ） ----

export function initCalendar() {
  if (navReady) return;
  navReady = true;

  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();

  document.getElementById('cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(calData);
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar(calData);
  });
}

// ---- カレンダー描画 ----

export function renderCalendar(subscriptions) {
  calData = subscriptions;

  document.getElementById('cal-detail').style.display = 'none';
  document.getElementById('cal-title').textContent =
    `${currentYear}年${currentMonth + 1}月`;

  const events      = getBillingEvents(subscriptions, currentYear, currentMonth);
  const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today       = new Date();
  const isNowMonth  =
    today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  let html = '';

  // 月初前の空セル
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell empty"></div>';
  }

  // 日付セル
  for (let day = 1; day <= daysInMonth; day++) {
    const key      = toDateKey(currentYear, currentMonth, day);
    const subs     = events[key] || [];
    const hasEvent = subs.length > 0;
    const isToday  = isNowMonth && day === today.getDate();

    const dots = subs.slice(0, 3).map(
      (s) => `<span class="cal-dot" style="background:${subColor(s)}"></span>`
    ).join('');

    html += `
      <div class="cal-cell${hasEvent ? ' has-events' : ''}${isToday ? ' today' : ''}"
           data-date="${key}"${hasEvent ? ' role="button" tabindex="0"' : ''}>
        <span class="cal-date-num">${day}</span>
        ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
      </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;

  document.querySelectorAll('.cal-cell.has-events').forEach((cell) => {
    cell.addEventListener('click', () => showDetail(cell.dataset.date, events));
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') showDetail(cell.dataset.date, events);
    });
  });
}

// ---- タップ時のサービス詳細表示 ----

function showDetail(dateStr, events) {
  const subs   = events[dateStr] || [];
  const detail = document.getElementById('cal-detail');
  const dateEl = document.getElementById('cal-detail-date');
  const listEl = document.getElementById('cal-detail-list');

  const d = new Date(dateStr + 'T00:00:00');
  dateEl.textContent = d.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  listEl.innerHTML = subs.map((sub) => {
    const amount = sub.amount.toLocaleString('ja-JP');
    const unit   = sub.cycle === 'monthly' ? '月' : '年';
    return `
      <div class="cal-detail-item">
        <div class="cal-detail-dot" style="background:${subColor(sub)}"></div>
        <div class="cal-detail-info">
          <span class="cal-detail-name">${escHtml(sub.name)}</span>
          <span class="cal-detail-amount">¥${amount}/${unit}</span>
        </div>
      </div>`;
  }).join('');

  detail.style.display = 'block';

  document.querySelectorAll('.cal-cell').forEach((c) => c.classList.remove('selected'));
  document.querySelector(`.cal-cell[data-date="${dateStr}"]`)?.classList.add('selected');
}

// ---- 履歴描画 ----

export function renderHistory(subscriptions) {
  const listEl  = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');

  if (!subscriptions.length) {
    emptyEl.style.display = 'flex';
    listEl.innerHTML = '';
    return;
  }

  const history = buildHistory(subscriptions);

  if (!history.length) {
    emptyEl.style.display = 'flex';
    listEl.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';

  // 月ごとにグルーピング
  const grouped = {};
  history.forEach((item) => {
    const d   = new Date(item.date + 'T00:00:00');
    const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  let html = '';
  Object.entries(grouped).forEach(([monthLabel, items]) => {
    const total = items.reduce((s, i) => s + i.amount, 0);
    html += `
      <div class="history-month-header">
        <span>${monthLabel}</span>
        <span class="history-month-total">¥${total.toLocaleString('ja-JP')}</span>
      </div>`;
    items.forEach((item) => {
      const d       = new Date(item.date + 'T00:00:00');
      const day     = d.getDate();
      const weekday = WEEKDAYS[d.getDay()];
      html += `
        <div class="history-item">
          <div class="history-date">
            <span class="history-day">${day}</span>
            <span class="history-weekday">${weekday}</span>
          </div>
          <div class="history-dot" style="background:${subColor(item)}"></div>
          <div class="history-info">
            <span class="history-name">${escHtml(item.name)}</span>
            <span class="history-cycle">${item.cycle === 'monthly' ? '月次' : '年次'}</span>
          </div>
          <div class="history-amount">¥${item.amount.toLocaleString('ja-JP')}</div>
        </div>`;
    });
  });

  listEl.innerHTML = html;
}

// ---- ヘルパー関数 ----

function getBillingEvents(subscriptions, year, month) {
  const events = {};
  subscriptions.forEach((sub) => {
    const nb  = new Date(sub.next_billing_date + 'T00:00:00');
    const day = nb.getDate();

    if (sub.cycle === 'monthly') {
      const maxDay = new Date(year, month + 1, 0).getDate();
      const key    = toDateKey(year, month, Math.min(day, maxDay));
      if (!events[key]) events[key] = [];
      events[key].push(sub);
    } else if (nb.getMonth() === month) {
      const maxDay = new Date(year, month + 1, 0).getDate();
      const key    = toDateKey(year, month, Math.min(day, maxDay));
      if (!events[key]) events[key] = [];
      events[key].push(sub);
    }
  });
  return events;
}

function buildHistory(subscriptions) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];

  subscriptions.forEach((sub) => {
    const nb     = new Date(sub.next_billing_date + 'T00:00:00');
    const months = sub.cycle === 'monthly' ? 24 : 0;
    const years  = sub.cycle === 'yearly'  ? 5  : 0;

    for (let i = 1; i <= months; i++) {
      const d = new Date(nb);
      d.setMonth(d.getMonth() - i);
      if (d < today) items.push({ date: d.toISOString().split('T')[0], ...sub });
    }
    for (let i = 1; i <= years; i++) {
      const d = new Date(nb);
      d.setFullYear(d.getFullYear() - i);
      if (d < today) items.push({ date: d.toISOString().split('T')[0], ...sub });
    }
  });

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function subColor(sub) {
  let h = 0;
  const name = sub.name || '';
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return COLORS[Math.abs(h) % COLORS.length];
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
