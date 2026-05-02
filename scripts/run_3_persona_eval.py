#!/usr/bin/env python3
"""
One-shot runner for the evaluate-roadmap-3-personas skill.

In production this is invoked by Claude Code inside the Docker container
(see Makefile `evaluate` target and the SKILL.md). For the initial seed pass
the per-cert persona judgments are encoded here directly so the result is
reproducible and reviewable as a code change rather than a transcript.

Update PERSONAS[<cert_id>] when:
  - new evidence shifts a cert's scoring_factors
  - the persona definitions in
    .claude/skills/evaluate-roadmap-3-personas/SKILL.md change

The disagreement gate (>10% of certs with >1 tier difference) is enforced
at the bottom of this script.
"""
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
TIERS_PATH = ROOT / "data" / "tiers.json"

SKILL_VERSION = "evaluate-roadmap-3-personas@1"

# Per-cert persona scores. Tier values must be in tiers.json.
PERSONAS: dict[str, dict[str, dict[str, str]]] = {
    "isc2.cissp": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Long-recognised in JP enterprise; ANSI-accredited; JA-language exam available."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 baseline across IAM/IAT/IASAE roles; widely required for senior hires."},
        "alex-novak":     {"tier": "expert", "rationale": "Multiple-choice format is a minus, but breadth and global recognition place it at expert tier despite the lack of a practical."},
    },
    "isc2.sscp": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Useful associate-level credential but overshadowed by Sec+ in JP hiring."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 baseline at associate level; ANSI accredited; lower hiring demand than Sec+."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice; basic operations focus."},
    },
    "isc2.ccsp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Vendor-neutral cloud governance is valued; JA exam available; not yet at IPA-equivalent statutory weight."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "5-year experience requirement, ANSI accredited; no hands-on lab keeps it below expert."},
        "alex-novak":     {"tier": "professional", "rationale": "Modern cloud relevance, but no practical component."},
    },
    "offsec.oscp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Hands-on respected globally; JP recognition lower than CREST or CISSP equivalents."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 listing; strong hiring signal; falls short of expert because scope is still network/AD pentest."},
        "alex-novak":     {"tier": "expert", "rationale": "24-hour practical exam, peer-revered, current PEN-200 covers modern AD - clear expert signal in offensive consulting."},
    },
    "offsec.osep": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Advanced AV bypass / AD content is at the senior offensive level."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "Strong red-team hiring signal; long practical exam."},
        "alex-novak":     {"tier": "expert", "rationale": "48-hour practical, AV bypass, modern - peer-respected expert."},
    },
    "comptia.security-plus": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Vendor-neutral baseline; JA exam available; entry credential rather than depth signal."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 baseline IAT-II; the most common hiring filter for SOC L1; PBQs add some hands-on credibility."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice with PBQs; baseline only."},
    },
    "comptia.network-plus": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "Networking fundamentals; not a security credential proper."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "No security DoD 8140 listing; networking baseline."},
        "alex-novak":     {"tier": "foundational", "rationale": "Foundational networking only."},
    },
    "comptia.cysa-plus": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Blue team focus; DoD 8140 listing at associate-level."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Strong SOC-analyst hire signal; PBQs provide hands-on credibility."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice base; PBQs limited."},
    },
    "comptia.pentest-plus": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD 8140 baseline; not deep practical."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 baseline; hiring filter signal weaker than OSCP."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice + PBQ; lacks the depth peers expect from a pentest cert."},
    },
    "comptia.casp-plus": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Multi-domain architecture coverage; PBQ-heavy."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 IAT-III and IASAE; extensive PBQs; recent SecurityX rebrand."},
        "alex-novak":     {"tier": "professional", "rationale": "Heavy PBQs but multiple-choice base; rebrand creates short-term recognition risk."},
    },
    "ec-council.ceh": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD 8140 baseline; JA exam; familiar in JP procurement."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 baseline CSSP-Analyst; multiple-choice format limits the hiring signal."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice base, optional Practical add-on; mixed peer reputation in offensive circles."},
    },
    "ec-council.chfi": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD 8140 baseline; broad forensic tooling coverage."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 baseline; multiple-choice; overshadowed by GCFA in hiring."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice forensic credential; specialised peers prefer GCFA."},
    },
    "isaca.cisa": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "De-facto audit standard at JP enterprises; 5yr verified experience requirement."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 baseline; widely required for IT-audit hires."},
        "alex-novak":     {"tier": "professional", "rationale": "Audit focus is broad but not technical depth at the offensive level."},
    },
    "isaca.cism": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Management de-facto standard at CISO interviews in JP."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 baseline; widely recognised at security-management hiring."},
        "alex-novak":     {"tier": "professional", "rationale": "Management focus; not technical."},
    },
    "isaca.crisc": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Risk-management focus; recognised by JP financial regulators."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Risk-management standard; 3yr experience requirement."},
        "alex-novak":     {"tier": "professional", "rationale": "Risk focus, not technical."},
    },
    "isaca.cdpse": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Privacy-technical focus useful in JP under APPI."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "ANSI accredited; technical privacy engineer focus."},
        "alex-novak":     {"tier": "professional", "rationale": "Newer credential; technical privacy depth."},
    },
    "giac.gsec": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD 8140 baseline; SANS-backed; expensive for JP procurement."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 IAT-II / IAM-I baseline; SANS curriculum reputation lifts the hiring signal."},
        "alex-novak":     {"tier": "associate", "rationale": "Open-book multiple-choice; broad essentials."},
    },
    "giac.gcih": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD 8140 baseline; strong DFIR signal."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 CSSP-Incident-Responder; widely required for IR roles."},
        "alex-novak":     {"tier": "professional", "rationale": "CyberLive partial; strong peer reputation in DFIR."},
    },
    "giac.gcfa": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "DFIR gold standard; CyberLive hands-on."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 baseline; CyberLive; DFIR gold standard hire."},
        "alex-novak":     {"tier": "expert", "rationale": "CyberLive hands-on; deep forensic analysis."},
    },
    "giac.gcia": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Deep packet analysis valued in JP MSS work."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 baseline; CyberLive packet tasks."},
        "alex-novak":     {"tier": "professional", "rationale": "Deep packet analysis is technical depth."},
    },
    "giac.gpen": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD 8140 baseline; CyberLive."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 baseline; CyberLive hands-on; OSCP overshadows in hiring."},
        "alex-novak":     {"tier": "professional", "rationale": "CyberLive partial; OSCP carries higher peer reputation."},
    },
    "giac.grem": {
        "hiroshi-tanaka": {"tier": "specialty", "rationale": "Reverse engineering is a narrow specialty track."},
        "maria-okonkwo":  {"tier": "specialty", "rationale": "Specialty cert; not a linear progression step."},
        "alex-novak":     {"tier": "specialty", "rationale": "Narrow but high-respect specialty."},
    },
    "aws.security-specialty": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "AWS share large in JP cloud; JA exam available; hiring-relevant."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Vendor-specific; high hiring demand for cloud security engineers."},
        "alex-novak":     {"tier": "professional", "rationale": "Vendor-specific cloud focus is modern attack surface."},
    },
    "microsoft.sc-200": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Vendor-specific Sentinel/Defender; JA exam; useful in MS-heavy enterprises."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "Vendor-specific; useful SOC hiring signal at L1/L2."},
        "alex-novak":     {"tier": "associate", "rationale": "Vendor-specific multiple-choice."},
    },
    "google.pcse": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Vendor-specific; GCP share lower in JP than AWS."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Vendor-specific; lower demand than AWS but still a cloud security signal."},
        "alex-novak":     {"tier": "professional", "rationale": "Cloud security; vendor-specific."},
    },
    "iapp.cipp-e": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "GDPR de-facto standard, useful for EU-facing JP corporations."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "ANSI accredited; widely recognised privacy law credential."},
        "alex-novak":     {"tier": "professional", "rationale": "GDPR de-facto for EU advisory work."},
    },
    "ipa.riss": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Sole national-statutory JP cybersecurity registration; mandatory ongoing training."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "High depth + statutory backing; no DoD 8140 listing limits the US hiring signal."},
        "alex-novak":     {"tier": "professional", "rationale": "Strong but JP-only; no peer presence in EU offensive circles."},
    },
    "ipa.sc": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "National statutory exam; gateway to RISS registration."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Rigorous JP national exam."},
        "alex-novak":     {"tier": "professional", "rationale": "Rigorous but JP-only."},
    },
    "ipa.nw": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Senior network design national exam in JP."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "JP-only; networking focus rather than pure security."},
        "alex-novak":     {"tier": "associate", "rationale": "Network design focus; not a security credential proper."},
    },
    "seaj.sea-j": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Recognised by JP MSSPs; multi-track curriculum."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "No recognition outside Japan; training-bundled certifications carry less hiring weight."},
        "alex-novak":     {"tier": "foundational", "rationale": "Training-bundled; no peer presence in EU."},
    },

    # --- Phase 3 additions (web research) ---

    "isc2.csslp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Vendor-neutral SDLC credential carries CISSP-family recognition in JP enterprise."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "ANSI accredited; widely requested for AppSec leads."},
        "alex-novak":     {"tier": "professional", "rationale": "Broad SDLC coverage; no practical component caps it below expert."},
    },
    "offsec.oswe": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "DHS/CISA NICCS listed; advanced practical AppSec is rare and respected."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "47-hour hands-on white-box exam is a strong senior-AppSec hiring signal."},
        "alex-novak":     {"tier": "expert", "rationale": "White-box source-code review and exploit dev under time pressure - peer-revered expert tier."},
    },
    "ec-council.case": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DHS/CISA NICCS listed; useful developer-facing credential but multiple-choice format."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "NICCS recognition; multiple-choice limits hiring signal vs CSSLP."},
        "alex-novak":     {"tier": "associate", "rationale": "Language-specific is helpful; multiple-choice format is a minus."},
    },
    "giac.gcti": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD COOL recognition; SANS-backed; valued in JP MSSPs."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD COOL + ANSI accreditation; the leading proctored CTI credential."},
        "alex-novak":     {"tier": "professional", "rationale": "Proctored CTI with SANS depth; respected in EU intel circles."},
    },
    "ec-council.ctia": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD COOL listing; entry-level CTI."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD COOL + NICCS; multiple-choice limits depth."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice CTI entry; overshadowed by GCTI for senior roles."},
    },
    "crest.crtia": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "UK NCSC partner-recognised; respected for assured intel work."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "UK NCSC recognition; written-analysis component lifts it above pure MCQ."},
        "alex-novak":     {"tier": "professional", "rationale": "EU/UK regulator-recognised CTI pathway; strong written component."},
    },
    "giac.gicsp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD COOL; default ICS workforce credential, valued in JP energy and manufacturing."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD COOL + ANSI; default ICS hire."},
        "alex-novak":     {"tier": "professional", "rationale": "Default ICS workforce credential."},
    },
    "giac.grid": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD COOL; ICS detection/response is a real specialisation in JP infrastructure."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD COOL recognition; premier ICS detection credential."},
        "alex-novak":     {"tier": "professional", "rationale": "Premier ICS active-defence credential."},
    },
    "isa.iec-62443-cf": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "Foundation entry into the ISA expert stack; aligns with Japan's IACS adoption of IEC 62443."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "Training-bundled foundation cert; entry-level."},
        "alex-novak":     {"tier": "foundational", "rationale": "Foundation specialist; entry into the ISA stack."},
    },
    "giac.gmob": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD COOL; few proctored mobile creds exist."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD COOL + ANSI; valuable for BYOD/MDM-heavy enterprises."},
        "alex-novak":     {"tier": "professional", "rationale": "Open-book proctored mobile credential; narrow but technical."},
    },
    "cyberark.pam-def": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Pearson VUE proctored vendor exam; PAM market leader."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "Most-requested vendor cert for PAM operators in US enterprise."},
        "alex-novak":     {"tier": "associate", "rationale": "Vendor-specific operator credential."},
    },
    "microsoft.sc-300": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Vendor-specific Entra ID; JA exam available; Entra dominant in JP enterprise."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "Most-requested IAM operations cert in 2026 hiring."},
        "alex-novak":     {"tier": "associate", "rationale": "Vendor-specific IAM operations; multiple-choice."},
    },
    "isc2.issap": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "ANSI accredited; deep architecture credential, rare in JP."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "ANSI accredited; senior architecture hiring signal."},
        "alex-novak":     {"tier": "professional", "rationale": "Strong neutral architecture cert; no practical component limits the offensive perspective."},
    },
    "sailpoint.identityiq-engineer": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "IGA market leader; SailPoint widely deployed in JP enterprises."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Widely required for IGA engineer hires."},
        "alex-novak":     {"tier": "professional", "rationale": "Vendor-specific IGA engineer credential."},
    },
    "microsoft.sc-100": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "NICCS listed; capstone of Microsoft security ladder; Zero Trust focus."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "NICCS recognition; capstone Microsoft cybersecurity architect cert."},
        "alex-novak":     {"tier": "expert", "rationale": "Architecture capstone; Zero Trust modern relevance."},
    },
    "microsoft.az-500": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Vendor-specific Azure security; JA exam."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "Widely requested Azure-specific operational security cert."},
        "alex-novak":     {"tier": "associate", "rationale": "Vendor-specific multiple-choice."},
    },
    "giac.gcsa": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD COOL; DevSecOps niche increasingly requested in JP cloud-native shops."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD COOL + ANSI; leading DevSecOps credential."},
        "alex-novak":     {"tier": "professional", "rationale": "Strong DevSecOps focus; modern attack surface."},
    },
    "cisco.cyberops-associate": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD 8140 aligned; JA exam available."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD 8140 aligned; popular SOC L1 hire signal."},
        "alex-novak":     {"tier": "associate", "rationale": "SOC fundamentals; vendor-leaning."},
    },
    "csa.ccsk-v5": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "NICCS listed; vendor-neutral cloud foundation."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "NICCS listed; open-book lowers hiring weight."},
        "alex-novak":     {"tier": "foundational", "rationale": "Open-book foundation; useful priming for CCSP."},
    },
    "certnexus.caip": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "DoD COOL + ANSI; AI literacy is increasingly relevant to JP enterprise governance."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "DoD COOL + ANSI; first neutral AI cert recognised in DoD."},
        "alex-novak":     {"tier": "associate", "rationale": "Multiple-choice; emerging area but credential is foundational."},
    },

    # --- Round 2 additions: OffSec, ISC2, IPA gap fills ---

    # OffSec course-code rule (per maintainer): 100 = foundational,
    # 200 = professional, 300 = expert, 400 = specialty (apex).
    "offsec.klcp": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "PEN-103 is the OffSec 100-level Kali Linux fundamentals exam."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "OffSec 100-level OS-fundamentals credential."},
        "alex-novak":     {"tier": "foundational", "rationale": "100-level Kali Linux fundamentals — narrow but foundational."},
    },
    "offsec.oscc-sjd": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "SJD-100 is the OffSec 100-level secure software development entry."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "100-level secure-coding fundamentals."},
        "alex-novak":     {"tier": "foundational", "rationale": "100-level secure software development fundamentals."},
    },
    "offsec.osda": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Per OffSec course-code convention 200=professional. Hands-on blue-team practical with NICCS recognition."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "SOC-200 sits at the same OffSec professional tier as OSCP/OSWA; 24-hour hands-on; NICCS-listed."},
        "alex-novak":     {"tier": "professional", "rationale": "Defensive 200-level peer of OSCP — same hands-on practical caliber, blue-team scope."},
    },
    "offsec.osed": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "EXP-301 is OffSec 300-level expert exploit-dev."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "300-level OffSec hands-on expert tier."},
        "alex-novak":     {"tier": "expert", "rationale": "48-hour practical exploit-dev exam at the 300-level expert band."},
    },
    "offsec.oswp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Per OffSec course-code convention 200=professional. Narrow wireless scope but hands-on practical."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "200-level OffSec hands-on; aligns with the OSCP/OSDA professional tier band."},
        "alex-novak":     {"tier": "professional", "rationale": "PEN-210 is at the OffSec 200 professional band, just narrowly scoped to wireless."},
    },
    "offsec.osce3": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "OffSec OSCE3 designation — earned by holding all three 300-level expert certs (OSEP+OSWE+OSED)."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "Aggregate expert designation — three 300-level certs combined."},
        "alex-novak":     {"tier": "expert", "rationale": "OSCE3 is the conventional expert milestone before OSEE."},
    },
    "offsec.osee": {
        "hiroshi-tanaka": {"tier": "specialty", "rationale": "EXP-401 is the OffSec 400-level apex specialist track beyond OSCE3."},
        "maria-okonkwo":  {"tier": "specialty", "rationale": "Specialist apex — small holder pool, very narrow advanced exploitation scope."},
        "alex-novak":     {"tier": "specialty", "rationale": "Beyond the standard expert ladder; 400-level specialist."},
    },
    "offsec.osmr": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Per OffSec course-code convention 300=expert. EXP-312 follows OSED in the exploit-dev ladder."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "300-level OffSec exploit-research; same band as OSED/OSEP."},
        "alex-novak":     {"tier": "expert", "rationale": "EXP-312 is expert-tier hands-on exploit research; macOS focus is the specialization, not a tier-down."},
    },
    "offsec.oswa": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "NICCS-listed 24-hour practical; same hands-on rigor as OSCP, just web-scoped."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Web-pentest peer of OSCP at the same hands-on tier; widely accepted as OSCP-equivalent for web roles."},
        "alex-novak":     {"tier": "professional", "rationale": "Practical 24-hour black-box web exam — same tier as OSCP in the offensive ladder."},
    },

    "isc2.issep": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "DoD 8140; NSA-endorsed for systems security engineering."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 IASAE baseline; senior systems security engineer hire."},
        "alex-novak":     {"tier": "expert", "rationale": "Deep, no practical, but ANSI accredited and NSA endorsed."},
    },
    "isc2.issmp": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Management depth at CISO interview level; ANSI accredited."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "DoD 8140 baseline; senior management hire."},
        "alex-novak":     {"tier": "professional", "rationale": "Management focus; not technical depth."},
    },
    "isc2.cc": {
        "hiroshi-tanaka": {"tier": "introductory", "rationale": "ANSI accredited but designed as cybersecurity literacy for new entrants; below the foundational engineer threshold."},
        "maria-okonkwo":  {"tier": "introductory", "rationale": "Entry-level literacy credential; ISC2 One Million programme makes it explicitly an introductory step."},
        "alex-novak":     {"tier": "introductory", "rationale": "Cybersecurity literacy, not yet an engineer-tier credential."},
    },
    "isc2.cgrc": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "DoD 8140; aligned with NIST RMF widely used in JP enterprise compliance work."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "DoD 8140 baseline; NIST RMF focus is hire-relevant for federal-adjacent work."},
        "alex-novak":     {"tier": "professional", "rationale": "RMF-focused; not practical but ANSI-accredited."},
    },
    "isc2.hcispp": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "ANSI accredited; healthcare-vertical depth."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "ANSI accredited; vertical-specific but a real hiring signal in US healthcare."},
        "alex-novak":     {"tier": "professional", "rationale": "Vertical-specific privacy and security; ANSI accredited."},
    },

    "ipa.ip": {
        "hiroshi-tanaka": {"tier": "introductory", "rationale": "Pre-engineer IT literacy. JP corporate onboarding tool, not an IT engineer credential."},
        "maria-okonkwo":  {"tier": "introductory", "rationale": "JP-only IT-literacy exam; below FE foundational engineer tier."},
        "alex-novak":     {"tier": "introductory", "rationale": "Pre-engineer literacy; not security."},
    },
    "ipa.fe": {
        "hiroshi-tanaka": {"tier": "foundational", "rationale": "Gateway to higher IPA exams; broad IT fundamentals."},
        "maria-okonkwo":  {"tier": "foundational", "rationale": "JP-only IT fundamentals."},
        "alex-novak":     {"tier": "foundational", "rationale": "Broad IT not security-specific."},
    },
    "ipa.ap": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "Mid-career broad applied IT; expected at many JP IT departments."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "JP-only mid-tier IT."},
        "alex-novak":     {"tier": "associate", "rationale": "Broad applied IT; partial security coverage."},
    },
    "ipa.db": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "IPA skill level 4; deep DB design and security."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "JP-only; database focus rather than pure security."},
        "alex-novak":     {"tier": "associate", "rationale": "DB depth, not a security credential per se."},
    },
    "ipa.es": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Embedded depth aligns with JP manufacturing OT relevance."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Embedded/IoT depth; OT relevance growing."},
        "alex-novak":     {"tier": "professional", "rationale": "Embedded depth; partial security coverage."},
    },
    "ipa.sa": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "Enterprise architecture depth; valued in JP system integrators."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "JP-only but architecture-focused."},
        "alex-novak":     {"tier": "professional", "rationale": "Architecture depth; partial security."},
    },
    "ipa.pm": {
        "hiroshi-tanaka": {"tier": "associate", "rationale": "PM depth, not security-focused."},
        "maria-okonkwo":  {"tier": "associate", "rationale": "Project management; not security."},
        "alex-novak":     {"tier": "associate", "rationale": "PM, not security."},
    },
    "ipa.au": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "Most senior IPA audit exam; recognised by JP financial regulators."},
        "maria-okonkwo":  {"tier": "expert", "rationale": "Top-tier JP audit credential."},
        "alex-novak":     {"tier": "expert", "rationale": "Senior audit credential; analogous to CISA in JP context."},
    },
    "ipa.st": {
        "hiroshi-tanaka": {"tier": "expert", "rationale": "CIO-track strategy depth in JP."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Strategy focus; not security per se."},
        "alex-novak":     {"tier": "professional", "rationale": "Strategy not security."},
    },
    "ipa.sm": {
        "hiroshi-tanaka": {"tier": "professional", "rationale": "IT operations and incident management depth."},
        "maria-okonkwo":  {"tier": "professional", "rationale": "Service management with incident depth."},
        "alex-novak":     {"tier": "professional", "rationale": "Service management; partial security."},
    },
}


