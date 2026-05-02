#!/usr/bin/env python3
"""
Append cross-vendor *community-reputation* edges to
`prerequisites.recommended_certs[]`.

These are NOT official prerequisites and NOT same-vendor ladder steps.
They are well-known third-party / community study paths — e.g. SEA/J
holders frequently pursue IPA FE next; CompTIA Security+ is widely used
as a CISSP prep foundation; CEH → OSCP is the classic "theory → hands-on"
progression.

Provenance rules:
  * Each entry is stamped `source: "community"` with a `rationale`
    string in Japanese (the renderer/UI is bilingual, but the user-facing
    rationale stays close to the source language of the cert ecosystem
    being described).
  * Never overwrites an existing entry — official-recommended /
    vendor-ladder always win when both rules would produce the same edge.
  * Never adds an edge if the target already has the source as a
    `required_certs` entry.
  * Skips entries pointing to certs not in the roadmap.

Run AFTER `migrate_prereqs_v2.py` and `infer_relationships.py`. Re-run
`build_manifest.py` afterward.

Usage:
  python3 scripts/add_community_relationships.py --dry-run
  python3 scripts/add_community_relationships.py
"""
import argparse
import copy
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"


# (src_cert_id, tgt_cert_id, rationale)
# rationale is shown verbatim in the detail panel under the recommended
# entry. Keep concise — 1 sentence, 80–140 chars typical.
COMMUNITY_FLOWS = [
    # ---------------- JP ecosystem ----------------
    # SEA/J → IPA bridge (the canonical example the user asked about)
    ("seaj.csbm", "ipa.sc",
     "SEA/J CSBM のセキュリティ運用管理知識は、IPA 情報処理安全確保支援士 (SC) の午前II〜午後の管理系設問の前提知識と重複範囲が広い。"),
    ("seaj.cspm-technical", "ipa.sc",
     "TLS / 鍵管理 / セキュア実装といった CSPM 技術コースの内容は、SC 午後 I/II の技術系出題に直結する定番ルート。"),
    ("seaj.cspm-management", "ipa.riss",
     "CSPM Management の運用統制内容が、情報処理安全確保支援士 (RISS) の業務遂行領域と直接重なる。"),
    ("ipa.sg", "seaj.csbm",
     "情報セキュリティマネジメント (SG) で得た一般リテラシーから、CSBM で運用実務へ拡張する社会人定番ルート。"),
    ("ipa.fe", "seaj.csbm",
     "FE 取得後にセキュリティ実務寄りの知識を補完する追加学習として日本企業内で広く採用されている。"),

    # IPA → 国際資格 への橋渡し
    ("ipa.ap", "isc2.cissp",
     "応用情報技術者 (AP) の出題範囲は CISSP 8 ドメインの相当部分を国内向けに先取り。CISSP の下地として国内エンジニアが選ぶ定番。"),
    ("ipa.sc", "isc2.cissp",
     "SC ホルダーが英語圏業務 / グローバル案件を視野に入れる際の自然な次段。脅威モデル・セキュア設計の語彙が共通する。"),
    ("ipa.sc", "comptia.security-plus",
     "Security+ は SC 取得者が国際的な英語ベースの基礎資格として追加することが多い。"),
    ("ipa.nw", "cisco.ccna",
     "ベンダ中立な NW (ネットワークスペシャリスト) に対し、CCNA は Cisco 機器中心の実装知識を補う組み合わせとして人気。"),
    ("ipa.nw", "comptia.network-plus",
     "国際的に通用するネットワーク基礎の英語ベンチマークとして、NW 取得者が追加するパターン。"),
    ("ipa.riss", "isc2.cissp",
     "RISS 保有のコンサルタントが、国際案件向けの肩書として CISSP を併用するケースが多い。"),
    ("ipa.ap", "aws.saa-c03",
     "国家資格 AP ＋ AWS SAA は日本の SI 企業で「国内基礎 + クラウド実装」の標準的なペアリングとして定着。"),
    ("ipa.sc", "aws.security-specialty",
     "セキュリティ専門知識をクラウド実装側に拡張するパスとして広く採用される。"),

    # ---------------- CompTIA → 上位 ----------------
    ("comptia.security-plus", "isc2.cissp",
     "Security+ は CISSP 8 ドメインの導入として広く活用され、CISSP 学習の事前知識基盤として推奨されることが多い。"),
    ("comptia.security-plus", "ec-council.ceh",
     "Security+ で守備側基礎を固めた後、CEH で攻撃手法体系を学ぶエントリーレベルの定番パス。"),
    ("comptia.network-plus", "cisco.ccna",
     "ベンダ中立基礎から Cisco 実装中心の同領域資格へ、と進むのは入門ネットワークエンジニアの定番。"),
    ("comptia.pentest-plus", "offsec.oscp",
     "理論寄り PenTest+ から、業界標準の実技重視 OSCP へ進むのが攻撃側キャリアのテンプレート。"),
    ("comptia.cysa-plus", "giac.gcih",
     "CySA+ で SOC アナリストの素養を得てから GCIH で SANS グレードのインシデントハンドリング深度へ。"),
    ("comptia.cysa-plus", "giac.gcfa",
     "アナリストからフォレンジック専門領域へ展開する自然なステップアップ。"),
    ("isc2.cc", "comptia.security-plus",
     "ISC2 CC の入門知識を、業界標準のアソシエイト級 Security+ に橋渡しする一般的な進級経路。"),

    # ---------------- クラウド ----------------
    ("aws.clf-c02", "aws.security-specialty",
     "クラウド入門 → セキュリティ深掘りは AWS 公式ロードマップ上の典型ルート。Specialty 学習者の多くは CLF を経由。"),
    ("isc2.ccsp", "aws.security-specialty",
     "CCSP のクラウドセキュリティ理論基盤を、AWS 固有の実装知識に展開するパス。"),
    ("isc2.ccsp", "microsoft.sc-100",
     "ベンダ中立クラウド設計の知見を、Microsoft 環境のセキュリティアーキテクト視点へ展開。"),
    ("csa.ccsk-v5", "aws.security-specialty",
     "ベンダ中立 CCSK で得たクラウドセキュリティ原則を AWS 固有実装にマッピングするのは王道学習順序。"),
    ("microsoft.sc-900", "isc2.cc",
     "ベンダ寄り入門 SC-900 から、ベンダ中立な ISC2 CC へ — 入門学習者の進級ルート。"),
    ("microsoft.sc-900", "comptia.security-plus",
     "Microsoft 入門で語彙を得た後に業界標準ベンチマークの Security+ で深化させるパターン。"),
    ("microsoft.az-900", "aws.clf-c02",
     "クロスクラウド・リテラシー獲得を目的に、両主要パブリッククラウドの入門資格を併取するのは技術リーダーの定番。"),

    # ---------------- 攻撃側 ----------------
    ("ec-council.ceh", "offsec.oscp",
     "理論寄り CEH から実技中心 OSCP への進級は、攻撃側エンジニアキャリアの最も典型的な「理論→実践」ステップ。"),
    ("ec-council.chfi", "giac.gcfa",
     "ベンダニュートラル CHFI のフォレンジック理論を、SANS グレードの GCFA で実務深度に拡張。"),
    ("offsec.oscp", "giac.gpen",
     "OSCP と GPEN は同領域の権威ルート。両資格併取は攻撃側コンサル / レッドチーマーが顧客に対する信頼性を多重化する手法。"),
    ("hackthebox.cpts", "offsec.oscp",
     "CPTS は実技ベースで OSCP に近い評価を持つが、業界標準 / 米国 DoD 8140 認定の OSCP を追加する人は多い。"),
    ("tcm-security.pjpt", "offsec.oscp",
     "低コスト実技 PJPT で実技の感覚を掴んでから、業界標準 OSCP に挑む経済的な進級パス。"),
    ("tcm-security.pnpt", "offsec.oscp",
     "ネットワークペンテスト PNPT で AD 攻撃を体験した後、業界標準資格として OSCP を追加する流れ。"),
    ("ine.ejpt", "offsec.oscp",
     "ジュニア向け eJPT を経て、業界標準 OSCP に進むのは予算・時間が限られた学習者の定番ルート。"),
    ("ine.ecppt", "offsec.oscp",
     "INE 系の実技ペンテスト学習からの自然な「業界標準への昇格」。"),
    ("ine.ewpt", "offsec.oswe",
     "Web アプリペンテストの軽量入門 (eWPT) → 重量級ホワイトボックス OSWE という Web 攻撃側の段階的進級。"),

    # ---------------- 防御側 / SOC ----------------
    ("hackthebox.cdsa", "giac.gcih",
     "ブルーチームアナリスト CDSA → SANS グレードのインシデントハンドリング深度 GCIH へ — 防御側深掘りの定番。"),
    ("comptia.cysa-plus", "hackthebox.cdsa",
     "理論寄り CySA+ から、HackTheBox の実技ベース CDSA で SOC 実務感覚を養うパス。"),

    # ---------------- マネジメント / ガバナンス ----------------
    ("isc2.cissp", "isaca.cisa",
     "セキュリティ全般の CISSP から、監査領域への横展開として CISA を取得するキャリアパス。"),
    ("isc2.cissp", "isaca.cism",
     "技術寄りの CISSP から、管理職向けの CISM へ横展開するのはセキュリティリーダー候補の定番。"),
    ("isaca.crisc", "isc2.cissp",
     "リスク管理 CRISC ホルダーが、より広範な技術 + 設計の語彙を得るために CISSP を追加するパターン。"),
    ("isaca.cism", "isc2.issmp",
     "管理職向け CISM 取得後、ISC2 側の管理者特化 CISSP-ISSMP を併取するシニア層の組み合わせ。"),
    ("isaca.cisa", "isc2.cgrc",
     "監査の CISA から、ガバナンス・リスク・コンプライアンス特化の CGRC への横展開。"),

    # ---------------- ICS/OT ----------------
    ("giac.gicsp", "isa.iec-62443-cf",
     "GICSP で得た ICS セキュリティの基礎を、IEC 62443 の体系的な国際規格知識で補強する OT 専門家の定番。"),

    # ---------------- セキュア開発 ----------------
    ("isc2.csslp", "giac.gcsa",
     "セキュア SDLC の CSSLP から、クラウドセキュリティオートメーションの GCSA へ — DevSecOps エンジニアの組み合わせ。"),
]


