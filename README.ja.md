# サイバーセキュリティ資格ロードマップ

> 第三者AIが評価する、独自に編纂したセキュリティ資格ロードマップ。
> GitHub Pages で公開する静的サイト。資格の事実情報は JSON に保持し、
> 階層 (tier) は AI ペルソナが事実情報から算出します。

[**ロードマップを開く →** https://hinoshiba.github.io/CyberSecurityCertificationRoadmap/](https://hinoshiba.github.io/CyberSecurityCertificationRoadmap/)

English version: [README.md](./README.md)

---

## インスピレーションと謝辞

本プロジェクトは以下の公開された素晴らしい先行プロジェクトをリスペクトし、
インスピレーションを受けています。

- [Paul Jerimy's Security Certification Roadmap](https://pauljerimy.com/security-certification-roadmap/)
- [CyberDudeKZ's Security Cert Roadmap](https://cyberdudekz.github.io/security-cert-roadmap/)

本リポジトリにおける**資格一覧、ドメイン分類、階層ルーブリック、スキーマ、
UI はすべて独自に作成しています。両プロジェクトのデータ、レイアウト、コード、
画像のいずれも複製していません**。詳細は [NOTICE](./NOTICE) を参照してください。

日本資格 (IPA, SEA/J 等) については、IPA・経済産業省 (METI)・JPCERT/CC・
NISC など日本の公的機関の情報を一次ソースとします。

---

## プロジェクトの根幹: 第三者評価者としての AI

これが本プロジェクトの最重要ルールであり、ワークフローが他のリポジトリと
異なる理由です。

> **資格情報・順位に関する PR は、`data/` 以下の資格データと、
> `.claude/skills/` または `.agents/skills/` 以下の評価スキルのみを変更対象とします。**
> フロントエンド・運用基盤の保守は、明示的に承認された独立した PR として行い、
> 資格の階層を手動で変更しません。
>
> 本プロジェクトは AI を独立した第三者評価者として全幅の信頼を置きます。
> 資格の**事実情報** (ベンダ、公式 URL、試験ロジスティクス、加点要素・減点
> 要素、第三者評価、ソースリンク) は人間が JSON に記載しますが、資格の
> **階層** (Introductory / Foundational / Associate / Professional / Expert / Specialty)
> はそれらの事実情報から `evaluate-roadmap-3-personas` スキルが**算出**
> します。資格毎に手動で階層を設定することはしません。

これによって以下の二つの性質が得られます。

1. **再現可能**: 誰が評価スキルを再実行しても同じ階層になる。階層への異論
   は「事実情報が違う」「ルーブリックを直すべき」といった会話になり、
   主観の言い合いにならない。
2. **監査可能**: 加点/減点の根拠 URL がデータに永続的に残る。「なぜ Expert
   なのか?」に対して常にルーブリックと要素が答えてくれる。

加点・減点の `weight_hint` は JSON に書きますが、それを階層へ変換するの
は評価スキル側の責務です。JSON の責務ではありません。

階層に異議がある場合は、

- 加点/減点要素を変えるべき新しい根拠を Issue として提出する、または
- ルーブリック自体に問題があるなら
  `.claude/skills/evaluate-roadmap-3-personas/SKILL.md` への変更案を出す、

のいずれかでお願いします。

品質は **3 つの異なるペルソナ** (日本企業 CISO、米国 MSSP 採用マネージャ、
欧州オフェンシブコンサルタント) によって担保されます。3 ペルソナの判定が
全資格の 10% を超えて 1 階層以上ずれた場合、評価実行は失敗扱いとし、デー
タではなく**ルーブリックの見直し**を促します。

---

## コントリビュート

Issue は何でも歓迎します。**資格情報・順位に関する PR は data と skills のみに限定**してください。
フロントエンドの保守はメンテナと相談し、明示的に承認された独立した PR として扱います。
詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

| やりたいこと                       | Issue テンプレート                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 資格を追加したい                   | [Add a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-certification.yml)   |
| 既存資格の情報を更新したい         | [Update a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=update-certification.yml) |
| 公的機関のソースを追加したい       | [Add a source agency](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-source-agency.yml)   |
| 階層判定に異議がある               | [Report an evaluation issue](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=report-evaluation-issue.yml) |

`respond-to-issue` スキルが Issue を拾って PR の下書きを作成します。

---

## ロードマップの使い方

初期表示のマップでは、12 分野と 6 つの階層区分を同時に見渡せます。
セルを選ぶと、全体図を残したまま、該当する分野・階層の資格を読みやすい
カードで確認できます。資格名の表示を有効にすると、マップ内の資格を一覧できます。
画面が狭い場合の横スクロールはマップ内に収まります。

略称・正式名称・ベンダ名で検索できます。探索表示に切り替えるとカードを中心に
閲覧できます。分野・階層で絞り込み、フィルターからベンダを選択し、
階層・名前・ベンダ順で並べ替えられます。スマートフォンでは、デスクトップの
サイドバーに代わる分野選択欄を使用します。

資格を開くと、正式名称、試験情報、必須資格、取得順の推奨、次の候補、
AI 評価と根拠を確認できます。必須資格と推奨は異なり、コミュニティによる
推奨は公式な受験・認定要件ではありません。スペシャリティは専門領域の区分であり、
エキスパートより上の階層ではありません。

表示言語の日本語化と、日本限定資格の表示は別々に切り替えられます。
ライト・ダークテーマに対応し、フィルターと選択状態は URL に保存されるため、
ブックマーク・共有ができます。既存の URL パラメーターも引き続き利用できます。

| パラメーター | 内容 |
| --- | --- |
| `q` | 検索語 |
| `d` | 分野 ID |
| `level` | `data/tiers.json` の階層 ID |
| `view` | `explore` または `map` |
| `sort` | `level`、`name`、`vendor` |
| `names=1` | ロードマップ内に資格名を展開 |
| `v` | ベンダの slug をカンマ区切りで指定。省略は全件、空文字は選択なし |
| `jp` | `1` で日本限定資格を含める |
| `lang` | `en` または `ja`。`jp` とは独立 |
| `theme` | `light` または `dark` |
| `cert` | `isc2.cissp` など、選択する資格の ID |
| `vt` | 既存のベンダ保有資格数による強調しきい値 |

例: `?q=security&d=cloud-security&view=explore&lang=ja` は、クラウドセキュリティ
分野の検索を日本語表示で開きます。再設計の要件とレビュー記録は
[docs/ux-review.md](./docs/ux-review.md) にまとめています。

---

## ローカル実行

開発操作は Docker 経由で行えます。編集用コンテナは `~/.claude*` と `~/.codex`
を read-write でマウントし、Claude Code / Codex CLI が使えます。
プレビュー・UI 検証用コンテナはリポジトリを読み取り専用でマウントし、
編集用の認証情報を使用しません。

```sh
make shell      # コンテナ内シェル (claude / codex 利用可)
make serve      # http://localhost:8080 で静的サイトを配信
make test-ui    # フロントエンドの構文・アセット・UI ロジックを検証 (Node 22)
make validate   # data/certs 配下の JSON をスキーマ検証
make manifest   # 資格インデックスを決定的に再生成
make check-eval # AI 評価の欠損・期限超過を検証
make evaluate   # 3 ペルソナ評価スキルを実行
```

Docker を起動してから実行してください。詳細なマウント設定は
`docker-compose.yml` を参照してください。Node.js 22 がある場合は、
`npm run check` と `npm test` でもフロントエンドを検証できます。
追加依存がないため `npm install` は不要です。ロジックの検証に加え、
ブラウザーでの操作・表示レビューも実施してください。

### GitHub Pages

JavaScript の標準モジュールで動く静的サイトです。バンドル、アプリケーションの
ビルド、バックエンド、実行時のパッケージ依存はありません。リポジトリのルートを
HTTP で配信してください。`file://` で `index.html` を直接開く方法では JSON を
読み込めません。Pages ワークフローは `main` への push 後にリポジトリのルートを
公開し、`assets/version.json` にコミットとデータ更新日を記録します。
相対パスのアセットとクエリ文字列による画面状態により、URL の書き換え設定なしで
ドメイン直下・`/CyberSecurityCertificationRoadmap/` 配下の両方に対応します。

---

## ライセンス

**[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.ja)** &mdash; リポジトリ全体に適用されます。すなわち、キュレーションされたデータセット (`data/**/*.json` &mdash; ベンダ・資格情報、ドメイン分類、ティア ルーブリック、ソース機関レジストリ、AI による評価とその根拠) と、周辺のコード (JS / Python / スキーマ / スキル / Docker / Actions / HTML / CSS) の両方を含みます。

商用利用を含め、共有・改変は自由に行えますが、(1) **帰属表示**を行い、(2) 派生物を**同一ライセンス** (ShareAlike) の下で公開する必要があります。ライセンス全文は [LICENSE](./LICENSE) を、選定理由・帰属表示の例・商標の取り扱いについては [NOTICE](./NOTICE) を参照してください。
