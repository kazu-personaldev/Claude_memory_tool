# Claude タスクメモ

Claude のクレジットが切れているあいだに「あとで頼みたいこと」をメモしておき、クレジットが回復したタイミングでワンクリックで実行できる Web アプリ。

## 使い方

1. 右上の設定アイコン → **Anthropic API キー** を入力して保存
2. テキストエリアに頼みたいことを書いて **「登録」**
3. クレジットが回復したら **「実行」** を押す → Claude が返答してくれる

## 機能

- タスクの登録・削除・実行
- 複数タスクをまとめて「すべて実行」
- モデル選択（Opus / Sonnet / Haiku）
- レスポンスのコピー
- データはブラウザのローカルストレージに保存（サーバー不要）
- PC・スマホ両対応のレスポンシブデザイン

## GitHub Pages で使う

1. このリポジトリを fork する
2. Settings → Pages → Source: `main` branch `/root` を選択して Save
3. `https://<your-username>.github.io/Claude_memory_tool/` にアクセス

## ローカルで使う

```bash
# リポジトリをクローン
git clone https://github.com/kazu-personaldev/Claude_memory_tool.git
cd Claude_memory_tool

# index.html をブラウザで直接開くだけでOK
open index.html
```

## 注意事項

- API キーはブラウザのローカルストレージに保存されます（外部サーバーには送信されません）
- Claude API の使用料金は Anthropic のアカウントに課金されます（Claude.ai のクレジットとは別）
