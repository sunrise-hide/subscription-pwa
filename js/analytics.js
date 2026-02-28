// js/analytics.js - データ画面のチャート・テーブル描画

import Chart from 'https://esm.sh/chart.js/auto';

const COLORS = [
  '#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77',
  '#ff9f43', '#a29bfe', '#fd79a8', '#00cec9',
  '#e17055', '#74b9ff',
];

let donutChart = null;
let barChart = null;

// ---- 金額計算ヘルパー ----

function calcAmounts(sub) {
  const yearly  = sub.cycle === 'yearly'  ? sub.amount : sub.amount * 12;
  const monthly = sub.cycle === 'monthly' ? sub.amount : Math.round(sub.amount / 12);
  const daily   = Math.round(yearly / 365);
  return { yearly, monthly, daily };
}

// ---- メインレンダリング ----

export function renderAnalytics(subscriptions) {
  const empty        = document.getElementById('analytics-empty');
  const donutSection = document.getElementById('chart-section-donut');
  const barSection   = document.getElementById('chart-section-bar');
  const tableSection = document.getElementById('chart-section-table');

  if (!subscriptions.length) {
    empty.style.display        = 'flex';
    donutSection.style.display = 'none';
    barSection.style.display   = 'none';
    tableSection.style.display = 'none';
    renderSummaryCards([]);
    return;
  }

  empty.style.display        = 'none';
  donutSection.style.display = 'block';
  barSection.style.display   = 'block';
  tableSection.style.display = 'block';

  renderSummaryCards(subscriptions);
  renderDonutChart(subscriptions);
  renderBarChart(subscriptions);
  renderTable(subscriptions);
}

// ---- サマリーカード ----

function renderSummaryCards(subscriptions) {
  let totalYearly = 0;
  let totalMonthly = 0;

  subscriptions.forEach((sub) => {
    const { yearly, monthly } = calcAmounts(sub);
    totalYearly  += yearly;
    totalMonthly += monthly;
  });

  const totalDaily = Math.round(totalYearly / 365);

  document.getElementById('analytics-daily').textContent   = '¥' + totalDaily.toLocaleString('ja-JP');
  document.getElementById('analytics-monthly').textContent = '¥' + totalMonthly.toLocaleString('ja-JP');
  document.getElementById('analytics-yearly').textContent  = '¥' + totalYearly.toLocaleString('ja-JP');
}

// ---- ドーナツチャート ----

function renderDonutChart(subscriptions) {
  const ctx    = document.getElementById('donut-chart').getContext('2d');
  const labels = subscriptions.map((s) => s.name);
  const data   = subscriptions.map((s) => calcAmounts(s).yearly);
  const colors = subscriptions.map((_, i) => COLORS[i % COLORS.length]);

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#16213e',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a0a0a0',
            padding: 14,
            font: { size: 12 },
            boxWidth: 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val   = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = Math.round((val / total) * 100);
              return ` ¥${val.toLocaleString('ja-JP')}/年（${pct}%）`;
            },
          },
        },
      },
    },
  });
}

// ---- 横棒グラフ ----

function renderBarChart(subscriptions) {
  const sorted = [...subscriptions].sort(
    (a, b) => calcAmounts(b).yearly - calcAmounts(a).yearly
  );
  const ctx    = document.getElementById('bar-chart').getContext('2d');
  const labels = sorted.map((s) => s.name);
  const data   = sorted.map((s) => calcAmounts(s).yearly);
  const colors = sorted.map((_, i) => COLORS[i % COLORS.length]);

  // グラフの高さをサービス数に応じて動的に設定
  const barHeight = 44;
  const minHeight = 120;
  document.querySelector('.bar-wrapper').style.height =
    Math.max(minHeight, sorted.length * barHeight) + 'px';

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ¥${ctx.parsed.x.toLocaleString('ja-JP')}/年`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#a0a0a0',
            callback: (val) =>
              val >= 10000
                ? '¥' + Math.round(val / 10000) + '万'
                : val >= 1000
                ? '¥' + Math.round(val / 1000) + 'k'
                : '¥' + val,
          },
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#ffffff', font: { size: 13 } },
        },
      },
    },
  });
}

// ---- テーブル ----

function renderTable(subscriptions) {
  const tbody  = document.getElementById('analytics-table-body');
  const sorted = [...subscriptions].sort(
    (a, b) => calcAmounts(b).yearly - calcAmounts(a).yearly
  );

  tbody.innerHTML = sorted.map((sub, i) => {
    const { yearly, monthly, daily } = calcAmounts(sub);
    const color = COLORS[i % COLORS.length];
    return `
      <tr>
        <td>
          <span class="table-dot" style="background:${color}"></span>
          ${escapeHtml(sub.name)}
        </td>
        <td>¥${yearly.toLocaleString('ja-JP')}</td>
        <td>¥${monthly.toLocaleString('ja-JP')}</td>
        <td>¥${daily.toLocaleString('ja-JP')}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
