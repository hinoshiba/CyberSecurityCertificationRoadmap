# Roadmap UX requirements and review record

Audit date: 2026-09-06. Baseline commit: `779eb43`.

This record accompanies a maintainer-authorized frontend overhaul. The
certification catalog and evaluation rubric remain the source of truth.
The record combines the implementation agent's browser-operation results
with an independent maintainer's source, screenshot, and Docker-check review.
The evidence type is stated below; automated tests and internal persona
critiques do not establish a result from real-user research.

## Product requirements

The roadmap helps users understand the full certification landscape, identify
relevant certifications, and inspect how those certifications relate. A
first-time visitor must be able to explore without already knowing the
abbreviations. An experienced user must still be able to survey all domains
and tiers together. The user explicitly confirmed that this overview is
essential to the project.

The baseline contains 317 certifications from 68 vendors, across 12 domains.
There are 24 Japan-only certifications. The six tier categories are
Introductory, Foundational, Associate, Professional, Expert, and Specialty.
Specialty is a non-linear subject category, not a level above Expert.
These counts describe the audit snapshot, not a hard-coded UI requirement.

| Requirement | Design response | Final acceptance |
| --- | --- | --- |
| Keep the full landscape visible | Default Map view with a 12-domain × 6-tier overview and cell counts | Passed browser operation; desktop screenshot independently inspected |
| Inspect qualifications within the map | Optional expanded map shows qualification labels, with horizontal scrolling contained on narrow screens | Passed browser operation; full names remain available on cards and in details |
| Make the overview actionable | Cell selection narrows readable cards while retaining overall context | Passed browser operation and primary-domain logic tests |
| Discover unfamiliar certifications | Visible search; cards show full names and vendors; Explore view | Passed browser operation; desktop/mobile screenshots independently inspected |
| Narrow the catalog predictably | Domain sidebar on desktop/mobile selector, level controls, vendor filter dialog, visible results count | Passed browser operation and logic tests; domain counts retain the active level |
| Recover from no results | Explicit empty state and a clear route to reset restrictive filters | Passed browser operation; reset focus fallback independently reviewed |
| Understand an individual certification | Native details dialog with exam information, availability, related certifications, AI evaluations, and sources | Passed browser operation; all 317 certifications render in both languages in tests |
| Distinguish fact from recommendation | Required prerequisites separate from vendor, official-recommended, and community suggestions | Passed source review and provenance tests |
| Support Japan independently of language | Separate Japan-only inclusion and English/Japanese language settings | Passed browser operation and logic tests; default 293, Japan included 317 |
| Work across devices and access methods | Desktop/phone layouts, visible keyboard focus, dialog focus handling, Escape, light/dark themes | Passed reported browser journeys at emulated sizes; assistive-technology and physical-device limits below |
| Share a useful view | Query-string state restores filters, view, sorting, selection, and appearance | Passed browser operation and URL round-trip tests |
| Keep the project publishable | Relative assets, static modules, no application build/backend, existing Pages workflow | Passed root and project-subpath browser checks |
| Keep operation reproducible | Dependency-free Node 22 checks, `make test-ui`, and UI CI | Independently reran `make test-ui`: checks passed, 30 tests passed |
| Preserve project identity and trust | Attribution, CC BY-SA 4.0, GitHub/Issue access, evidence, dataset/build version | Passed source review; data and rubric diffs are empty |

## Baseline findings

| Finding | User consequence | Intended response |
| --- | --- | --- |
| The desktop matrix densely packs abbreviation-only cards | Beginners cannot recognize or compare unfamiliar certifications without hovering | Keep the overview and add readable cards and an expanded names view |
| Clicking a card selects it but keeps details hidden initially | Users must discover a separate floating button to read essential information | Open details directly from certification actions |
| Mobile tools hide search and filters behind a menu | The most useful way to find a certification is not immediately visible | Keep search visible and expose a compact domain selector |
| Search counts the complete catalog even when JP/vendor filters hide matches | Result count and visible content can disagree | Derive results from the same active-filter state |
| A zero-match search removes the search dimming state | A failed search looks like a successful return to the entire catalog | Show an explicit empty state |
| Re-rendering rebuilds grid DOM and detail click listeners accumulate | Keyboard focus and repeated interactions need targeted regression coverage | Review focus restoration and bind stable event handlers |
| Specialty appears at the top of a linear-looking grid | Users may interpret it as a qualification above Expert | Explain its non-linear meaning in the interface |
| Page metadata claims MIT despite repository-wide CC BY-SA 4.0 | Search previews can misstate the license | Correct metadata and preserve attribution |
| Existing PR validation paths exclude frontend files | UI regressions can bypass all existing checks | Add a dedicated UI workflow |

