# Cyber Security Certification Roadmap

> An independently compiled, AI-evaluated roadmap of security certifications.
> Static site, hosted on GitHub Pages. Cert facts live in JSON; tier placement
> is computed by AI personas from those facts.

[**Live roadmap →** https://hinoshiba.github.io/CyberSecurityCertificationRoadmap/](https://hinoshiba.github.io/CyberSecurityCertificationRoadmap/)

日本語版は [README.ja.md](./README.ja.md) を参照してください。

---

## Inspiration & Acknowledgements

This project respects and is inspired by:

- [Paul Jerimy's Security Certification Roadmap](https://pauljerimy.com/security-certification-roadmap/)
- [CyberDudeKZ's Security Cert Roadmap](https://cyberdudekz.github.io/security-cert-roadmap/)

The certification list, taxonomy, tier rubric, schema, and UI in this
repository are independently authored. **No data, layout, code, or images
were copied from those works.** See [NOTICE](./NOTICE) for the full
attribution statement.

For Japanese certifications (IPA, SEA/J, ...), authoritative information is
sourced from official Japanese agencies (IPA, METI, JPCERT/CC, NISC).

---

## Core principle: AI as third-party evaluator

This is the most important rule of this project, and the reason its workflow
looks unusual.

> **Pull requests should only modify (a) the certification JSON files under
> `data/certs/`, and (b) the evaluation skills under `.claude/skills/`.**
>
> The project trusts AI as an independent third-party evaluator. The
> certification _facts_ (vendor, official URLs, exam logistics, plus / minus
> scoring factors, third-party evaluations, source links) are recorded in
> JSON by humans; the certification _tier_ (Foundational, Associate,
> Professional, Expert, or Specialty) is **computed** by the
> `evaluate-roadmap-3-personas` skill from those facts &mdash; never set by
> hand on a per-cert basis.

This gives the roadmap two desirable properties:

1. **Reproducible.** Anyone can re-run the evaluation skills against the JSON
   and reach the same tiers. Disagreements about a placement are
   conversations about the JSON facts or the rubric, not about taste.
2. **Auditable.** The plus / minus factors and their evidence URLs are
   permanently part of the data. A reviewer can ask "why is this an Expert
   tier?" and the rubric + the factors give the answer.

Plus / minus weight _hints_ live in the JSON. How those hints convert into a
tier is owned by the AI / skill at evaluation time, not by the JSON itself.

If you disagree with a tier, the right move is to either:

- File an Issue with new evidence that should change the cert's
  `scoring_factors`, or
- Propose a change to `.claude/skills/evaluate-roadmap-3-personas/SKILL.md`
  if the rubric is wrong.

Quality is gated by **three distinct AI personas** (a JP enterprise CISO, a
US MSSP hiring manager, and an EU offensive consultant). If they disagree by
more than one tier on more than 10% of certs, the run fails &mdash; the
rubric (not the data) needs revision.

---

## How to contribute

We accept Issues for everything. **PRs should be limited to data and skills.**

| You want to ...                                  | Open this Issue                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Add a new certification                          | [Add a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-certification.yml)  |
| Update an existing certification                 | [Update a certification](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=update-certification.yml) |
| Add an authoritative source agency               | [Add a source agency](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=add-source-agency.yml)  |
| Disagree with how a cert was tier-placed         | [Report an evaluation issue](https://github.com/hinoshiba/CyberSecurityCertificationRoadmap/issues/new?template=report-evaluation-issue.yml) |

The `respond-to-issue` skill picks up Issues and drafts a PR for the
maintainer to review.

### What goes in a certification JSON

See `schema/certification.schema.json` for the authoritative shape and
`data/certs/isc2/cissp.json` for an example. In short: vendor info, official
URL with `fetched_at`, optional logistics, prerequisites, an array of plus
factors and an array of minus factors with weight hints and evidence URLs,
an array of third-party evaluations, and a list of sources. The `evaluation`
block is filled by the skill, not by you.

---

## Running locally

Everything runs through Docker. The container mounts your `~/.claude*` and
`~/.codex` directories read-write so Claude Code and Codex CLI work
seamlessly inside.

```sh
make shell      # drop into a shell in the container with claude/codex available
make serve      # serve the static site on http://localhost:8080
make validate   # ajv-validate every JSON in data/certs against the schema
make evaluate   # run the 3-persona evaluation skill on the current data
```

See `docker-compose.yml` for the exact mount list.

---

## Repository layout

```
data/
  domains.json           # 12 NIST-NICE-inspired domains
  tiers.json             # 4 tiers + specialty bucket and rubric
  manifest.json          # generated index of every cert file
  sources/agencies.json  # approved source agencies (NIST, IPA, JPCERT, ...)
  certs/<vendor>/<cert>.json
schema/certification.schema.json
assets/                  # static HTML / CSS / JS for GitHub Pages
.claude/skills/          # AI skills: add-cert, evaluate, etc.
.github/                 # Issue templates, PR template, Pages workflow
docker/                  # Dockerfile + entrypoint
```

---

## License

**[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)** &mdash; covers the entire repository: the curated dataset (`data/**/*.json`, vendor & cert facts, domain taxonomy, tier rubric, source-agency registry, AI-computed evaluations and rationales) AND the surrounding code (JS / Python / schema / skills / Docker / Actions / HTML / CSS).

You are free to share and adapt the work, including for commercial use, as long as you (1) **attribute** the project and (2) license your derivative under the **same terms** (ShareAlike). See [LICENSE](./LICENSE) for the full legal text and [NOTICE](./NOTICE) for the rationale, attribution example, and trademark statements.
