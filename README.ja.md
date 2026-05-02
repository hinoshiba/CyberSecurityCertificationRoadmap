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

> **PR は (a) `data/certs/` 以下の資格 JSON と、(b) `.claude/skills/` 以下の
> 評価スキル のみを変更対象とします。**
>
> 本プロジェクトは AI を独立した第三者評価者として全幅の信頼を置きます。
> 資格の**事実情報** (ベンダ、公式 URL、試験ロジスティクス、加点要素・減点
> 要素、第三者評価、ソースリンク) は人間が JSON に記載しますが、資格の
> **階層** (Foundational / Associate / Professional / Expert / Specialty)
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

Issue は何でも歓迎します。**PR は data と skills のみに限定**してください。

| やりたいこと                       | Issue テンプレート                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 資格を追加したい                   | [Add a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-certification.yml)   |
| 既存資格の情報を更新したい         | [Update a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=update-certification.yml) |
| 公的機関のソースを追加したい       | [Add a source agency](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-source-agency.yml)   |
| 階層判定に異議がある               | [Report an evaluation issue](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=report-evaluation-issue.yml) |

`respond-to-issue` スキルが Issue を拾って PR の下書きを作成します。

---

## ローカル実行

すべての操作は Docker 経由で行えます。コンテナは `~/.claude*` と `~/.codex`
を read-write でマウントし、Claude Code / Codex CLI がそのまま使えます。

```sh
make shell      # コンテナ内シェル (claude / codex 利用可)
make serve      # http://localhost:8080 で静的サイトを配信
make validate   # data/certs 配下の JSON をスキーマ検証
make evaluate   # 3 ペルソナ評価スキルを実行
```

詳細なマウント設定は `docker-compose.yml` を参照してください。

---

## ライセンス

MIT &mdash; [LICENSE](./LICENSE) および [NOTICE](./NOTICE) を参照。
