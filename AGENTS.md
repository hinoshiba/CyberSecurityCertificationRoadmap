AGENTS.md

- Security Certification Roadmap that is https://pauljerimy.com/security-certification-roadmap/ をリスペクトしたプロジェクト
- ライセンスは CC BY-SA 4.0 とする。リポジトリ全体 (コード + データ) を ShareAlike で公開し、改善が常にコミュニティに還元される構造にする。Paul Jerimy 等のリソースは調査の上、問題がない形で引用し、リスペクトを記入する
- 出現する資格は、上記やhttps://cyberdudekz.github.io/security-cert-roadmap/ を参照しつつ、全く新しい資格一覧を作成する
- Cloudflare Workers Buildsで公開する静的サイト。データ構造としてはjsonをベンダや資格として階層毎に保持し、JavaScriptで動的に読み込む。相対URLを維持し、静的プレビューでも動作させる。
- READMEやISSUEを受け付けるドキュメントをREADMEに記入し、index.htmlはリポジトリをリンクする
    - READMEは、英語をベースとし、日本語も追加しておく
- 日本資格有りモード/なしモードを追加しておく。
    - SEA/J, IPA 等の資格を、日本の公的情報をもとに追加する

- 各Issueや資格の更新については、AIが対応することを前提にskills等を用意しておく
    - 追加する資格については、インターネット上の公式ドキュメントを参照し、正確な情報をもとに追加する
    - ロードマップ、前後関係については、公式ドキュメントに加えて、第三者機関の評価がある場合、そちらも参照する
    - レベルについては、第三者機関やインターネット上の信頼できる評判を優先とする
- プロジェクトの根幹
    - PRする対象はレベル自体を評価するskillsや資格を構成するjsonのみとする。第三者としてのAIによる改修に全幅の信頼を置き、AIによって第三者視点で評価された資格の順序として追加する。これは重要なポイントであるので、READMEにも明記する
        - よって、変更の際にいじるべきは、資格を構成するjsonをいじることが重要
            - 加点要素、減点要素も全てjsonに書くが、要素からどのように加点や減点をするかはAI次第とする
        - 公的機関の評価情報もソースとして追加できることが望ましい。そのようなインタフェースも追加する
- 品質の劣化を防ぐべく、更新前後のロードマップを3つの別なペルソナで評価し、失敗するようであれば、skillsの編集は再度見直すように設計する
- 全ての操作はdocker経由で行えるように作成し、~/.Codex* や~/.codex をrwでmountして利用する

## 公開・ホスティング

- 本番URLは `https://www.hinoshiba.com/CyberSecurityCertificationRoadmap/`。HP本体とは別のWorker・別のGit連携で配信し、既存パスと表示設定のクエリパラメータを維持する。
- 所有者が依頼したホスティング保守は、上記の資格JSON・評価スキルのPR範囲とは別に扱う。資格データや階層評価を変更しない。
- Node.js 22.12.0以上とコミット済みlockfileを使い、リポジトリルートで `npm ci && npm run build:cloudflare`。生成先 `http_dist/` をコミットしたり、CloudflareのRoot directoryに設定したりしない。
- 公開対象は `index.html`、`assets/`、`data/`、`LICENSE`、`NOTICE`。管理用ファイル・スキル・ローカル認証情報を公開しない。
- `wrangler.jsonc` の名前・Route・`assets.base_path` を保つ。末尾 `/` なしのクエリ付きURLも拾うため、Routeは `www.hinoshiba.com/CyberSecurityCertificationRoadmap*`。HTML補正やSPA fallbackを有効にせず、生成する `_redirects` で末尾 `/` と `index.html` を処理する。
- デプロイはCloudflare Workers Buildsが担当する。データ検証用の既存GitHub Actionsはデプロイを行わない。
- 変更後は `npm run build:cloudflare`、`npm run check:cloudflare`、`npx wrangler deploy --dry-run` を確認する。Dockerでは `make cloudflare-check` を利用できる。
- `assets/version.json` のソースは開発用のままにし、公開用のコミット情報・ビルド日時だけを生成先へ書く。浅いGit履歴でデータ最終更新日を推測しない。
- Git連携と初回公開手順は `docs/cloudflare.md` を参照。PRのマージだけで未作成のWorkerやGit連携が自動作成されるとは案内しない。

