// js/auth.js - 認証ロジック

import { signInWithGitHub, signOut, getSession, onAuthStateChange } from './supabase.js';

export function initAuth(onLogin, onLogout) {
  // 認証状態の変化を監視
  onAuthStateChange((session) => {
    if (session) {
      onLogin(session.user);
    } else {
      onLogout();
    }
  });

  // ログインボタン
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'ログイン中...';
        await signInWithGitHub();
      } catch (err) {
        console.error('ログインエラー:', err);
        loginBtn.disabled = false;
        loginBtn.textContent = 'GitHubでログイン';
        alert('ログインに失敗しました。もう一度お試しください。');
      }
    });
  }

  // ログアウトボタン
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
      } catch (err) {
        console.error('ログアウトエラー:', err);
      }
    });
  }
}

export async function getCurrentSession() {
  return await getSession();
}
