// js/ai.js - Gemini AI チャット機能

/* global GEMINI_API_KEY */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

let subscriptionsCache = [];

export function updateAISubscriptions(subscriptions) {
  subscriptionsCache = subscriptions;
}

function buildSystemInstruction(subscriptions) {
  if (subscriptions.length === 0) {
    return 'ユーザーはまだサブスクリプションを登録していません。サブスクを追加するよう案内してください。';
  }

  let monthlyTotal = 0;
  let yearlyTotal = 0;

  const subList = subscriptions
    .map((sub) => {
      const monthly =
        sub.cycle === 'monthly' ? sub.amount : Math.round(sub.amount / 12);
      const yearly =
        sub.cycle === 'monthly' ? sub.amount * 12 : sub.amount;
      monthlyTotal += monthly;
      yearlyTotal += yearly;
      return `- ${sub.name}: ${sub.amount.toLocaleString('ja-JP')}円/${sub.cycle === 'monthly' ? '月' : '年'} (次回更新: ${sub.next_billing_date})`;
    })
    .join('\n');

  const dailyTotal = Math.round(yearlyTotal / 365);

  return `あなたはサブスクリプション管理アプリ「SubsTracker」のAIアシスタントです。
ユーザーの登録済みサブスクリプションデータを元に、質問に日本語で丁寧かつ簡潔に答えてください。

【登録済みサブスクリプション（${subscriptions.length}件）】
${subList}

【合計】
- 日間: ${dailyTotal.toLocaleString('ja-JP')}円
- 月間: ${monthlyTotal.toLocaleString('ja-JP')}円
- 年間: ${yearlyTotal.toLocaleString('ja-JP')}円

回答は日本語で、必要に応じて金額・比較・節約アドバイスを含めてください。マークダウンは使わずプレーンテキストで答えてください。`;
}

export async function sendAIMessage(userMessage) {
  const apiKey =
    typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '';
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません');
  }

  const systemInstruction = buildSystemInstruction(subscriptionsCache);

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    '回答を取得できませんでした。'
  );
}

export function initAIPanel() {
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');

  const handleSend = async () => {
    const message = input.value.trim();
    if (!message || sendBtn.disabled) return;

    input.value = '';
    appendMessage('user', message);
    setLoading(true);

    try {
      const reply = await sendAIMessage(message);
      appendMessage('ai', reply);
    } catch (err) {
      appendMessage('ai', `エラーが発生しました: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  sendBtn.addEventListener('click', handleSend);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  document.querySelectorAll('.ai-suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent;
      handleSend();
    });
  });
}

function appendMessage(role, text, isError = false) {
  const messages = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-message ai-message-${role}${isError ? ' ai-message-error' : ''}`;

  const content = document.createElement('div');
  content.className = 'ai-message-content';
  content.textContent = text;

  div.appendChild(content);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function setLoading(isLoading) {
  const sendBtn = document.getElementById('ai-send');
  const input = document.getElementById('ai-input');
  const existing = document.getElementById('ai-loading');

  if (isLoading) {
    sendBtn.disabled = true;
    input.disabled = true;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'ai-loading';
    loadingDiv.className = 'ai-message ai-message-ai';
    loadingDiv.innerHTML =
      '<div class="ai-typing"><span></span><span></span><span></span></div>';
    document.getElementById('ai-messages').appendChild(loadingDiv);
    document.getElementById('ai-messages').scrollTop =
      document.getElementById('ai-messages').scrollHeight;
  } else {
    sendBtn.disabled = false;
    input.disabled = false;
    if (existing) existing.remove();
  }
}
