#!/usr/bin/env python3
"""
CI gate: every cert under data/certs must have a non-null
evaluation.computed_tier and an evaluation.computed_at no older than
EVAL_MAX_AGE_DAYS (default 60).

This is the local-only-eval enforcement: contributors run `make evaluate`
before pushing; CI just verifies the result is present and fresh.
"""
import datetime
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
MAX_AGE_DAYS = int(os.environ.get("EVAL_MAX_AGE_DAYS", "60"))


def main() -> int:
    failures = []
    cutoff = datetime.datetime.now(datetime.UTC).replace(tzinfo=None) - datetime.timedelta(days=MAX_AGE_DAYS)

    for path in sorted(CERTS_DIR.glob("*/*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        ev = data.get("evaluation") or {}
        tier = ev.get("computed_tier")
        ts = ev.get("computed_at")
        rel = path.relative_to(ROOT)
        if not tier:
            failures.append(f"{rel}: evaluation.computed_tier is null")
            continue
        if not ts:
            failures.append(f"{rel}: evaluation.computed_at is null")
            continue
        try:
            when = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            failures.append(f"{rel}: evaluation.computed_at is not ISO-8601: {ts!r}")
            continue
        if when < cutoff:
            failures.append(f"{rel}: evaluation.computed_at is older than {MAX_AGE_DAYS} days ({ts})")

    if failures:
        print("FAIL: stale or missing evaluations:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        print("", file=sys.stderr)
        print("Run `make evaluate` locally and commit the updated cert JSONs.", file=sys.stderr)
        return 1

    print("OK: all cert evaluations present and fresh.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
