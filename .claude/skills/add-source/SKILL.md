---
name: add-source
description: Add a new authoritative source agency to data/sources/agencies.json so that future cert evaluations can cite it.
---

# add-source

## When to use

An `add-source-agency` Issue arrives proposing a new authoritative source
agency (governmental body, ISO/IEC 17024 accreditor, recognised non-profit
standards body).

## Process

1. **Verify the agency is real and authoritative.**
   - Visit the proposed URL with WebFetch. Confirm it is the agency's own
     site (not a Wikipedia summary, not a vendor mirror).
   - Confirm one of:
     - Government affiliation (national, supranational, regional).
     - ISO/IEC 17024 accreditation authority.
     - Established non-profit standards body with public regulatory or
       framework output (e.g. NIST, ENISA, IPA, JPCERT, NISC, CREST,
       NCSC-UK).
   - Vendor pages, consultancy whitepapers, individual blogs, magazines,
     and aggregator sites are **rejected**. They may still be cited as
     `third_party_evaluations[].url` on individual certs.
2. **Pick a stable id**: `kebab-case`, jurisdiction-prefixed when the same
   acronym exists in multiple jurisdictions (e.g. `ncsc-uk`, `ncsc-nl`).
3. **Append to `data/sources/agencies.json`** preserving the existing
   field order: `id`, `name`, `jurisdiction`, `url`, `trust_tier`, `use`.
   Keep the array alphabetically by id within `trust_tier` groups for
   stable diffs.
4. **Validate** with `make validate` (the JSON Schema covers the cert
   files; `agencies.json` is hand-curated, so do a `jq . data/sources/agencies.json`
   to confirm valid JSON at minimum).

## Trust tiers

- `high`     - direct governmental / standards-body authority.
- `medium`   - recognised industry consortium with transparent governance.
- `vendor`   - certification issuers themselves; only valid as the source-of-truth for that vendor's own certs.
