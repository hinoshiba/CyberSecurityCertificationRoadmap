#!/usr/bin/env python3
"""
Propose `prerequisites.recommended_certs[]` edges across the roadmap from
neutral, evidence-based rules.

Each proposed edge carries a `source` tag so renderers can prioritize
official > inferred when capping the displayed graph:

  * official-recommended — vendor or recognized authority explicitly
    documents this prior cert as a recommended path. Sourced from the
    `OFFICIAL_RECOMMENDED_FLOWS` whitelist below; each entry there is
    backed by an official URL when applicable.
  * vendor-ladder        — implied by the same-vendor tier ladder rule
    (one tier below + shares a domain).
  * community            — third-party / industry reputation only. NOT
    proposed by this script. Populated by the
    `infer-cross-vendor-prereqs` skill (which curates entries like
    "SEA/J helps with IPA FE").

This script never touches `required_certs` (hard, human-curated) or
existing `community` recommendations — it only adds `vendor-ladder` and
`official-recommended` edges that are missing.

See .claude/skills/infer-relationships/SKILL.md for the full design.

Usage:
  python3 scripts/infer_relationships.py --dry-run    # print proposed diff
  python3 scripts/infer_relationships.py              # apply

After applying, re-run:
  python3 scripts/build_manifest.py
  python3 scripts/run_3_persona_eval.py
"""
import argparse
import copy
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
TIERS_PATH = ROOT / "data" / "tiers.json"


