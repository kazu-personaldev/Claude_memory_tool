# Claude Memo

Claudeのクレジット（レート制限）が回復したら自動的に送信するメモアプリ。

## 機能

- **メモを書いて送信** — Claudeへの質問・依頼を書いてボタン一つで送信
- **下書き保存** — クレジットが制限されているときはいったん保存しておける
- **自動再試行** — レート制限エラーが返ってきたら5分ごとに自動再試行
- **ブラウザ通知** — 返信が届いたらプッシュ通知で知らせる
- **モバイル対応** — スマホからもPCからも使える

## セットアップ

### 必要なもの
- [Anthropic API Key](https://console.anthropic.com/) (`sk-ant-api...` から始まるもの)

### Vercelにデプロイ（推奨）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kazu-personaldev/Claude_memory_tool)

1. 上のボタンを押してVercelにデプロイ
2. Vercelの「Environment Variables」に `ANTHROPIC_API_KEY` を設定
3. デプロイ完了後、スマホをホーム画面に追加（PWA対応）

### ローカルで動かす

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY を設定
npm run dev
```

## 使い方

1. テキストエリアにClaudeへの依頼を書く
2. **「送信」** → すぐにClaudeに送信される
3. **「下書き」** → ローカルに保存（クレジット制限中でも保存できる）
4. レート制限エラーの場合 → 自動的に再試行カウントダウンが始まる
5. 返信が届いたら → ブラウザ通知 + 「回答を見る」で確認

## 注意

- このアプリはClaude.aiのサブスクリプションとは別に、**Anthropic API** を使います
- APIキーはブラウザのlocalStorageにのみ保存されます（サーバーには送信されません）
- Vercelにデプロイして環境変数に設定した場合は、キーを画面に入力する必要はありません
