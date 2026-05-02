#!/usr/bin/env python3
"""
One-shot migration: convert prerequisites.recommended_certs from a string
array to an object array, in line with schema v1's split between
`required_certs` (hard prerequisites) and `recommended_certs` (soft prior
path with provenance).

Before:
  "recommended_certs": ["comptia.security-plus", "comptia.network-plus"]

After:
  "recommended_certs": [
    {"id": "comptia.network-plus", "source": "vendor-ladder"},
    {"id": "comptia.security-plus", "source": "vendor-ladder"}
  ]

All existing entries are stamped `source: "vendor-ladder"` because they
were algorithmically derived by the previous pass of
`infer_relationships.py`. The next run of that script (after this
migration) will re-tag them with proper provenance — `official-recommended`
for entries from the curated cross-vendor whitelist, `vendor-ladder` for
entries from the same-vendor / shared-domain rule, and `community` for
entries from the new cross-vendor reputation skill.

Usage:
  python3 scripts/migrate_prereqs_v2.py --dry-run    # preview
  python3 scripts/migrate_prereqs_v2.py              # apply
"""
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"


def is_already_migrated(rec_list):
    """True if every entry is already an object (i.e., dict)."""
    return all(isinstance(x, dict) for x in rec_list)


def migrate_one(cert):
    prereqs = cert.get("prerequisites") or {}
    rec = prereqs.get("recommended_certs") or []
    if not rec:
        return False  # nothing to migrate
    if is_already_migrated(rec):
        return False  # idempotent
    new_rec = []
    for entry in rec:
        if isinstance(entry, str):
            new_rec.append({"id": entry, "source": "vendor-ladder"})
        elif isinstance(entry, dict) and "id" in entry:
            entry.setdefault("source", "vendor-ladder")
            new_rec.append(entry)
        else:
            raise ValueError(f"Unrecognized recommended_certs entry: {entry!r}")
    # Sort by id for stable diffs.
    new_rec.sort(key=lambda d: d["id"])
    prereqs["recommended_certs"] = new_rec
    cert["prerequisites"] = prereqs
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Print summary, do not write files.")
    args = ap.parse_args()

    paths = sorted(CERTS_DIR.glob("*/*.json"))
    migrated = []
    for p in paths:
        d = json.loads(p.read_text(encoding="utf-8"))
        if migrate_one(d):
            migrated.append((p, d))

    print(f"{len(migrated)} of {len(paths)} cert files need migration.")
    for p, _ in migrated[:10]:
        print(f"  - {p.relative_to(ROOT)}")
    if len(migrated) > 10:
        print(f"  ... and {len(migrated) - 10} more")

    if args.dry_run:
        print("\n(dry-run; no files written.)")
        return 0

    for p, d in migrated:
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nApplied to {len(migrated)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