# Industry-conventional flows that are NOT picked up by the same-vendor
# ladder rule (either cross-vendor, or same-vendor but skipping the
# domain-share check). Each entry's source provenance is "official-
# recommended" — backed by a vendor / authority URL.
#
# Format: (src_id, tgt_id, optional_url_for_provenance)
OFFICIAL_RECOMMENDED_FLOWS = [
    # CompTIA ladder (vendor publishes recommended progression)
    ("comptia.network-plus",   "comptia.security-plus",  "https://www.comptia.org/certifications/security"),
    ("comptia.security-plus",  "comptia.cysa-plus",      "https://www.comptia.org/certifications/cybersecurity-analyst"),
    ("comptia.security-plus",  "comptia.pentest-plus",   "https://www.comptia.org/certifications/pentest"),
    ("comptia.cysa-plus",      "comptia.casp-plus",      "https://www.comptia.org/certifications/comptia-advanced-security-practitioner"),
    ("comptia.security-plus",  "isc2.sscp",              "https://www.isc2.org/Certifications/SSCP"),
    ("isc2.cc",                "comptia.security-plus",  None),

    # ISC2 family (CISSP is conventional foundation for the concentrations)
    ("isc2.cissp", "isc2.ccsp",  "https://www.isc2.org/Certifications/CCSP"),
    ("isc2.cissp", "isc2.issap", "https://www.isc2.org/Certifications/ISSAP"),
    ("isc2.cissp", "isc2.issep", "https://www.isc2.org/Certifications/ISSEP"),
    ("isc2.cissp", "isc2.issmp", "https://www.isc2.org/Certifications/ISSMP"),
    ("isc2.cissp", "isc2.csslp", "https://www.isc2.org/Certifications/CSSLP"),

    # OffSec offensive ladder (OSCP → 300-level → OSCE3 designation → OSEE apex)
    ("offsec.oscp",    "offsec.osep",  "https://www.offsec.com/courses/pen-300/"),
    ("offsec.oscp",    "offsec.oswe",  "https://www.offsec.com/courses/web-300/"),
    ("offsec.oscp",    "offsec.osed",  "https://www.offsec.com/courses/exp-301/"),
    ("offsec.osep",    "offsec.osce3", "https://www.offsec.com/courses-and-certifications/osce3/"),
    ("offsec.oswe",    "offsec.osce3", "https://www.offsec.com/courses-and-certifications/osce3/"),
    ("offsec.osed",    "offsec.osce3", "https://www.offsec.com/courses-and-certifications/osce3/"),
    ("offsec.osce3",   "offsec.osee",  "https://www.offsec.com/courses/exp-401/"),
    ("offsec.osed",    "offsec.osmr",  "https://www.offsec.com/courses/exp-312/"),
    ("offsec.oswa",    "offsec.oswe",  None),
    # OffSec defensive ladder
    ("offsec.osda",    "offsec.osth",  None),
    ("offsec.osda",    "offsec.osir",  None),
    # OffSec entry pathway
    ("offsec.oscc-sjd", "offsec.oscc-sec", None),
    ("offsec.oscc-sec", "offsec.oscp",     None),

    # Cisco
    ("cisco.cyberops-associate", "cisco.cyberops-professional", "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/cyberops/professional/index.html"),
    ("comptia.network-plus",     "cisco.cyberops-associate",    None),

    # GIAC / SANS (GSEC is SANS' conventional foundation before specialty GIAC)
    ("giac.gsec", "giac.gcih", "https://www.giac.org/certifications/certified-incident-handler-gcih/"),
    ("giac.gsec", "giac.gced", None),
    ("giac.gcih", "giac.gcfa", "https://www.giac.org/certifications/certified-forensic-analyst-gcfa/"),
    ("giac.gcfa", "giac.grem", "https://www.giac.org/certifications/reverse-engineering-malware-grem/"),
    ("giac.gcia", "giac.gnfa", None),
    ("giac.gpen", "giac.gxpn", None),

    # ISACA family
    ("isaca.cisa", "isaca.crisc", "https://www.isaca.org/credentialing/crisc"),
    ("isaca.cisa", "isaca.cism",  "https://www.isaca.org/credentialing/cism"),

    # Microsoft Security family (SC-100 is positioned as the apex)
    ("microsoft.sc-200", "microsoft.sc-100", "https://learn.microsoft.com/en-us/credentials/certifications/cybersecurity-architect-expert/"),
    ("microsoft.sc-300", "microsoft.sc-100", "https://learn.microsoft.com/en-us/credentials/certifications/cybersecurity-architect-expert/"),
    ("microsoft.az-500", "microsoft.sc-100", "https://learn.microsoft.com/en-us/credentials/certifications/cybersecurity-architect-expert/"),
    ("microsoft.sc-401", "microsoft.sc-100", None),

    # IPA ladder (per IPA-published skill levels)
    ("ipa.ip", "ipa.fe", "https://www.ipa.go.jp/shiken/kubun/fe.html"),
    ("ipa.fe", "ipa.ap", "https://www.ipa.go.jp/shiken/kubun/ap.html"),
    ("ipa.ap", "ipa.sc", "https://www.ipa.go.jp/shiken/kubun/sc.html"),
    ("ipa.sc", "ipa.riss", "https://www.ipa.go.jp/jinzai/riss/"),
    ("ipa.ap", "ipa.nw", None),
    ("ipa.ap", "ipa.db", None),
    ("ipa.ap", "ipa.es", None),
    ("ipa.ap", "ipa.sa", None),
    ("ipa.ap", "ipa.pm", None),
    ("ipa.ap", "ipa.au", None),
    ("ipa.ap", "ipa.st", None),
    ("ipa.ap", "ipa.sm", None),
    ("ipa.ap", "ipa.sg", None),

    # SEA/J ladder
    ("seaj.csbm", "seaj.cspm-management", None),
    ("seaj.csbm", "seaj.cspm-technical",  None),

    # JP school-age IT literacy → national engineer track
    ("zensho.jouhou-shori-2", "zensho.jouhou-shori-1", None),
    ("zensho.jouhou-shori-1", "ipa.ip",                None),
    ("jken.j-katsuyou",       "jken.j-system",         None),
    ("jken.j-katsuyou",       "jken.j-design",         None),
    ("jken.j-katsuyou",       "ipa.ip",                None),
    ("jken.j-system",         "ipa.fe",                None),

    # IAPP family
    ("iapp.cipp-e",  "iapp.cipm", None),
    ("iapp.cipp-us", "iapp.cipm", None),
    ("iapp.cipt",    "iapp.cipm", None),

    # ISA 62443 stack (fixed, sequential certificate program)
    ("isa.iec-62443-cf",  "isa.iec-62443-rds", "https://www.isa.org/certification/certificate-programs/isa-iec-62443-cybersecurity-certificate-program"),
    ("isa.iec-62443-rds", "isa.iec-62443-res", "https://www.isa.org/certification/certificate-programs/isa-iec-62443-cybersecurity-certificate-program"),
    ("isa.iec-62443-res", "isa.iec-62443-rse", "https://www.isa.org/certification/certificate-programs/isa-iec-62443-cybersecurity-certificate-program"),

    # CREST CHECK ladder
    ("crest.cpsa",  "crest.crt",     "https://www.crest-approved.org/skills-certifications-careers/crest-registered-tester/"),
    ("crest.crt",   "crest.cct-inf", "https://www.crest-approved.org/skills-certifications-careers/crest-certified-infrastructure-tester/"),
    ("crest.crt",   "crest.cct-app", "https://www.crest-approved.org/skills-certifications-careers/crest-certified-web-application-tester/"),

    # CSA cloud foundation → vendor cloud certs
    ("csa.ccsk-v5", "isc2.ccsp", "https://cloudsecurityalliance.org/education/ccsk"),

    # GICSP defensive ladder
    ("giac.gicsp", "giac.grid",          "https://www.giac.org/certifications/response-and-industrial-defense-grid/"),
    ("giac.gicsp", "isa.iec-62443-rds",  None),

    # OffSec OSWP wireless side-track
    ("offsec.oscp", "offsec.oswp", None),
]


