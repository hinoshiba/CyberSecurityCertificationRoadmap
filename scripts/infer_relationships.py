#!/usr/bin/env python3
"""
Propose `prerequisites.recommended_certs[]` edges across the roadmap from
neutral, evidence-based rules. See .claude/skills/infer-relationships/SKILL.md
for the full design rationale.

Usage:
  python3 scripts/infer_relationships.py --dry-run    # print proposed diff
  python3 scripts/infer_relationships.py              # apply to cert JSONs

After applying, re-run:
  python3 scripts/build_manifest.py
  python3 scripts/run_3_persona_eval.py
"""
import argparse
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
TIERS_PATH = ROOT / "data" / "tiers.json"


# Industry-conventional cross-vendor flows. Each entry says
# "if both certs exist in the roadmap and the target lacks an explicit
#  prereq, the AI may propose `source` as a prereq of `target`".
CROSS_VENDOR_FLOWS = [
    # CompTIA ladder
    ("comptia.network-plus",   "comptia.security-plus"),
    ("comptia.security-plus",  "comptia.cysa-plus"),
    ("comptia.security-plus",  "comptia.pentest-plus"),
    ("comptia.cysa-plus",      "comptia.casp-plus"),
    ("comptia.security-plus",  "isc2.sscp"),
    ("isc2.cc",                "comptia.security-plus"),

    # ISC2 family
    ("isc2.cissp", "isc2.ccsp"),
    ("isc2.cissp", "isc2.issap"),
    ("isc2.cissp", "isc2.issep"),
    ("isc2.cissp", "isc2.issmp"),
    ("isc2.cissp", "isc2.csslp"),

    # OffSec offensive ladder (OSCP → 300-level → OSCE3 designation → OSEE apex)
    ("offsec.oscp", "offsec.osep"),
    ("offsec.oscp", "offsec.oswe"),
    ("offsec.oscp", "offsec.osed"),
    ("offsec.osep", "offsec.osce3"),
    ("offsec.oswe", "offsec.osce3"),
    ("offsec.osed", "offsec.osce3"),
    ("offsec.osce3", "offsec.osee"),
    ("offsec.osed", "offsec.osmr"),
    ("offsec.oswa", "offsec.oswe"),
    # OffSec defensive ladder
    ("offsec.osda", "offsec.osth"),
    ("offsec.osda", "offsec.osir"),
    # OffSec entry
    ("offsec.oscc-sjd", "offsec.oscc-sec"),
    ("offsec.oscc-sec", "offsec.oscp"),

    # Cisco
    ("cisco.cyberops-associate", "cisco.cyberops-professional"),
    ("comptia.network-plus",     "cisco.cyberops-associate"),

    # GIAC family (SANS commonly recommends GSEC before specialty GIAC certs)
    ("giac.gsec", "giac.gcih"),
    ("giac.gsec", "giac.gced"),
    ("giac.gcih", "giac.gcfa"),
    ("giac.gcfa", "giac.grem"),
    ("giac.gcia", "giac.gnfa"),
    ("giac.gpen", "giac.gxpn"),  # GXPN not yet in roadmap; will be skipped

    # ISACA family
    ("isaca.cisa", "isaca.crisc"),
    ("isaca.cisa", "isaca.cism"),

    # Microsoft family
    ("microsoft.sc-200", "microsoft.sc-100"),
    ("microsoft.sc-300", "microsoft.sc-100"),
    ("microsoft.az-500", "microsoft.sc-100"),
    ("microsoft.sc-401", "microsoft.sc-100"),

    # IPA ladder (per IPA published skill levels)
    ("ipa.ip", "ipa.fe"),
    ("ipa.fe", "ipa.ap"),
    ("ipa.ap", "ipa.sc"),
    ("ipa.sc", "ipa.riss"),
    ("ipa.ap", "ipa.nw"),
    ("ipa.ap", "ipa.db"),
    ("ipa.ap", "ipa.es"),
    ("ipa.ap", "ipa.sa"),
    ("ipa.ap", "ipa.pm"),
    ("ipa.ap", "ipa.au"),
    ("ipa.ap", "ipa.st"),
    ("ipa.ap", "ipa.sm"),
    ("ipa.ap", "ipa.sg"),

    # SEA/J ladder
    ("seaj.csbm", "seaj.cspm-management"),
    ("seaj.csbm", "seaj.cspm-technical"),

    # JP school-age IT literacy → national engineer track
    ("zensho.jouhou-shori-2", "zensho.jouhou-shori-1"),
    ("zensho.jouhou-shori-1", "ipa.ip"),
    ("jken.j-katsuyou",       "jken.j-system"),
    ("jken.j-katsuyou",       "jken.j-design"),
    ("jken.j-katsuyou",       "ipa.ip"),
    ("jken.j-system",         "ipa.fe"),

    # IAPP family
    ("iapp.cipp-e",  "iapp.cipm"),
    ("iapp.cipp-us", "iapp.cipm"),
    ("iapp.cipt",    "iapp.cipm"),

    # ISA 62443 stack
    ("isa.iec-62443-cf",  "isa.iec-62443-rds"),
    ("isa.iec-62443-rds", "isa.iec-62443-res"),
    ("isa.iec-62443-res", "isa.iec-62443-rse"),

    # CREST CHECK ladder
    ("crest.cpsa",  "crest.crt"),
    ("crest.crt",   "crest.cct-inf"),
    ("crest.crt",   "crest.cct-app"),

    # PECB / BSI / IRCA / Exemplar Global ISMS LA — none requires another;
    # explicit prereqs are the courses themselves, not other proctored exams.

    # CSA cloud foundation → vendor cloud certs
    ("csa.ccsk-v5", "isc2.ccsp"),

    # GICSP defensive ladder
    ("giac.gicsp", "giac.grid"),
    ("giac.gicsp", "isa.iec-62443-rds"),

    # OffSec OSWP wireless side-track
    ("offsec.oscp", "offsec.oswp"),
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


def is_lower_tier(a_tier, b_tier, t_ord):
    """Return True if a is at a LOWER tier than b (earlier in the ladder).
    Lower tier = higher `order` value (since order 1 = expert, 4 = foundational, 5 = introductory)."""
    if a_tier is None or b_tier is None: return False
    if a_tier == "specialty" or b_tier == "specialty": return False
    return t_ord.get(a_tier, 99) > t_ord.get(b_tier, 99)


def is_one_step_below(a_tier, b_tier, t_ord):
    """True if a is EXACTLY one tier-step below b (no skipping)."""
    if a_tier is None or b_tier is None: return False
    if a_tier == "specialty" or b_tier == "specialty": return False
    return t_ord.get(a_tier, 99) - t_ord.get(b_tier, 99) == 1


def transitively_reachable(start_id, certs):
    """All cert ids reachable by following recommended_certs[] from start_id."""
    out = set()
    queue = list((certs[start_id][1].get("prerequisites") or {}).get("recommended_certs") or [])
    while queue:
        cur = queue.pop()
        if cur in out: continue
        out.add(cur)
        if cur in certs:
            queue.extend((certs[cur][1].get("prerequisites") or {}).get("recommended_certs") or [])
    return out


def propose_for_cert(cert_id, certs, t_ord):
    """Return the proposed full prereq id list (existing + suggested), deduped & sorted."""
    target_path, target = certs[cert_id]
    target_existing = list(target.get("prerequisites", {}).get("recommended_certs") or [])
    target_tier = (target.get("evaluation") or {}).get("computed_tier")
    target_domains = primary_and_secondary(target)
    target_exp = (target.get("prerequisites") or {}).get("experience_years") or 0

    proposals = set(target_existing)
    rationale = []

    # Rule 1: same-vendor ladder, EXACTLY one tier below, sharing a domain.
    # Tightened from "any-lower-tier" to "exactly-one-step-below" to avoid
    # proposing Network+ as a direct prereq of CASP+ (which skips three tiers).
    # Also skip if the candidate is already transitively reachable through an
    # existing prereq — e.g. OSEE has OSCE3 as prereq, and OSCE3 has
    # OSEP/OSWE/OSED, so we shouldn't add those directly to OSEE.
    target_vendor = (target.get("vendor") or {}).get("slug")
    transitively = transitively_reachable(cert_id, certs)
    for other_id, (_p, other) in certs.items():
        if other_id == cert_id: continue
        if (other.get("vendor") or {}).get("slug") != target_vendor: continue
        other_tier = (other.get("evaluation") or {}).get("computed_tier")
        if not is_one_step_below(other_tier, target_tier, t_ord): continue
        if not (primary_and_secondary(other) & target_domains): continue
        if other_id in transitively: continue
        if other_id not in proposals:
            proposals.add(other_id)
            rationale.append((other_id, "same-vendor"))

    # Rule 4: industry-conventional cross-vendor flows (whitelist).
    # Cross-vendor edges by experience-delta alone are too noisy and unprincipled.
    for src, tgt in CROSS_VENDOR_FLOWS:
        if tgt != cert_id: continue
        if src not in certs: continue
        if src not in proposals:
            proposals.add(src)
            rationale.append((src, "cross-vendor"))

    # Rule 5: tier-skip prune
    # If we have both a foundational and an associate prereq, drop the foundational
    # (the associate already covers the step from below).
    by_tier = defaultdict(list)
    for pid in proposals:
        if pid not in certs: continue
        ptier = (certs[pid][1].get("evaluation") or {}).get("computed_tier")
        if ptier: by_tier[ptier].append(pid)
    drop = set()
    if target_tier in ("expert",) and "foundational" in by_tier and ("professional" in by_tier or "associate" in by_tier):
        for pid in by_tier["foundational"]:
            drop.add(pid)
    if target_tier in ("professional",) and "introductory" in by_tier and "associate" in by_tier:
        for pid in by_tier["introductory"]:
            drop.add(pid)
    proposals -= drop

    # Acyclic guard: if target appears in the prereq's own prereqs, refuse.
    safe = set()
    for pid in proposals:
        if pid not in certs: continue
        their_prereqs = set((certs[pid][1].get("prerequisites") or {}).get("recommended_certs") or [])
        if cert_id in their_prereqs:
            continue  # would create a cycle
        safe.add(pid)

    return sorted(safe), rationale


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Print diff, do not write files.")
    args = ap.parse_args()

    tiers_doc = json.loads(TIERS_PATH.read_text(encoding="utf-8"))
    t_ord = tier_ord(tiers_doc)
    certs = load_certs()

    changes = []  # (cert_id, before, after, rationale)
    for cid in certs:
        before = list((certs[cid][1].get("prerequisites") or {}).get("recommended_certs") or [])
        after, rationale = propose_for_cert(cid, certs, t_ord)
        if sorted(before) != sorted(after):
            changes.append((cid, sorted(before), after, rationale))

    if not changes:
        print("No prereq changes proposed.")
        return 0

    print(f"{len(changes)} certs would have prereq edges updated:\n")
    for cid, before, after, rationale in changes:
        adds = sorted(set(after) - set(before))
        removes = sorted(set(before) - set(after))
        print(f"  {cid}")
        for a in adds:
            kind = next((k for (i, k) in rationale if i == a), "?")
            print(f"    + {a} ({kind})")
        for r in removes:
            print(f"    - {r}")

    if args.dry_run:
        print("\n(dry-run; no files written. Re-run without --dry-run to apply.)")
        return 0

    for cid, _b, after, _r in changes:
        path, data = certs[cid]
        prereqs = data.setdefault("prerequisites", {"formal": [], "experience_years": 0})
        prereqs["recommended_certs"] = after
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nApplied to {len(changes)} cert files.")
    print("Now run:  python3 scripts/build_manifest.py && python3 scripts/run_3_persona_eval.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
