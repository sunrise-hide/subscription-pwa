# SubsTracker

サブスクリプションをダークテーマで一元管理するPWAアプリです。

## 機能

- GitHubアカウントでログイン
- サブスクリプションの追加・編集・削除
- 月間・年間合計金額の自動計算
- 更新日7日前・3日前・前日のプッシュ通知
- PWA対応（ホーム画面に追加可能）

---

## セットアップ手順

### 1. Supabase プロジェクトの作成

1. [supabase.com](https://supabase.com) でアカウント作成後、新規プロジェクトを作成
2. 「SQL Editor」を開き、以下のSQLを実行してテーブルとRLSを設定：

```sql
-- テーブル作成
create table subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount integer not null,
  cycle text not null check (cycle in ('monthly', 'yearly')),
  next_billing_date date not null,
  created_at timestamp with time zone default now()
);

-- RLS（行レベルセキュリティ）を有効化
alter table subscriptions enable row level security;

-- 自分のデータのみアクセス可能にするポリシー
create policy "Users can only access their own data"
  on subscriptions for all
  using (auth.uid() = user_id);
```

3. ⚠️ **RLS確認**: Table Editor → subscriptions → 「RLS enabled」バッジが表示されていることを確認

### 2. GitHub OAuth アプリの設定

#### GitHub側の設定

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
2. 以下を入力：
   - **Application name**: SubsTracker
   - **Homepage URL**: `https://{username}.github.io/{repo-name}/`
   - **Authorization callback URL**: `https://{username}.supabase.co/auth/v1/callback`
3. 「Register application」後、**Client ID** と **Client Secret** をメモ

#### Supabase側の設定

1. Supabase ダッシュボード → Authentication → Providers → **GitHub** を有効化
2. GitHub の Client ID・Client Secret を入力して保存
3. Authentication → URL Configuration → **Site URL** に以下を設定：
   ```
   https://{username}.github.io/{repo-name}/
   ```
4. **Redirect URLs** に以下を追加：
   ```
   https://{username}.github.io/{repo-name}/
   ```

> ⚠️ GitHub PagesのURLは `https://{username}.github.io/{repo-name}/` 形式です。
> ローカル開発時は `http://localhost:port` も Redirect URLs に追加してください。

### 3. config.js の設定

`js/config.js` を編集して Supabase の接続情報を入力します。

```bash
# config.js はすでに .gitignore に含まれています
# Git にコミットされないことを確認してから編集してください
```

```js
// js/config.js
const SUPABASE_URL = 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

接続情報は Supabase ダッシュボード → Project Settings → API から取得できます。

### 4. PWA アイコンの準備

`icon-192.png`（192×192px）と `icon-512.png`（512×512px）を
プロジェクトルートに配置してください。

無料でアイコンを生成するには [favicon.io](https://favicon.io/) などが便利です。

---

## GitHub Pages へのデプロイ

### リポジトリ作成

```bash
cd subscription-pwa
git init
git add .
# ⚠️ js/config.js が .gitignoreに含まれていることを確認
git status  # js/config.js が表示されないことを確認
git commit -m "Initial commit"
```

### GitHub にプッシュ

```bash
git remote add origin https://github.com/{username}/{repo-name}.git
git branch -M main
git push -u origin main
```

### GitHub Pages を有効化

1. リポジトリ → Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Save

数分後に `https://{username}.github.io/{repo-name}/` でアクセス可能になります。

---

## ローカル開発

Service Workerは `localhost` でも動作します。
任意のローカルサーバーで起動してください。

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code の Live Server 拡張機能でも可
```

ブラウザで `http://localhost:8080` を開いて動作確認できます。

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JavaScript |
| バックエンド | Supabase（PostgreSQL） |
| 認証 | Supabase Auth（GitHub OAuth） |
| プッシュ通知 | Web Push API + Service Worker |
| ホスティング | GitHub Pages |

## ライセンス

MIT