def load_certs():
    out = {}
    for path in sorted(CERTS_DIR.glob("*/*.json")):
        d = json.loads(path.read_text(encoding="utf-8"))
        out[d["id"]] = (path, d)
    return out


def tier_ord(tiers_doc):
    return {t["id"]: t["order"] for t in tiers_doc["tiers"]}


def primary_and_secondary(cert):
    return {cert["domain"]} | set(cert.get("secondary_domains", []))


def is_one_step_below(a_tier, b_tier, t_ord):
    if a_tier is None or b_tier is None: return False
    if a_tier == "specialty" or b_tier == "specialty": return False
    return t_ord.get(a_tier, 99) - t_ord.get(b_tier, 99) == 1


def rec_id(entry):
    """Extract id from a recommended_certs entry (object form)."""
    if isinstance(entry, dict): return entry["id"]
    return entry  # legacy string form (shouldn't happen post-migration)


def transitively_reachable(start_id, certs):
    out = set()
    queue = [rec_id(e) for e in (certs[start_id][1].get("prerequisites") or {}).get("recommended_certs") or []]
    queue += [rec_id(e) for e in (certs[start_id][1].get("prerequisites") or {}).get("required_certs") or []]
    while queue:
        cur = queue.pop()
        if cur in out: continue
        out.add(cur)
        if cur in certs:
            queue.extend(rec_id(e) for e in (certs[cur][1].get("prerequisites") or {}).get("recommended_certs") or [])
            queue.extend(rec_id(e) for e in (certs[cur][1].get("prerequisites") or {}).get("required_certs") or [])
    return out


