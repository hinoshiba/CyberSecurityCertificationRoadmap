#!/usr/bin/env python3
"""
Regenerate data/manifest.json from data/certs/**/*.json.

The manifest is the single fetch entrypoint for the static site (GitHub Pages
cannot glob server-side). Every cert file appears with its id, relative path,
and a short content hash so browsers can cache-bust.
"""
import datetime
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
MANIFEST_PATH = ROOT / "data" / "manifest.json"


def main() -> int:
    if not CERTS_DIR.exists():
        print(f"ERROR: {CERTS_DIR} does not exist", file=sys.stderr)
        return 1

    certs = []
    for path in sorted(CERTS_DIR.glob("*/*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"ERROR: {path}: {e}", file=sys.stderr)
            return 1
        sha = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        certs.append({
            "id": data["id"],
            "path": str(path.relative_to(ROOT / "data")).replace("\\", "/"),
            "sha": sha,
        })

    manifest = {
        "schema_version": 1,
        "generated_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "domains_path": "domains.json",
        "tiers_path": "tiers.json",
        "agencies_path": "sources/agencies.json",
        "certs": certs,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {len(certs)} certs -> {MANIFEST_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
