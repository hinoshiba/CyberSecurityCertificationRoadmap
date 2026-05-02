# Contributing

Thanks for your interest in improving this roadmap. Two rules cover almost
every situation:

1. **PRs may only modify `data/` and `.claude/skills/`.** Anything else
   (HTML, JS, schema, workflows, README) is out of scope for content PRs and
   should be its own discussion. See [README.md → Core principle](./README.md#core-principle-ai-as-third-party-evaluator) for why.
2. **Never hand-set the tier of a certification.** The `evaluation.computed_tier`
   field is owned by `.claude/skills/evaluate-roadmap-3-personas/`. If you
   disagree with a placement, change the underlying `scoring_factors` (with
   evidence) or the rubric &mdash; not the output.

## Filing an Issue

Please use one of the templates in `.github/ISSUE_TEMPLATE/`. The
`respond-to-issue` skill is set up to pick them up and draft a PR for the
maintainer.

## Editing a certification JSON by hand

If you must, the rules are:

- The shape must validate against `schema/certification.schema.json`. Run
  `make validate` before opening the PR.
- Every claim worth a `+` or `-` factor must have an `evidence` URL.
- `third_party_evaluations[]` should have at least two entries from
  different organisations whenever possible. Vendor self-assessment is not a
  third-party evaluation.
- Set `official.fetched_at` to the date you actually fetched the page.
- Leave the entire `evaluation` object as `null`. The skill fills it.

## Editing a skill

- A skill change is a rubric change. After editing, **run `make evaluate`
  locally** and inspect the resulting tier diffs. If many certs move, that
  is fine, but the PR description must explain the rubric intent.
- The 3-persona evaluation has a built-in failure threshold (>10% of certs
  with >1 tier disagreement). If your change trips it, revise the rubric or
  the personas, not the data.

## Adding a new source agency

Use the `add-source-agency.yml` template. Acceptable agencies are
governmental, non-profit standards bodies, or ISO/IEC 17024 accreditors.
Vendor blogs and consultancy whitepapers are not source agencies; they are
fine as `third_party_evaluations[].url` entries on individual certs.
