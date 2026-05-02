<!--
  Reminder: PRs in this repo should only modify files under:
    - data/        (certification facts, source agencies)
    - .claude/skills/ (evaluation rubric, automation skills)

  See README.md "Core principle: AI as third-party evaluator" and CONTRIBUTING.md
  for the rationale. PRs touching index.html, assets/, schema/, or workflows/
  are still accepted, but they should be a separate PR with its own discussion.
-->

## What is this PR?

- [ ] Adds or updates one or more certifications under `data/certs/`
- [ ] Adds or updates `data/sources/agencies.json`
- [ ] Adjusts a skill under `.claude/skills/`
- [ ] Other (please describe; expect more review):

## Evidence

For new / updated certs, list the URLs you used:

- Official source(s):
- Third-party evaluation(s):
- (JP only) Japanese public-sector source(s):

## Local checks

- [ ] `make validate` passes
- [ ] `make manifest` was re-run (`data/manifest.json` is in this PR)
- [ ] `make evaluate` was re-run; the resulting `evaluation.*` blocks are committed
- [ ] `make check-eval` passes (no stale evaluations)

## Notes for reviewers

<!-- If a tier moved unexpectedly, explain why the underlying factors justify it. -->
