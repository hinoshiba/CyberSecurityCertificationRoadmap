# Cloudflare deployment / Cloudflare公開手順

The roadmap is a static asset Worker built from this repository's `main`
branch. Its existing public URL is
`https://www.hinoshiba.com/CyberSecurityCertificationRoadmap/`.
The homepage has its own Worker and repository. This PR prepares the roadmap
repository; it does not create an account-side Git integration or deploy production.

## 初回の設定

1. このPRを `main` にマージする。
2. Cloudflareの **Workers & Pages** で **Worker** を作成し、GitHubの
   `hinoshiba/CyberSecurityCertificationRoadmap` を接続する。
   既存のHP用Workerのリポジトリ設定は変更しない。
3. 以下を設定してビルド・デプロイする。

| 設定 / Setting | 値 / Value |
| --- | --- |
| Worker name | `cyber-security-certification-roadmap` |
| Repository | `hinoshiba/CyberSecurityCertificationRoadmap` |
| Production branch | `main` |
| Root directory | リポジトリルート（空欄または `/`） |
| Build command | `npm ci && npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| Node.js | 22.12.0以上（`.node-version` は22系） |

`http_dist/` はビルド後に作られる配布物です。Root directoryには設定しません。
Wranglerのバージョンは `package-lock.json` で固定しています。
本番以外のブランチで `wrangler deploy` を実行すると同じWorkerを更新するため、
まずは `main` の本番ビルドだけを有効にしてください。

4. `hinoshiba.com` が同じCloudflareアカウントの有効なzoneで、
   `www.hinoshiba.com` がプロキシ済みDNSになっていることを確認する。
   HP用WorkerのCustom Domain `www.hinoshiba.com` は維持する。
5. `wrangler deploy` が `wrangler.jsonc` のRouteを登録する。
   **Settings → Domains & Routes** で、次のRouteを確認する。

   ```text
   www.hinoshiba.com/CyberSecurityCertificationRoadmap*
   ```

   ビルド用トークンにはWorkerのデプロイ権限に加え、対象zoneの
   **Workers Routes: Edit** が必要です。Route登録が権限不足で失敗した場合は、
   Cloudflareのビルド用トークン設定を修正して再実行してください。
   トークンをリポジトリへ保存する必要はありません。

Routeは同じhostnameのCustom Domainより優先されます。このパスをロードマップ用
Workerへ送り、それ以外のHPページは従来のHP用Workerが配信します。
ロードマップ用Workerに `www.hinoshiba.com` 全体のCustom Domainを登録しないでください。

## URLと配布内容

- `assets.base_path` は `/CyberSecurityCertificationRoadmap`。
  `http_dist/index.html` が既存のサブパスで配信されます。
- `/CyberSecurityCertificationRoadmap/` は `index.html` への内部rewrite（200）。
  `/CyberSecurityCertificationRoadmap/index.html` もそのまま閲覧できます。
- 末尾 `/` のないURLは308で `/` 付きに揃え、`theme`、`lang`、`jp`、`cert` などの
  クエリ文字列を保ちます。HTML内の相対URLは変更しません。
- Route末尾は `/` なしの `*` です。CloudflareのRouteはクエリ文字列まで照合するため、
  これで末尾 `/` のない `...Roadmap?theme=light` も受け取れます。
  このRouteは同じ文字列から始まる別パスにも一致しますが、assetのbase pathは厳密なため、
  `...Roadmap-other/` などは404になり、ロードマップを返しません。
  将来この接頭辞を持つ別アプリを置く場合は、Route設計を見直してください。
- SPA fallbackは使いません。不明なファイルや資格JSONは404になります。
- 公開対象は `index.html`、`assets/`、`data/`、`LICENSE`、`NOTICE` のみ。
  `_redirects` はビルドで生成する配信設定です。
  `.git/`、スキル、Docker設定、スクリプトなどはアップロードしません。
- ビルドは全資格JSONとmanifestのパス・ID・ハッシュ・網羅性を検証します。
  内容や階層評価を変更せず、ソースファイルと同じbytesを配布します。
- `assets/version.json` のSHA・ビルド時刻・データ最終変更日は生成先だけに書きます。
  浅いGit履歴では最終変更日を証明できないため `dataset_updated: "unknown"` にします。
  通常のビルドは履歴や外部データをネットワーク取得しません。

## 検証

Node.js 22.12.0以上で、リポジトリルートから実行します。

```sh
npm ci
npm run build:cloudflare
npm run check:cloudflare
npx wrangler deploy --dry-run
```

`check:cloudflare` は認証やデプロイをせず、ローカルのWranglerで以下を確認します。

- 既存のディレクトリURLと `index.html` の200
- 末尾 `/` の追加とクエリ保持
- 全CSS・JS・画像・データのHTTP応答、bytes、主なContent-Type
- 全manifest記載の資格JSONとビルド情報
- HEAD、存在しないパス、公開対象外ファイル、base path外の404

Dockerでも `make cloudflare-check` で同じ検証を実行できます。
資格データを変更する場合の `make validate` / `make manifest` / `make check-eval`
は従来通りです。GitHubのデータ検証workflowは残し、Pagesデプロイworkflowだけを削除しています。

## 公開後の確認

以下をブラウザで確認してください。デプロイ・Route登録の完了までは旧URLは復旧しません。

- `https://www.hinoshiba.com/CyberSecurityCertificationRoadmap/?theme=light&lang=en&jp=1`
- `https://www.hinoshiba.com/CyberSecurityCertificationRoadmap?theme=light&lang=en&jp=1`
- `https://www.hinoshiba.com/CyberSecurityCertificationRoadmap/index.html`
- 資格一覧が読み込まれ、検索、資格の選択、日本資格・言語・テーマの切り替えが動くこと
- `https://www.hinoshiba.com/` と既存のブログURLが引き続きHP用Workerから配信されること

Workerの `workers.dev` プレビューでも、ルートではなく
`/CyberSecurityCertificationRoadmap/` を開いてください。

不具合があればロードマップ用Workerの **Deployments** から正常なversionへ戻します。
Routeは維持します。初回デプロイで正常なversionがまだない場合は設定・ビルドログを確認し、
応急案内には既存の `https://hinoshiba.github.io/CyberSecurityCertificationRoadmap/`
の配信状態を確認して使えます。Pages workflowの削除自体では既存のPages配信設定は変わりませんが、
今後そのURLへ自動デプロイはされません。

## Official references

- [Cloudflare Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Routes: precedence, query matching and setup](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Serving a subdirectory with assets.base_path](https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/)
- [Static asset redirects and rewrites](https://developers.cloudflare.com/workers/static-assets/redirects/)

English setup summary: merge to `main`, connect this repository to a new Worker
named `cyber-security-certification-roadmap`, build from the repository root with
`npm ci && npm run build:cloudflare`, and deploy with `npx wrangler deploy`.
The configured path Route takes precedence over the homepage's existing Custom
Domain; keep that Custom Domain on the homepage Worker. The build token needs
permission to deploy Workers and edit Workers Routes in the `hinoshiba.com` zone.
Verify the original URL, query settings, all data loading, and the homepage after deployment.