def propose_for_cert(cert_id, certs, t_ord):
    """Return (proposed_recommended_list, summary_of_changes)."""
    target_path, target = certs[cert_id]
    prereqs = target.get("prerequisites") or {}

    # Existing recommended_certs (already objects post-migration). Keep
    # `community` entries untouched — those come from the human-curated
    # cross-vendor reputation skill, not from us.
    existing = list(prereqs.get("recommended_certs") or [])
    by_id = {rec_id(e): e for e in existing}

    # Required certs are sacred — never overlap them in recommended.
    required_ids = {rec_id(e) for e in (prereqs.get("required_certs") or [])}

    target_tier = (target.get("evaluation") or {}).get("computed_tier")
    target_domains = primary_and_secondary(target)
    target_vendor = (target.get("vendor") or {}).get("slug")
    transitively = transitively_reachable(cert_id, certs)

    summary = []  # (id, action, note)

    def add(other_id, source, url=None):
        if other_id in required_ids: return
        if other_id == cert_id: return
        existing_entry = by_id.get(other_id)
        if existing_entry:
            # Don't downgrade community-curated entries.
            if existing_entry.get("source") == "community":
                return
            # Upgrade vendor-ladder → official-recommended if we have a URL.
            if existing_entry.get("source") == "vendor-ladder" and source == "official-recommended":
                existing_entry["source"] = "official-recommended"
                if url and "url" not in existing_entry:
                    existing_entry["url"] = url
                summary.append((other_id, "upgrade", "→ official-recommended"))
            return
        new_entry = {"id": other_id, "source": source}
        if url:
            new_entry["url"] = url
        by_id[other_id] = new_entry
        summary.append((other_id, "add", source))

    # Rule 1: same-vendor ladder, EXACTLY one tier below, sharing a domain.
    for other_id, (_p, other) in certs.items():
        if other_id == cert_id: continue
        if (other.get("vendor") or {}).get("slug") != target_vendor: continue
        other_tier = (other.get("evaluation") or {}).get("computed_tier")
        if not is_one_step_below(other_tier, target_tier, t_ord): continue
        if not (primary_and_secondary(other) & target_domains): continue
        if other_id in transitively: continue
        add(other_id, "vendor-ladder")

    # Rule 2: official-recommended whitelist (cross-vendor or same-vendor
    # specials missed by Rule 1).
    for entry in OFFICIAL_RECOMMENDED_FLOWS:
        src, tgt = entry[0], entry[1]
        url = entry[2] if len(entry) > 2 else None
        if tgt != cert_id: continue
        if src not in certs: continue
        add(src, "official-recommended", url)

    # Rule 3: tier-skip prune. If we have both foundational and
    # associate/professional, drop foundational at expert level.
    by_tier = defaultdict(list)
    for cid, entry in by_id.items():
        if cid not in certs: continue
        tier = (certs[cid][1].get("evaluation") or {}).get("computed_tier")
        if tier: by_tier[tier].append((cid, entry))
    drop = set()
    if target_tier == "expert" and "foundational" in by_tier and ("professional" in by_tier or "associate" in by_tier):
        for cid, entry in by_tier["foundational"]:
            # Don't prune community-curated entries.
            if entry.get("source") != "community":
                drop.add(cid)
    if target_tier == "professional" and "introductory" in by_tier and "associate" in by_tier:
        for cid, entry in by_tier["introductory"]:
            if entry.get("source") != "community":
                drop.add(cid)
    for cid in drop:
        del by_id[cid]
        summary.append((cid, "drop", "tier-skip"))

    # Acyclic guard.
    safe = {}
    for cid, entry in by_id.items():
        if cid in certs:
            their_recs = {rec_id(e) for e in (certs[cid][1].get("prerequisites") or {}).get("recommended_certs") or []}
            their_reqs = {rec_id(e) for e in (certs[cid][1].get("prerequisites") or {}).get("required_certs") or []}
            if cert_id in their_recs or cert_id in their_reqs:
                summary.append((cid, "drop", "would-cycle"))
                continue
        safe[cid] = entry

    # Provenance correctness: `vendor-ladder` is by definition same-vendor.
    # Pre-existing entries (from earlier passes / migration) may carry that
    # tag for cross-vendor pairs; re-tag those to `community` so the
    # downstream renderer prioritizes them correctly. This does NOT add
    # rationales — that's the job of add_community_relationships.py.
    for cid, entry in safe.items():
        if entry.get("source") != "vendor-ladder": continue
        if cid not in certs: continue
        other_vendor = (certs[cid][1].get("vendor") or {}).get("slug")
        if other_vendor and other_vendor != target_vendor:
            entry["source"] = "community"
            summary.append((cid, "upgrade", "→ community (cross-vendor)"))

    sorted_out = sorted(safe.values(), key=lambda e: e["id"])
    return sorted_out, summary


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Print diff, do not write files.")
    args = ap.parse_args()

    tiers_doc = json.loads(TIERS_PATH.read_text(encoding="utf-8"))
    t_ord = tier_ord(tiers_doc)
    certs = load_certs()

    changes = []
    for cid in certs:
        # Deep-copy: propose_for_cert mutates dicts in place when upgrading
        # a `source` field, so a shallow snapshot would compare equal
        # even when a mutation happened.
        before = copy.deepcopy((certs[cid][1].get("prerequisites") or {}).get("recommended_certs") or [])
        after, summary = propose_for_cert(cid, certs, t_ord)
        if json.dumps(before, sort_keys=True) != json.dumps(after, sort_keys=True):
            changes.append((cid, before, after, summary))

    if not changes:
        print("No prereq changes proposed.")
        return 0

    print(f"{len(changes)} certs would have prereq edges updated:\n")
    for cid, before, after, summary in changes:
        print(f"  {cid}")
        for ev_id, action, note in summary:
            sigil = {"add": "+", "drop": "-", "upgrade": "↑"}.get(action, "?")
            print(f"    {sigil} {ev_id} ({note})")

    if args.dry_run:
        print("\n(dry-run; no files written.)")
        return 0

    for cid, _b, after, _s in changes:
        path, data = certs[cid]
        prereqs = data.setdefault("prerequisites", {"formal": [], "experience_years": 0})
        if after:
            prereqs["recommended_certs"] = after
        else:
            prereqs.pop("recommended_certs", None)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nApplied to {len(changes)} cert files.")
    print("Now run:  python3 scripts/build_manifest.py && python3 scripts/run_3_persona_eval.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