def load_certs():
    out = {}
    for path in sorted(CERTS_DIR.glob("*/*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        out[d["id"]] = (path, d)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Print summary, do not write files.")
    args = ap.parse_args()

    certs = load_certs()

    # Build per-target list of community proposals.
    by_target = {}
    skipped = []
    for src, tgt, rationale in COMMUNITY_FLOWS:
        if src not in certs:
            skipped.append((src, tgt, "src missing"))
            continue
        if tgt not in certs:
            skipped.append((src, tgt, "tgt missing"))
            continue
        by_target.setdefault(tgt, []).append((src, rationale))

    changes = []  # (cert_id, additions)
    for tgt_id, props in by_target.items():
        path, data = certs[tgt_id]
        prereqs = data.setdefault("prerequisites", {})
        existing_recs = list(prereqs.get("recommended_certs") or [])
        existing_recs_ids = {e["id"] for e in existing_recs}
        existing_required_ids = {e["id"] for e in (prereqs.get("required_certs") or [])}

        adds = []
        for src, rationale in props:
            if src in existing_required_ids:
                continue  # already a hard prereq
            if src in existing_recs_ids:
                continue  # already covered by official / ladder
            adds.append({
                "id": src,
                "source": "community",
                "rationale": rationale,
            })
        if not adds:
            continue

        new_recs = sorted(existing_recs + adds, key=lambda e: e["id"])
        prereqs["recommended_certs"] = new_recs
        changes.append((tgt_id, adds))

    if not changes:
        print(f"No community edges to add. (Skipped {len(skipped)} due to missing certs.)")
        return 0

    print(f"{len(changes)} certs would gain community edges:\n")
    for tgt_id, adds in changes:
        print(f"  {tgt_id}")
        for a in adds:
            print(f"    + {a['id']:35s} {a['rationale'][:70]}{'…' if len(a['rationale']) > 70 else ''}")

    if skipped:
        print(f"\nSkipped {len(skipped)} edges due to missing certs:")
        for src, tgt, why in skipped:
            print(f"  - {src} → {tgt}  ({why})")

    if args.dry_run:
        print("\n(dry-run; no files written.)")
        return 0

    for tgt_id, _adds in changes:
        path, data = certs[tgt_id]
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nApplied to {len(changes)} cert files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