def median_tier(scores: list[str], tier_order: dict[str, int]) -> str:
    """
    Median of three persona tiers, ties broken toward 'professional'.
    'specialty' is treated separately - if any persona says specialty,
    the consensus is specialty (specialty is unordered in the rubric).
    """
    if any(s == "specialty" for s in scores):
        return "specialty"
    sorted_scores = sorted(scores, key=lambda s: tier_order[s])
    return sorted_scores[1]


def consensus_rationale(persona_scores: dict[str, dict[str, str]], tier: str) -> str:
    agreeing = [name for name, p in persona_scores.items() if p["tier"] == tier]
    if len(agreeing) == 3:
        return "All three personas agree at this tier; rationale reflects consensus."
    return f"Consensus tier '{tier}' supported by {', '.join(agreeing)}; see persona_scores for the dissenting view."


def fallback_persona_scores(data):
    """
    For certs without an explicit PERSONAS entry, derive a conservative
    consensus from the cert's third_party_evaluations[].level_hint values.
    Marks the rationale so reviewers can see this was auto-derived and
    is pending differentiated human review.
    """
    hints = [e.get("level_hint") for e in (data.get("third_party_evaluations") or [])
             if e.get("level_hint")]
    if not hints:
        return None  # cannot derive
    # Take the most-common hint (mode); ties broken by first occurrence.
    counts = {}
    for h in hints:
        counts[h] = counts.get(h, 0) + 1
    chosen = max(counts.items(), key=lambda kv: (kv[1], -hints.index(kv[0])))[0]
    rationale = (f"Auto-derived from third-party evaluations ({', '.join(hints)}); "
                 f"pending differentiated human persona review.")
    return {
        "hiroshi-tanaka": {"tier": chosen, "rationale": rationale},
        "maria-okonkwo":  {"tier": chosen, "rationale": rationale},
        "alex-novak":     {"tier": chosen, "rationale": rationale},
    }


