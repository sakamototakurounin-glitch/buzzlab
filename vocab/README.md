# VocabStar

静的なPWA本体と、少人数向けのユーザー名・パスワード認証APIです。

## 現在の保存方式と互換性

- 主データ: `localStorage` の `vocabstar_v3`
- 旧版データ: `vocabstar_v1`
- 復旧バックアップ: `vocabstar_recovery_backup_<日時>`
- ログイン情報: `vocabstar_account_session_v1`（ランダムな30日セッション）
- アカウント追加後も `vocabstar_v3` と `vocabstar_v1` は削除しません。
- クラウドには `vocabstar_v3` の内容（単語帳、重要度、お気に入り相当、画像、設定、学習履歴）と、旧版・復旧用の補助データをユーザー別に保存します。
- 初回ログイン時は、端末データをアップロードするか、クラウドデータを取得するかを必ず選びます。クラウドデータで端末表示を置き換える前に、元の端末データを `vocabstar_pre_cloud_backup_<日時>` として残します。

## 構成

- `index.html`: 既存アプリとアカウント画面
- `image-import.js`: 画像付きインポート
- `account.js`: ログイン、移行、同期
- `account-config.js`: Workerの公開URL（秘密情報ではありません）
- `worker/src/index.js`: Cloudflare Worker API
- `worker/schema.sql`: D1テーブル
- `worker/wrangler.toml`: Wrangler用設定例

パスワードはWorker内でランダムsalt付きPBKDF2-SHA-256（Cloudflare Workersの上限である100,000回）に変換し、平文は保存しません。セッショントークンもD1にはSHA-256ハッシュだけを保存します。GitHub側にAPIキーや秘密情報は置きません。

## Cloudflareを画面操作だけで設定する

1. Cloudflareへ無料登録し、ダッシュボードを開きます。
2. **Storage & databases → D1 SQL database → Create Database** を開き、名前を `vocabstar-db` にして作成します。場所を選べる場合は Asia Pacific が適しています。
3. 作成したDBの **Console** を開き、`worker/schema.sql` の全文を貼り付けて **Execute** を押します。
4. **Workers & Pages → Create application → Worker → Create Worker** を選び、名前を `vocabstar-api` にします。
5. Workerの **Edit code** を開き、`worker/src/index.js` の全文に置き換えて **Deploy** を押します。
6. Workerの **Settings → Bindings → Add binding → D1 database** を選びます。Variable nameを必ず `DB`、Databaseを `vocabstar-db` にして保存します。
7. **Settings → Variables and Secrets → Add** で、通常の変数 `ALLOWED_ORIGINS` を作ります。値はGitHub Pagesのオリジン（例 `https://example.github.io`）です。独自ドメインも使う場合はカンマ区切りで追加します。パス `/vocab/` は含めません。
8. Worker画面に表示される `https://vocabstar-api.<あなたのサブドメイン>.workers.dev` をコピーします。
9. `account-config.js` の `apiBaseUrl` にそのURLを入れ、`index.html`、`account.js`、`account-config.js`、`sw.js` を含む変更をGitHubへ反映します。
10. GitHubで **Settings → Pages → Build and deployment** を開き、現在使っている公開ブランチ/フォルダが選ばれていることを確認します。

Cloudflare公式の現在の画面手順は [D1 Getting started](https://developers.cloudflare.com/d1/get-started/) と [D1 binding](https://developers.cloudflare.com/d1/best-practices/remote-development/) にあります。GitHub Pagesの公開元は [GitHub Pagesの公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) を参照してください。

## Wranglerで設定する場合

`worker` フォルダで次を実行します。

```text
npx wrangler@latest login
npx wrangler@latest d1 create vocabstar-db --location=apac
npx wrangler@latest d1 execute vocabstar-db --remote --file=./schema.sql
npx wrangler@latest deploy
```

`d1 create` が返すDatabase IDを `wrangler.toml` に入れ、`ALLOWED_ORIGINS` の例も実際のGitHub Pagesオリジンへ変更してから実行します。

## 動作確認項目

1. 新規登録後、同じユーザー名の再登録が拒否される。
2. 正しい資格情報でログインでき、誤りは明確なエラーになる。
3. 単語・重要度・設定・学習結果が保存される。
4. ログアウト後も端末データは残り、APIセッションは失効する。
5. 同じユーザー名とパスワードで再ログインできる。
6. 空の別ブラウザ相当からログインし、クラウドデータを取得できる。
7. 既存 `vocabstar_v3` を明示操作で引き継げ、`vocabstar_v1` も消えない。

同期方式は少人数利用に合わせた「最後に保存した端末が優先」です。同じアカウントを二台で同時編集する運用は避けてください。