The inspiration sources remain acknowledged in README/NOTICE and the UI:
[Paul Jerimy](https://pauljerimy.com/security-certification-roadmap/) and
[CyberDudeKZ](https://cyberdudekz.github.io/security-cert-roadmap/).
The implementation is independently authored.

## Repository and deployment constraints

- Certification facts stay in `data/certs/<vendor>/<slug>.json`. The manifest
  supplies paths because GitHub Pages cannot list or glob server-side files.
- Tiers are read from `evaluation.computed_tier`; the frontend must not
  implement a competing ranking rubric or rewrite data.
- Standard ES modules and relative fetches must work at the domain root and
  `/CyberSecurityCertificationRoadmap/`. Navigation uses query parameters;
  no server routes or rewrite rules are available.
- The existing Pages workflow deploys the repository root from `main` and
  stamps `assets/version.json`. Preserve commit and dataset date provenance.
- Certification/skill changes remain separate from authorized frontend
  maintenance. Schema, manifest, and evaluation checks retain their role.
- UI checks use Node 22 with no package installation. `make test-ui` runs
  them in a container with a read-only repository mount. Authoring credentials
  are only mounted into the existing authoring service.

### Shareable state

Preserve the existing `theme`, `lang`, `jp`, `v`, `cert`, `q`, and `vt`
parameters. In particular, omitted `v` means all vendors and empty `v=` means
none. Added parameters are `d` (domain), `level` (tier), `view` (`map` or
`explore`), `sort` (`level`, `name`, or `vendor`), and `names=1` (expanded map). Japanese labels do not
implicitly include Japan-only certifications, and the Japan toggle does not
change language. Invalid or unknown state must not crash page loading.

## Persona review protocol

These are structured internal critiques. The implementation agent operated
the browser; the independent maintainer assessed its reported journeys,
inspected the source and supplied screenshots, and independently reran the
Docker checks. No external participants or screen-reader session were used.

| Persona | Tasks and acceptance questions | Baseline finding | Final result |
| --- | --- | --- | --- |
| Beginner planning a first certification | Understand the map; choose an entry level; find a full certification name; open exam information; explain Specialty | Abbreviation-only cards and hidden details impede discovery | Internal critique: the beginner action, full-name cards, direct details, and explicit Specialty note address these obstacles. Browser operator reports the discovery journeys work; comprehension was not measured with real beginners. |
| Experienced practitioner comparing paths | Survey all domains; inspect a busy cell; search CISSP or OSCP; follow required/recommended/next relationships; share the view | Dense overview is valuable, but search/filter disagreement and hidden details interrupt comparison | Internal critique: the desktop screenshot preserves all 12 domains and six categories together. Browser operator verified map/Explore, selection, related navigation, and shared state; source/tests preserve primary placement and relationship provenance. |
| Phone user browsing in Japanese | Switch labels and Japan inclusion independently; operate search/filters with touch; read IPA details; close dialogs without losing place | Search is hidden among mobile tools; overview abbreviations depend on prior knowledge | Internal critique: inspected mobile search/filter and Japanese IPA FE detail screenshots show clear labels and the official-site action. Browser journeys passed at emulated phone sizes; physical touch behavior on iOS/Android was not tested. |
| Accessibility reviewer | Navigate with keyboard; inspect focus visibility/restoration and accessible control names; test Escape, reduced motion, and 200% zoom | Re-rendered DOM and modal behavior need explicit verification | Focus collisions and disappearing-trigger fallbacks were found and fixed; browser operator verified keyboard/Escape journeys. Reduced-motion CSS was inspected. No screen-reader session, OS reduced-motion test, or explicit browser-zoom test was performed. |
| Repository maintainer | Trace displayed tiers and sources; inspect changed files; run UI checks; verify deployment under a project subpath | No frontend CI; existing data freshness issue must remain explicit | Independently reran Docker UI checks: 30 passed. Reviewed static URLs, relative assets, preserved sources, and empty data/rubric diffs. Browser operator verified root/subpath loading; existing expired evaluations are recorded separately. |

### Findings corrected during review

| Reviewer finding | Final correction and evidence |
| --- | --- |
| Detail close could return focus to a hidden map link with the same certification ID | Focus selectors include their map/result/sidebar surface, and restoration checks visibility before using a fallback; independently inspected in `app.js` |
| Clearing a filter or resetting no results removed the focused trigger | Re-rendering falls back to the results heading when the previous control no longer exists; independently inspected |
| Domain facet counts ignored the selected level | Facet calculation retains the level filter; independently inspected |
| Japanese PNG exports used English full names; Specialty appeared above Expert | Export uses Japanese names with English fallback and places Specialty last; independently inspected and covered by export tests |
| Empty/oversized export recovery was reduced to an unhelpful retry message | Empty-result export is disabled and actionable export errors are displayed; independently inspected |
| A vendor URL containing unknown IDs could incorrectly normalize to all vendors | The normalization checks membership of every actual vendor instead of comparing set sizes; independently inspected |
| The detail close control could become clipped while scrolling | The sticky control remains at `top: 0`; source inspected and final browser operator reports checked |
| Empty formal-requirement prose could contradict a recorded required credential | The empty prose is suppressed when required credentials exist; independently inspected and detail tests passed |

## Verification record

Browser results below were reported by the implementation agent from the
in-app Chromium browser. The independent maintainer directly reran the Docker
UI checks, checked the data/rubric diff, and inspected the screenshot artifacts.

| Check | Result |
| --- | --- |
| `npm run check` | Passed in Node 22 Docker service: 15 JavaScript modules and 19 local references checked |
| `npm test` | 30 passed, 0 failed, 0 skipped in the independent final run |
| `make test-ui` | Passed; read-only `node:22-alpine` service executes both commands without package installation |
| Compose configuration and whitespace | `docker compose config --quiet` and `git diff --check` passed |
| Desktop map, expanded map, Explore, selection and dialog | Browser operator reports passed; desktop overview screenshot independently inspected |
| Narrow phone layout and contained map scrolling | Browser operator reports no document overflow at widths 360, 390, 768, and 1440; phone controls operated in Chromium emulation |
| Search, mixed filters, no results, reset, sort | Browser operator reports passed; corresponding search/filter/sort logic tests passed |
| Japanese labels and Japan-only inclusion | Browser operator reports independent toggles passed; 293 default visible certifications and 317 with Japan included |
| Light/dark theme, keyboard focus, Escape | Browser operator reports passed; focus corrections independently inspected. At 390 px, the long CISSP dialog scrolled to 4438 px with its close button still at viewport top 12–56 px; Tab remained inside the dialog. |
| Browser zoom and reduced motion | At 720 CSS px (the reflow width corresponding to 1440px at 200%), the page stays 720px wide and the 850px map scrolls internally. Actual 200% browser zoom untested. Reduced-motion CSS inspected, with no OS-setting test. Do not infer either result from viewport checks. |
| URL reload, related-cert navigation, invalid URL state | Browser operator reports passed; URL and detail tests passed. A shared URL with invalid domain/level, missing certification, and `v=` showed the missing-cert dialog; close led to 0 results and Reset restored 293. Share displayed the Japanese copy-success message. |
| Root and project-subpath asset/data loading | Browser operator reports both nginx root (`http://[::1]:8080/`) and `/CyberSecurityCertificationRoadmap/` load 293/317 correctly without browser errors |
| Export behavior and dataset/build provenance | Browser operator verified actual PNGs: three Introductory certifications at 2404 × 1258, and all 317 in Japanese at 2404 × 11815 (3.36 MB). All 317 expanded-map anchors were unique. Tests verify each supplied certification appears once, localized names, attribution, version text, and failure handling. |
| Failure/retry states and browser console | Browser operator injected a single-certification JSON HTTP 503: explicit error and 0 cards; Retry restored 293 default results. Successful root/subpath sessions had no browser errors. |
| Certification schema and manifest | Browser operator reports Docker AJV validation passed for all 317 files and every manifest SHA-256 prefix/path/ID matched |
| Certification data/rubric diff | Independently checked: no changes under `data/`, `.agents/skills/`, or `.claude/skills/` |
| Existing evaluation freshness | Fails for all 317 existing May evaluations; no timestamps altered |

### Screenshot artifacts

- [Desktop roadmap overview](./screenshots/roadmap-desktop.png)
- [Mobile roadmap and discovery controls](./screenshots/roadmap-mobile.png)
- [Mobile map with contained horizontal scrolling](./screenshots/roadmap-mobile-map.png)
- [Desktop certification details](./screenshots/details-desktop.png)
- [Japanese mobile certification details](./screenshots/details-mobile-ja.png)

The desktop overview, mobile discovery, and Japanese mobile details images
were independently inspected. Screenshots document particular states and
do not establish physical-device or assistive-technology compatibility.

### Existing data and environment limitations

At audit time, `data/manifest.json` matches every certification's ID, path,
and SHA. All 317 evaluations have `computed_at: 2026-05-02T14:04:04Z`.
They exceed the existing 60-day freshness window on 2026-09-06. This is a
pre-existing data maintenance issue; a UI change must not advance evaluation
timestamps without running and reviewing the evaluation process.

The initial local Docker daemon was unavailable, but Docker was subsequently
available and the final UI checks passed in the documented service. The
initial system Python was older than 3.11 and could not run the existing
freshness script's `datetime.UTC` expression; the separate freshness failure
for all 317 dated evaluations was subsequently confirmed by the implementation
agent.

The browser work used desktop Chromium and viewport emulation. No physical
iOS/Android devices or screen-reader session were tested. Reduced-motion
support was reviewed in CSS source, not by changing the OS setting. Explicit
browser zoom remains untested at this review point. These limits are part of
the review record, rather than assertions of universal accessibility.