def main() -> int:
    tiers_doc = json.loads(TIERS_PATH.read_text(encoding="utf-8"))
    tier_order = {t["id"]: t["order"] for t in tiers_doc["tiers"] if t["id"] != "specialty"}
    thresholds = tiers_doc["evaluation_thresholds"]
    max_disagreement = thresholds["max_persona_disagreement_tiers"]
    max_share = thresholds["max_disagreement_share"]

    cert_paths = sorted(CERTS_DIR.glob("*/*.json"))
    missing = []
    auto_filled = []
    disagreements = []
    now_iso = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    for path in cert_paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        cert_id = data["id"]
        if cert_id in PERSONAS:
            persona_scores = PERSONAS[cert_id]
        else:
            persona_scores = fallback_persona_scores(data)
            if persona_scores is None:
                missing.append(cert_id)
                continue
            auto_filled.append(cert_id)
        scores = [p["tier"] for p in persona_scores.values()]
        chosen = median_tier(scores, tier_order)

        # Disagreement metric: ignore certs where any persona said specialty.
        if "specialty" not in scores:
            ords = [tier_order[s] for s in scores]
            spread = max(ords) - min(ords)
            if spread > max_disagreement:
                disagreements.append((cert_id, scores, spread))

        data["evaluation"] = {
            "computed_tier": chosen,
            "computed_at": now_iso,
            "computed_by_skill": SKILL_VERSION,
            "rationale": consensus_rationale(persona_scores, chosen),
            "persona_scores": persona_scores,
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if missing:
        print(f"ERROR: no PERSONAS entry AND no third_party_evaluations[].level_hint for:", file=sys.stderr)
        for cid in missing:
            print(f"  - {cid}", file=sys.stderr)
        return 2

    n = len(cert_paths)
    share = len(disagreements) / n if n else 0
    print(f"Evaluated {n} certs; {len(disagreements)} with >1-tier persona spread ({share:.1%}).")
    if auto_filled:
        print(f"  (of which {len(auto_filled)} were auto-derived from third-party hints; "
              f"add explicit PERSONAS entries to differentiate)")
    if share > max_share:
        print(f"FAIL: persona disagreement share {share:.1%} exceeds {max_share:.0%} threshold.", file=sys.stderr)
        for cid, sc, spread in disagreements:
            print(f"  - {cid}: {sc} (spread={spread})", file=sys.stderr)
        print("", file=sys.stderr)
        print("Per the skill: revise the rubric or persona weights, NOT the per-cert data.", file=sys.stderr)
        return 1

    print("OK: persona disagreement within threshold.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
