#!/usr/bin/env python3
"""
Generate ~77 cert JSONs from compact specs gathered by web research agents.

Each spec carries the minimum fields the schema requires plus the third-party
recognition URL the agent found. Plus/minus scoring factors are derived from
the cert family + tier hint so the rubric has something to chew on; the
3-persona evaluation skill computes the actual tier later.

Run: python3 scripts/seed_round_2.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CERTS_DIR = ROOT / "data" / "certs"
TODAY = "2026-05-02"


def base_factors(spec):
    """Derive a minimal but defensible scoring_factors block from spec metadata."""
    plus, minus = [], []
    family = spec.get("family", "")
    tier = spec["tier_hint"]
    src_id = spec.get("third_party_source", "")

    # Recognition signals
    if "dod-cool" in src_id or "dod-8140" in src_id:
        plus.append({"code": "DOD_COOL_RECOGNISED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "niccs" in src_id:
        plus.append({"code": "DHS_CISA_NICCS_LISTED", "weight_hint": "medium",
                     "evidence": spec["third_party_url"]})
    if "ansi" in src_id or "ias" in src_id or "ukas" in src_id or "iaf" in src_id:
        plus.append({"code": "ANSI_OR_ISO_17024_ACCREDITED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "ncsc" in src_id or "bankofengland" in src_id:
        plus.append({"code": "UK_REGULATOR_RECOGNISED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "csa.gov.sg" in src_id:
        plus.append({"code": "SG_GOV_ALIGNED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "pipc.go.kr" in src_id:
        plus.append({"code": "KR_GOV_RECOGNISED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "meti" in src_id or "ipa" in src_id and spec.get("japan_only"):
        plus.append({"code": "JP_NATIONAL_OR_INDUSTRY_RECOGNITION", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "pearsonvue" in src_id:
        plus.append({"code": "PEARSON_VUE_PROCTORED", "weight_hint": "medium",
                     "evidence": spec["third_party_url"]})
    if "cqi-irca" in src_id:
        plus.append({"code": "CQI_IRCA_REGISTERED", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "isms-ac" in src_id:
        plus.append({"code": "JAB_RECOGNISED_AUDITOR_SCHEME", "weight_hint": "high",
                     "evidence": spec["third_party_url"]})
    if "csa" in src_id and "gov.sg" not in src_id:
        plus.append({"code": "CLOUD_SECURITY_ALLIANCE_BACKED", "weight_hint": "medium",
                     "evidence": spec["third_party_url"]})

    # Family-specific signals
    if family == "vendor-network":
        plus.append({"code": "VENDOR_SOURCE_OF_TRUTH", "weight_hint": "high"})
        plus.append({"code": "PRODUCTION_RELEVANCE_HIRING", "weight_hint": "medium"})
        minus.append({"code": "VENDOR_SPECIFIC_NOT_PORTABLE", "weight_hint": "medium"})
    elif family == "vendor-cloud":
        plus.append({"code": "VENDOR_SOURCE_OF_TRUTH", "weight_hint": "high"})
        plus.append({"code": "MODERN_ATTACK_SURFACE", "weight_hint": "medium"})
        minus.append({"code": "VENDOR_SPECIFIC_NOT_PORTABLE", "weight_hint": "medium"})
    elif family == "vendor-siem":
        plus.append({"code": "VENDOR_SOURCE_OF_TRUTH_SIEM", "weight_hint": "high"})
        plus.append({"code": "SOC_PRODUCTION_RELEVANCE", "weight_hint": "high"})
        minus.append({"code": "VENDOR_SPECIFIC_NOT_PORTABLE", "weight_hint": "medium"})
    elif family == "practical-pentest":
        plus.append({"code": "FULLY_HANDS_ON_PRACTICAL", "weight_hint": "high"})
        plus.append({"code": "MODERN_OFFENSIVE_FOCUS", "weight_hint": "high"})
        if tier in ("foundational", "associate"):
            minus.append({"code": "NEWER_BRAND_LIMITED_HIRING_RECOGNITION", "weight_hint": "medium"})
    elif family == "practical-defensive":
        plus.append({"code": "FULLY_HANDS_ON_PRACTICAL", "weight_hint": "high"})
        plus.append({"code": "BLUE_TEAM_PRACTICAL_FOCUS", "weight_hint": "high"})
    elif family == "giac":
        plus.append({"code": "ANSI_ISO_17024_ACCREDITED", "weight_hint": "high"})
        plus.append({"code": "BACKED_BY_SANS_TRAINING", "weight_hint": "medium"})
        minus.append({"code": "EXPENSIVE_BUNDLE", "weight_hint": "medium"})
    elif family == "iso-auditor":
        plus.append({"code": "ISO_17024_ACCREDITED_PERSONNEL_SCHEME", "weight_hint": "high"})
        plus.append({"code": "GLOBAL_ISMS_BCMS_PIMS_AUDIT_DEMAND", "weight_hint": "high"})
    elif family == "jp-national":
        plus.append({"code": "JP_NATIONAL_OR_INDUSTRY_RECOGNITION", "weight_hint": "high"})
        minus.append({"code": "JAPAN_LOCAL_RECOGNITION_ONLY", "weight_hint": "high"})
    elif family == "crest":
        plus.append({"code": "CREST_REGISTERED_SCHEME", "weight_hint": "high"})
        plus.append({"code": "UK_NCSC_PARTNER_RECOGNITION", "weight_hint": "high"})
    elif family == "linux-foundation":
        plus.append({"code": "VENDOR_NEUTRAL_LINUX_TRACK", "weight_hint": "medium"})
    elif family == "intl-vendor-neutral":
        plus.append({"code": "INDEPENDENT_BODY_RECOGNITION", "weight_hint": "high"})

    # Tier-relative signals
    if tier == "expert":
        plus.append({"code": "SENIOR_SCOPE_AND_RIGOR", "weight_hint": "high"})
    if tier == "specialty":
        minus.append({"code": "VERY_NARROW_USE_CASE", "weight_hint": "medium"})
    if tier == "foundational":
        minus.append({"code": "ENTRY_LEVEL_LIMITED_HIRING_SIGNAL", "weight_hint": "medium"})

    # Dedupe by code, keep first occurrence
    def dedupe(items):
        seen, out = set(), []
        for it in items:
            if it["code"] in seen: continue
            seen.add(it["code"])
            out.append(it)
        return out

    return {"plus": dedupe(plus) or [{"code": "PROCTORED_EXAM", "weight_hint": "medium"}],
            "minus": dedupe(minus) or [{"code": "GENERAL_LIMITATIONS", "weight_hint": "low"}]}


def make_cert(spec):
    rel_path = CERTS_DIR / spec["vendor_slug"] / f'{spec["slug"]}.json'
    src_id = spec.get("third_party_source", "third-party")
    cert = {
        "id": spec["id"],
        "vendor": {
            "slug": spec["vendor_slug"],
            "name": spec["vendor_name"],
            "url":  spec["vendor_url"],
        },
        "name": spec["name"],
        "abbr": spec["abbr"],
        "domain": spec["domain"],
        "secondary_domains": spec.get("secondary_domains", []),
        "japan_only": spec.get("japan_only", False),
        "official": {
            "exam_url":   spec["official_url"],
            "fetched_at": TODAY,
        },
        "logistics": {
            "cost_usd": spec.get("cost_usd"),
            "format": spec.get("format", "Proctored exam"),
        },
        "prerequisites": {
            "formal": [],
            "experience_years": spec.get("experience_years", 0),
            "recommended_certs": spec.get("recommended_certs", []),
        },
        "scoring_factors": base_factors(spec),
        "third_party_evaluations": [{
            "source_id":  src_id,
            "level_hint": spec["tier_hint"],
            "url":        spec["third_party_url"],
            "fetched_at": TODAY,
            "summary":    spec.get("summary", ""),
        }],
        "sources": [
            {"type": "official", "url": spec["official_url"]},
            {"type": "third_party", "url": spec["third_party_url"]},
        ],
        "evaluation": {
            "computed_tier": None, "computed_at": None,
            "computed_by_skill": None, "rationale": None,
        },
        "schema_version": 1,
    }
    if "name_ja" in spec:
        cert["name_ja"] = spec["name_ja"]
    # Drop optional logistics keys that were left None.
    if cert["logistics"]["cost_usd"] is None:
        del cert["logistics"]["cost_usd"]
    return rel_path, cert


SPECS = [
    # ---------------- Vendor: Cisco ----------------
    {"id": "cisco.cyberops-professional", "vendor_slug": "cisco", "vendor_name": "Cisco", "vendor_url": "https://www.cisco.com/", "name": "Cisco Certified CyberOps Professional", "abbr": "CyberOps Pro", "slug": "cyberops-professional", "domain": "incident-forensics", "secondary_domains": ["network-defense"], "official_url": "https://learningnetwork.cisco.com/s/cyberops-professional", "third_party_source": "cisco-dod8140", "third_party_url": "https://www.cisco.com/site/us/en/learn/training-certifications/training/dod-8140.html", "cost_usd": 700, "tier_hint": "professional", "summary": "Two-exam SOC analyst track (CBRCOR + CBRFIR) covering advanced detection, automation, forensics and IR using Cisco tooling.", "family": "vendor-network", "experience_years": 3},
    {"id": "cisco.cbrfir-300-215", "vendor_slug": "cisco", "vendor_name": "Cisco", "vendor_url": "https://www.cisco.com/", "name": "Conducting Forensic Analysis and Incident Response Using Cisco Technologies for CyberOps", "abbr": "CBRFIR 300-215", "slug": "cbrfir-300-215", "domain": "incident-forensics", "official_url": "https://www.cisco.com/site/us/en/learn/training-certifications/exams/cbrfir.html", "third_party_source": "cisco-dod8140", "third_party_url": "https://www.cisco.com/site/us/en/learn/training-certifications/training/dod-8140.html", "cost_usd": 300, "tier_hint": "professional", "summary": "Concentration exam validating digital forensics, evidence handling, and incident response on Cisco platforms.", "family": "vendor-network", "experience_years": 3},
    {"id": "cisco.ccnp-security", "vendor_slug": "cisco", "vendor_name": "Cisco", "vendor_url": "https://www.cisco.com/", "name": "Cisco Certified Network Professional Security", "abbr": "CCNP Security", "slug": "ccnp-security", "domain": "network-defense", "official_url": "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/security/ccnp-security/index.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/intellectual-point/cisco-ccnp-security", "cost_usd": 700, "tier_hint": "professional", "summary": "Core 350-701 SCOR plus one concentration covering network, cloud, content, endpoint, and secure access on Cisco.", "family": "vendor-network", "experience_years": 3},
    {"id": "cisco.ccie-security", "vendor_slug": "cisco", "vendor_name": "Cisco", "vendor_url": "https://www.cisco.com/", "name": "Cisco Certified Internetwork Expert Security", "abbr": "CCIE Security", "slug": "ccie-security", "domain": "security-architecture", "secondary_domains": ["network-defense"], "official_url": "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/security/ccie-security/index.html", "third_party_source": "cisco-dod8140", "third_party_url": "https://www.cisco.com/site/us/en/learn/training-certifications/training/dod-8140.html", "cost_usd": 2000, "tier_hint": "expert", "summary": "8-hour hands-on lab plus 350-701 qualifier validating expert design, deployment, and operations of Cisco security solutions.", "family": "vendor-network", "experience_years": 7},

    # ---------------- Vendor: Palo Alto Networks ----------------
    {"id": "paloalto.network-security-generalist", "vendor_slug": "paloalto", "vendor_name": "Palo Alto Networks", "vendor_url": "https://www.paloaltonetworks.com/", "name": "Palo Alto Networks Certified Network Security Generalist", "abbr": "PCNSG", "slug": "network-security-generalist", "domain": "network-defense", "official_url": "https://www.paloaltonetworks.com/services/education/certification", "third_party_source": "pearsonvue-paloalto", "third_party_url": "https://www.pearsonvue.com/us/en/paloaltonetworks.html", "cost_usd": 150, "tier_hint": "foundational", "summary": "Foundational role-based exam covering core NGFW concepts, Strata, Prisma, and Cortex platform fundamentals.", "family": "vendor-network", "experience_years": 1},
    {"id": "paloalto.ngfw-engineer", "vendor_slug": "paloalto", "vendor_name": "Palo Alto Networks", "vendor_url": "https://www.paloaltonetworks.com/", "name": "Palo Alto Networks Certified Next-Generation Firewall Engineer", "abbr": "PAN NGFW Eng", "slug": "ngfw-engineer", "domain": "network-defense", "official_url": "https://www.paloaltonetworks.com/services/education/certification", "third_party_source": "pearsonvue-paloalto", "third_party_url": "https://www.pearsonvue.com/us/en/paloaltonetworks.html", "cost_usd": 200, "tier_hint": "professional", "summary": "PCNSE successor validating NGFW deployment, Panorama, identity, SSL decryption, and automation at scale.", "family": "vendor-network", "experience_years": 3},
    {"id": "paloalto.security-operations-analyst", "vendor_slug": "paloalto", "vendor_name": "Palo Alto Networks", "vendor_url": "https://www.paloaltonetworks.com/", "name": "Palo Alto Networks Certified Security Operations Analyst", "abbr": "PAN SecOps", "slug": "security-operations-analyst", "domain": "incident-forensics", "official_url": "https://www.paloaltonetworks.com/services/education/certification", "third_party_source": "pearsonvue-paloalto", "third_party_url": "https://www.pearsonvue.com/us/en/paloaltonetworks.html", "cost_usd": 200, "tier_hint": "professional", "summary": "Cortex XSIAM/XDR/XSOAR analyst exam covering SOC triage, investigation, and automated response.", "family": "vendor-network", "experience_years": 2},
    {"id": "paloalto.cloud-security-professional", "vendor_slug": "paloalto", "vendor_name": "Palo Alto Networks", "vendor_url": "https://www.paloaltonetworks.com/", "name": "Palo Alto Networks Certified Cloud Security Professional", "abbr": "PAN Cloud Pro", "slug": "cloud-security-professional", "domain": "cloud-security", "official_url": "https://www.paloaltonetworks.com/services/education/certification", "third_party_source": "pearsonvue-paloalto", "third_party_url": "https://www.pearsonvue.com/us/en/paloaltonetworks.html", "cost_usd": 200, "tier_hint": "professional", "summary": "Prisma Cloud (CNAPP) professional exam covering CSPM, CWPP, IaC, and runtime defense.", "family": "vendor-cloud", "experience_years": 3},

    # ---------------- Vendor: Fortinet ----------------
    {"id": "fortinet.nse4-fortios-admin", "vendor_slug": "fortinet", "vendor_name": "Fortinet", "vendor_url": "https://www.fortinet.com/", "name": "NSE 4 - FortiOS Administrator", "abbr": "NSE 4", "slug": "nse4-fortios-admin", "domain": "network-defense", "official_url": "https://training.fortinet.com/local/staticpage/view.php?page=fortios_administrator_exam", "third_party_source": "pearsonvue-fortinet", "third_party_url": "https://www.pearsonvue.com/us/en/fortinet.html", "cost_usd": 400, "tier_hint": "associate", "summary": "FortiGate day-to-day admin: policies, NAT, VPN, SD-WAN, FortiGuard services and HA.", "family": "vendor-network", "experience_years": 1},
    {"id": "fortinet.nse5-fortianalyzer", "vendor_slug": "fortinet", "vendor_name": "Fortinet", "vendor_url": "https://www.fortinet.com/", "name": "NSE 5 - FortiAnalyzer Analyst", "abbr": "NSE 5 FAZ", "slug": "nse5-fortianalyzer", "domain": "incident-forensics", "official_url": "https://training.fortinet.com/local/staticpage/view.php?page=nse_5", "third_party_source": "pearsonvue-fortinet", "third_party_url": "https://www.pearsonvue.com/us/en/fortinet.html", "cost_usd": 400, "tier_hint": "associate", "summary": "Log management, event correlation, reporting, and SOC workflows on FortiAnalyzer.", "family": "vendor-network", "experience_years": 2},
    {"id": "fortinet.nse7-secops", "vendor_slug": "fortinet", "vendor_name": "Fortinet", "vendor_url": "https://www.fortinet.com/", "name": "NSE 7 - Security Operations", "abbr": "NSE 7 SecOps", "slug": "nse7-secops", "domain": "incident-forensics", "official_url": "https://training.fortinet.com/local/staticpage/view.php?page=fcss_security_operations", "third_party_source": "pearsonvue-fortinet", "third_party_url": "https://www.pearsonvue.com/us/en/fortinet.html", "cost_usd": 400, "tier_hint": "professional", "summary": "Advanced threat detection, EDR/XDR, deception, and automated response across the Fortinet Security Fabric.", "family": "vendor-network", "experience_years": 3},
    {"id": "fortinet.nse8", "vendor_slug": "fortinet", "vendor_name": "Fortinet", "vendor_url": "https://www.fortinet.com/", "name": "NSE 8 - Network Security Expert", "abbr": "NSE 8", "slug": "nse8", "domain": "security-architecture", "secondary_domains": ["network-defense"], "official_url": "https://training.fortinet.com/local/staticpage/view.php?page=nse_8_certification", "third_party_source": "pearsonvue-fortinet", "third_party_url": "https://www.pearsonvue.com/us/en/fortinet.html", "cost_usd": 400, "tier_hint": "expert", "summary": "Expert-level theory + scenario exam validating end-to-end Fortinet Security Fabric design.", "family": "vendor-network", "experience_years": 5},

    # ---------------- Vendor: Check Point ----------------
    {"id": "checkpoint.ccsa-r82", "vendor_slug": "checkpoint", "vendor_name": "Check Point Software Technologies", "vendor_url": "https://www.checkpoint.com/", "name": "Check Point Certified Security Administrator R82", "abbr": "CCSA R82", "slug": "ccsa-r82", "domain": "network-defense", "official_url": "https://training-certifications.checkpoint.com/", "third_party_source": "pearsonvue-checkpoint", "third_party_url": "https://www.pearsonvue.com/us/en/checkpoint.html", "cost_usd": 300, "tier_hint": "associate", "summary": "Daily admin of Check Point Quantum gateways and SmartConsole.", "family": "vendor-network", "experience_years": 1},
    {"id": "checkpoint.ccse-r82", "vendor_slug": "checkpoint", "vendor_name": "Check Point Software Technologies", "vendor_url": "https://www.checkpoint.com/", "name": "Check Point Certified Security Expert R82", "abbr": "CCSE R82", "slug": "ccse-r82", "domain": "network-defense", "official_url": "https://training-certifications.checkpoint.com/", "third_party_source": "pearsonvue-checkpoint", "third_party_url": "https://www.pearsonvue.com/us/en/checkpoint.html", "cost_usd": 300, "tier_hint": "professional", "summary": "Advanced gateway tuning, clustering, VPN site-to-site, identity awareness.", "family": "vendor-network", "experience_years": 3},
    {"id": "checkpoint.ccsm-elite", "vendor_slug": "checkpoint", "vendor_name": "Check Point Software Technologies", "vendor_url": "https://www.checkpoint.com/", "name": "Check Point Certified Security Master Elite", "abbr": "CCSM Elite", "slug": "ccsm-elite", "domain": "security-architecture", "secondary_domains": ["network-defense"], "official_url": "https://training-certifications.checkpoint.com/", "third_party_source": "pearsonvue-checkpoint", "third_party_url": "https://www.pearsonvue.com/us/en/checkpoint.html", "cost_usd": 300, "tier_hint": "expert", "summary": "Top-tier Check Point credential requiring CCSM plus advanced ISA specializations.", "family": "vendor-network", "experience_years": 5},

    # ---------------- Vendor: Juniper ----------------
    {"id": "juniper.jncis-sec", "vendor_slug": "juniper", "vendor_name": "Juniper Networks", "vendor_url": "https://www.juniper.net/", "name": "Juniper Networks Certified Specialist Security", "abbr": "JNCIS-SEC", "slug": "jncis-sec", "domain": "network-defense", "official_url": "https://www.juniper.net/us/en/training/certification/tracks/security/jncis-sec.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/test-pass-academy-llc/juniper-introduction-junos-operating-system-ijos", "cost_usd": 200, "tier_hint": "associate", "summary": "SRX policy, NAT, IPsec VPN, ALGs, and Junos security services for specialist engineers.", "family": "vendor-network", "experience_years": 2},
    {"id": "juniper.jncip-sec", "vendor_slug": "juniper", "vendor_name": "Juniper Networks", "vendor_url": "https://www.juniper.net/", "name": "Juniper Networks Certified Professional Security", "abbr": "JNCIP-SEC", "slug": "jncip-sec", "domain": "network-defense", "official_url": "https://www.juniper.net/us/en/training/certification/tracks/security/jncip-sec.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/test-pass-academy-llc/juniper-introduction-junos-operating-system-ijos", "cost_usd": 300, "tier_hint": "professional", "summary": "Advanced SRX deployment - chassis cluster, AppSecure, Sky ATP, IDP.", "family": "vendor-network", "experience_years": 3},
    {"id": "juniper.jncie-sec", "vendor_slug": "juniper", "vendor_name": "Juniper Networks", "vendor_url": "https://www.juniper.net/", "name": "Juniper Networks Certified Expert Security", "abbr": "JNCIE-SEC", "slug": "jncie-sec", "domain": "security-architecture", "secondary_domains": ["network-defense"], "official_url": "https://www.juniper.net/us/en/training/certification/tracks/security/jncie-sec.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/test-pass-academy-llc/juniper-introduction-junos-operating-system-ijos", "cost_usd": 1400, "tier_hint": "expert", "summary": "8-hour hands-on lab; design, build, troubleshoot enterprise-scale Junos security infra.", "family": "vendor-network", "experience_years": 6},

    # ---------------- Vendor: Splunk ----------------
    {"id": "splunk.core-power-user", "vendor_slug": "splunk", "vendor_name": "Splunk", "vendor_url": "https://www.splunk.com/", "name": "Splunk Core Certified Power User", "abbr": "SPLK-1002", "slug": "core-power-user", "domain": "incident-forensics", "official_url": "https://www.splunk.com/en_us/training/certification-track/splunk-core-certified-power-user.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/cybrary/splunk-enterprise-certified-administrator", "cost_usd": 130, "tier_hint": "associate", "summary": "SPL search proficiency, field extractions, lookups, and dashboards.", "family": "vendor-siem", "experience_years": 1},
    {"id": "splunk.es-cert-admin", "vendor_slug": "splunk", "vendor_name": "Splunk", "vendor_url": "https://www.splunk.com/", "name": "Splunk Enterprise Security Certified Admin", "abbr": "SPLK-3001", "slug": "es-cert-admin", "domain": "incident-forensics", "official_url": "https://www.splunk.com/en_us/training/certification-track/splunk-enterprise-security-certified-admin.html", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/cybrary/splunk-enterprise-certified-administrator", "cost_usd": 130, "tier_hint": "professional", "summary": "Splunk ES install, tuning, notable events, asset/identity correlation, RBA.", "family": "vendor-siem", "experience_years": 3},

    # ---------------- INE Security (eLearnSecurity successor) ----------------
    {"id": "ine.ejpt", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Junior Penetration Tester", "abbr": "eJPT", "slug": "ejpt", "domain": "offensive-redteam", "official_url": "https://ine.com/security/certifications/ejpt-certification", "third_party_source": "onetonline", "third_party_url": "https://www.onetonline.org/link/certinfo/13768-D", "cost_usd": 250, "tier_hint": "foundational", "summary": "Hands-on entry-level network pentest; widely respected practical alternative to Security+.", "family": "practical-pentest"},
    {"id": "ine.ecppt", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Certified Professional Penetration Tester", "abbr": "eCPPT", "slug": "ecppt", "domain": "offensive-redteam", "official_url": "https://ine.com/security/certifications/ecppt-certification", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 400, "tier_hint": "professional", "summary": "Multi-day practical pentest with full report; mid-tier alternative to OSCP.", "family": "practical-pentest", "experience_years": 2},
    {"id": "ine.ewpt", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Web Application Penetration Tester", "abbr": "eWPT", "slug": "ewpt", "domain": "application-appsec", "official_url": "https://ine.com/security/certifications/ewpt-certification", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 400, "tier_hint": "professional", "summary": "Practical web-app pentest exam covering OWASP Top 10 with full reporting.", "family": "practical-pentest", "experience_years": 2},
    {"id": "ine.ewptx", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Web App Pentester eXtreme", "abbr": "eWPTX", "slug": "ewptx", "domain": "application-appsec", "official_url": "https://ine.com/security/certifications/ewptx-certification", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 500, "tier_hint": "expert", "summary": "Advanced web-app exploitation: SSTI, deserialization, NoSQLi, custom payload chains.", "family": "practical-pentest", "experience_years": 4},
    {"id": "ine.ecdfp", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Certified Digital Forensics Professional", "abbr": "eCDFP", "slug": "ecdfp", "domain": "incident-forensics", "official_url": "https://security.ine.com/certifications/ecdfp-certification/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 400, "tier_hint": "professional", "summary": "Practical digital forensics: disk, memory, network artefacts.", "family": "practical-defensive", "experience_years": 3},
    {"id": "ine.ecir", "vendor_slug": "ine-security", "vendor_name": "INE Security", "vendor_url": "https://ine.com/security", "name": "eLearnSecurity Certified Incident Responder", "abbr": "eCIR", "slug": "ecir", "domain": "incident-forensics", "official_url": "https://ine.com/security/certifications/ecir-certification", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 400, "tier_hint": "professional", "summary": "SOC/IR practical exam: triage, hunt, contain, eradicate.", "family": "practical-defensive", "experience_years": 3},

    # ---------------- Hack The Box ----------------
    {"id": "hackthebox.cjca", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Junior Cybersecurity Associate", "abbr": "HTB CJCA", "slug": "cjca", "domain": "network-defense", "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-junior-cybersecurity-associate", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/htb", "cost_usd": 105, "tier_hint": "foundational", "summary": "Entry-level practical cert spanning red and blue fundamentals.", "family": "practical-defensive"},
    {"id": "hackthebox.cbbh", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Bug Bounty Hunter", "abbr": "HTB CBBH", "slug": "cbbh", "domain": "application-appsec", "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-bug-bounty-hunter", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/htb", "cost_usd": 210, "tier_hint": "associate", "summary": "Practical bug-bounty / web-app cert; custom exploit chains, reporting.", "family": "practical-pentest", "experience_years": 1},
    {"id": "hackthebox.cpts", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Penetration Testing Specialist", "abbr": "HTB CPTS", "slug": "cpts", "domain": "offensive-redteam", "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-penetration-testing-specialist", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/ata/hack-box-certified-penetration-testing-specialist-htb-cpts", "cost_usd": 210, "tier_hint": "professional", "summary": "End-to-end pentest exam: external recon, AD pivoting, web, privesc, professional report.", "family": "practical-pentest", "experience_years": 2},
    {"id": "hackthebox.cdsa", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Defensive Security Analyst", "abbr": "HTB CDSA", "slug": "cdsa", "domain": "incident-forensics", "secondary_domains": ["network-defense"], "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-defensive-security-analyst", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/ata/hack-box-certified-defensive-security-analyst-htb-cdsa", "cost_usd": 210, "tier_hint": "professional", "summary": "SOC analyst practical: detection engineering, IR, SIEM hunting.", "family": "practical-defensive", "experience_years": 2},
    {"id": "hackthebox.cwee", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Web Exploitation Expert", "abbr": "HTB CWEE", "slug": "cwee", "domain": "application-appsec", "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-web-exploitation-expert", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/htb", "cost_usd": 350, "tier_hint": "expert", "summary": "Expert white/black-box web exploitation: source review, advanced injection.", "family": "practical-pentest", "experience_years": 4},
    {"id": "hackthebox.cape", "vendor_slug": "hackthebox", "vendor_name": "Hack The Box", "vendor_url": "https://www.hackthebox.com/", "name": "HTB Certified Active Directory Pentesting Expert", "abbr": "HTB CAPE", "slug": "cape", "domain": "offensive-redteam", "official_url": "https://academy.hackthebox.com/preview/certifications/htb-certified-active-directory-pentesting-expert", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/htb", "cost_usd": 350, "tier_hint": "expert", "summary": "Advanced AD attacks: Kerberos/NTLM abuse, ADCS, WSUS, Exchange, trust abuse.", "family": "practical-pentest", "experience_years": 4},

    # ---------------- TCM Security ----------------
    {"id": "tcm-security.pjpt", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Junior Penetration Tester", "abbr": "PJPT", "slug": "pjpt", "domain": "offensive-redteam", "official_url": "https://certifications.tcm-sec.com/pjpt/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 249, "tier_hint": "foundational", "summary": "Associate-level internal AD pentest exam; 2 days assessment + 2 days reporting.", "family": "practical-pentest"},
    {"id": "tcm-security.pnpt", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Network Penetration Tester", "abbr": "PNPT", "slug": "pnpt", "domain": "offensive-redteam", "official_url": "https://certifications.tcm-sec.com/pnpt/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 449, "tier_hint": "professional", "summary": "5-day external + internal pentest with OSINT, AD compromise, live debrief.", "family": "practical-pentest", "experience_years": 2},
    {"id": "tcm-security.pwpa", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Web Pentest Associate", "abbr": "PWPA", "slug": "pwpa", "domain": "application-appsec", "official_url": "https://certifications.tcm-sec.com/pwpa/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 249, "tier_hint": "associate", "summary": "Associate web-app pentest covering OWASP Top 10 with full reporting.", "family": "practical-pentest", "experience_years": 1},
    {"id": "tcm-security.pwpp", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Web Pentest Professional", "abbr": "PWPP", "slug": "pwpp", "domain": "application-appsec", "official_url": "https://certifications.tcm-sec.com/pwpp/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 499, "tier_hint": "professional", "summary": "3-day advanced web pentest: chained vulns, business-logic, deserialization, SSRF.", "family": "practical-pentest", "experience_years": 3},
    {"id": "tcm-security.pmpa", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Mobile Pentest Associate", "abbr": "PMPA", "slug": "pmpa", "domain": "endpoint-mobile", "official_url": "https://certifications.tcm-sec.com/pmpa/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 249, "tier_hint": "associate", "summary": "Mobile app pentest exam (iOS/Android) with full report.", "family": "practical-pentest", "experience_years": 1},
    {"id": "tcm-security.pipa", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical IoT Pentest Associate", "abbr": "PIPA", "slug": "pipa", "domain": "ot-ics-iot", "official_url": "https://certifications.tcm-sec.com/pipa/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 249, "tier_hint": "associate", "summary": "Embedded Linux IoT firmware/logic-analyzer pentest exam.", "family": "practical-pentest", "experience_years": 1},
    {"id": "tcm-security.porp", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical OSINT Research Professional", "abbr": "PORP", "slug": "porp", "domain": "threat-intel", "official_url": "https://certifications.tcm-sec.com/porp/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 299, "tier_hint": "professional", "summary": "OSINT investigation cert. Person/org investigation + report.", "family": "practical-defensive", "experience_years": 2},
    {"id": "tcm-security.pmrp", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical Malware Research Professional", "abbr": "PMRP", "slug": "pmrp", "domain": "incident-forensics", "official_url": "https://certifications.tcm-sec.com/pmrp/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 299, "tier_hint": "professional", "summary": "Malware static/dynamic analysis with reverse-engineering report.", "family": "practical-defensive", "experience_years": 3},
    {"id": "tcm-security.psaa", "vendor_slug": "tcm-security", "vendor_name": "TCM Security", "vendor_url": "https://tcm-sec.com/", "name": "Practical SOC Analyst Associate", "abbr": "PSAA", "slug": "psaa", "domain": "incident-forensics", "secondary_domains": ["network-defense"], "official_url": "https://certifications.tcm-sec.com/psaa/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog", "cost_usd": 249, "tier_hint": "associate", "summary": "Tier-1 SOC analyst practical: SIEM triage, alert investigation, IR write-up.", "family": "practical-defensive", "experience_years": 1},

    # ---------------- More GIAC ----------------
    {"id": "giac.gced", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Certified Enterprise Defender", "abbr": "GCED", "slug": "gced", "domain": "network-defense", "official_url": "https://www.giac.org/certifications/certified-enterprise-defender-gced", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/army/credential/index.html?cert=gced5522", "cost_usd": 999, "tier_hint": "professional", "summary": "Defensive network ops + packet analysis, IR, malware removal beyond GSEC.", "family": "giac", "experience_years": 3},
    {"id": "giac.gmon", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Continuous Monitoring", "abbr": "GMON", "slug": "gmon", "domain": "network-defense", "secondary_domains": ["incident-forensics"], "official_url": "https://www.giac.org/certifications/continuous-monitoring-gmon", "third_party_source": "dod-cool", "third_party_url": "https://cool.osd.mil/dciv/search/CERT_GMON6479.htm", "cost_usd": 999, "tier_hint": "professional", "summary": "Continuous Diagnostics & Mitigation; SOC architecture and detection engineering.", "family": "giac", "experience_years": 3},
    {"id": "giac.gawn", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Assessing and Auditing Wireless Networks", "abbr": "GAWN", "slug": "gawn", "domain": "network-defense", "official_url": "https://www.giac.org/certifications/assessing-auditing-wireless-networks-gawn", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/army/credential/index.html?cert=gawn4311", "cost_usd": 999, "tier_hint": "specialty", "summary": "Wireless security assessment: 802.11, Bluetooth, Zigbee, cellular.", "family": "giac"},
    {"id": "giac.gcwn", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Certified Windows Security Administrator", "abbr": "GCWN", "slug": "gcwn", "domain": "endpoint-mobile", "secondary_domains": ["iam"], "official_url": "https://www.giac.org/certifications/certified-windows-security-administrator-gcwn", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/army/credential/index.html?cert=gcwn3240", "cost_usd": 999, "tier_hint": "professional", "summary": "Windows hardening: PKI, IPSec, GPO, AppLocker, DNSSEC, PowerShell.", "family": "giac", "experience_years": 3},
    {"id": "giac.gdat", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Defending Advanced Threats", "abbr": "GDAT", "slug": "gdat", "domain": "network-defense", "secondary_domains": ["incident-forensics"], "official_url": "https://www.giac.org/certifications/defending-advanced-threats-gdat", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/army/credential/index.html?cert=gdat9092", "cost_usd": 999, "tier_hint": "expert", "summary": "Purple-team: design layered detections informed by advanced TTPs.", "family": "giac", "experience_years": 5},
    {"id": "giac.gnfa", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Network Forensic Analyst", "abbr": "GNFA", "slug": "gnfa", "domain": "incident-forensics", "secondary_domains": ["network-defense"], "official_url": "https://www.giac.org/certifications/network-forensic-analyst-gnfa", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gnfa6480", "cost_usd": 999, "tier_hint": "professional", "summary": "Network forensics: PCAP analysis, encrypted traffic, NetFlow, wireless captures.", "family": "giac", "experience_years": 3},
    {"id": "giac.gbfa", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Battlefield Forensics and Acquisition", "abbr": "GBFA", "slug": "gbfa", "domain": "incident-forensics", "official_url": "https://www.giac.org/certifications/battlefield-forensics-acquisition-gbfa", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usn/credential/index.html?cert=gbfa9405", "cost_usd": 999, "tier_hint": "specialty", "summary": "Rapid evidence acquisition from diverse devices in time-critical settings.", "family": "giac"},
    {"id": "giac.gosi", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Open Source Intelligence", "abbr": "GOSI", "slug": "gosi", "domain": "threat-intel", "official_url": "https://www.giac.org/certifications/open-source-intelligence-gosi", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gosi8225", "cost_usd": 999, "tier_hint": "professional", "summary": "OSINT methodologies: collection, verification, OPSEC, reporting.", "family": "giac", "experience_years": 2},
    {"id": "giac.gpyc", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Python Coder", "abbr": "GPYC", "slug": "gpyc", "domain": "security-architecture", "official_url": "https://www.giac.org/certifications/python-coder-gpyc", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gpyc7611", "cost_usd": 999, "tier_hint": "specialty", "summary": "Python for security automation, parsing, network/forensic tooling.", "family": "giac"},
    {"id": "giac.gsna", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Systems and Network Auditor", "abbr": "GSNA", "slug": "gsna", "domain": "governance-risk", "secondary_domains": ["network-defense"], "official_url": "https://www.giac.org/certifications/systems-network-auditor-gsna", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gsna3476", "cost_usd": 999, "tier_hint": "professional", "summary": "Technical auditing of OS, networks, web apps.", "family": "giac", "experience_years": 3},
    {"id": "giac.gisp", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Information Security Professional", "abbr": "GISP", "slug": "gisp", "domain": "governance-risk", "official_url": "https://www.giac.org/certifications/information-security-professional-gisp", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/computer-networking-center-inc/gisp-giac-information-security", "cost_usd": 999, "tier_hint": "professional", "summary": "Broad CISSP-domain coverage validated through GIAC's question style.", "family": "giac", "experience_years": 4},
    {"id": "giac.gleg", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Law of Data Security & Investigations", "abbr": "GLEG", "slug": "gleg", "domain": "privacy-data-protection", "secondary_domains": ["governance-risk"], "official_url": "https://www.giac.org/certifications/law-data-security-investigations-gleg", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gleg5538", "cost_usd": 999, "tier_hint": "specialty", "summary": "Legal/regulatory landscape for IR, e-discovery, evidence handling.", "family": "giac"},
    {"id": "giac.gstrt", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Strategic Planning, Policy, and Leadership", "abbr": "GSTRT", "slug": "gstrt", "domain": "governance-risk", "official_url": "https://www.giac.org/certifications/strategic-planning-policy-leadership-gstrt", "third_party_source": "dod-cool", "third_party_url": "https://www.cool.osd.mil/usmc/credential/index.html?cert=gstrt8233", "cost_usd": 999, "tier_hint": "expert", "summary": "MBA-level strategic planning, policy authorship, exec-level cyber leadership.", "family": "giac", "experience_years": 7},
    {"id": "giac.gse", "vendor_slug": "giac", "vendor_name": "GIAC", "vendor_url": "https://www.giac.org/", "name": "GIAC Security Expert", "abbr": "GSE", "slug": "gse", "domain": "security-architecture", "secondary_domains": ["incident-forensics", "offensive-redteam"], "official_url": "https://www.giac.org/certifications/security-expert-gse", "third_party_source": "onetonline", "third_party_url": "https://www.onetonline.org/link/certinfo/13768-B", "cost_usd": 2899, "tier_hint": "expert", "summary": "Apex GIAC portfolio: 6 practitioner + 4 applied-knowledge certs + multi-day hands-on lab.", "family": "giac", "experience_years": 7},

    # ---------------- ISACA / CSA cloud audit ----------------
    {"id": "isaca.ccak", "vendor_slug": "isaca", "vendor_name": "ISACA / Cloud Security Alliance", "vendor_url": "https://www.isaca.org/", "name": "Certificate of Cloud Auditing Knowledge", "abbr": "CCAK", "slug": "ccak", "domain": "cloud-security", "secondary_domains": ["governance-risk"], "official_url": "https://www.isaca.org/credentialing/certificate-of-cloud-auditing-knowledge", "third_party_source": "csa", "third_party_url": "https://cloudsecurityalliance.org/education/ccak", "cost_usd": 495, "tier_hint": "specialty", "summary": "First industry credential for auditing cloud computing systems; joint ISACA/CSA.", "family": "intl-vendor-neutral", "experience_years": 2},

    # ---------------- MAD20 / MITRE ATT&CK ----------------
    {"id": "mad20.mad-cti", "vendor_slug": "mad20", "vendor_name": "MAD20 Technologies (MITRE Engenuity spinout)", "vendor_url": "https://mad20.com/", "name": "MITRE ATT&CK Defender - Cyber Threat Intelligence", "abbr": "MAD CTI", "slug": "mad-cti", "domain": "threat-intel", "official_url": "https://mad20.com/individuals", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/cybrary/mitre-attck-defender-mad-attckr-cyber-threat-intelligence", "cost_usd": 499, "tier_hint": "professional", "summary": "Performance-based cert applying ATT&CK to CTI workflows.", "family": "intl-vendor-neutral", "experience_years": 2},
    {"id": "mad20.mad-soc", "vendor_slug": "mad20", "vendor_name": "MAD20 Technologies (MITRE Engenuity spinout)", "vendor_url": "https://mad20.com/", "name": "MITRE ATT&CK Defender - SOC Assessments", "abbr": "MAD SOC", "slug": "mad-soc", "domain": "network-defense", "secondary_domains": ["incident-forensics"], "official_url": "https://mad20.com/individuals", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/cybrary/mitre-attck-defender-mad-attckr-soc-assessments-certification", "cost_usd": 499, "tier_hint": "professional", "summary": "ATT&CK-based SOC capability assessment; detection coverage gap analysis.", "family": "intl-vendor-neutral", "experience_years": 2},

    # ---------------- IPA SG (Japan additional) ----------------
    {"id": "ipa.sg", "vendor_slug": "ipa", "vendor_name": "IPA (Information-technology Promotion Agency, Japan)", "vendor_url": "https://www.ipa.go.jp/", "name": "Information Security Management Examination", "name_ja": "情報セキュリティマネジメント試験 (SG)", "abbr": "IPA SG", "slug": "sg", "domain": "governance-risk", "official_url": "https://www.ipa.go.jp/shiken/kubun/sg.html", "japan_only": True, "third_party_source": "meti-jp", "third_party_url": "https://www.meti.go.jp/policy/it_policy/jinzai/", "cost_usd": 50, "tier_hint": "associate", "summary": "METI-authorised national exam for information security managers; year-round CBT via IPA.", "family": "jp-national"},

    # ---------------- JIPDEC (Japan) ----------------
    {"id": "jipdec.pmark-auditor", "vendor_slug": "jipdec", "vendor_name": "JIPDEC (Japan Institute for Promotion of Digital Economy and Community)", "vendor_url": "https://www.jipdec.or.jp/eng/", "name": "Privacy Mark Assistant Auditor", "name_ja": "プライバシーマーク審査員補", "abbr": "PMARK-AA", "slug": "pmark-auditor", "domain": "privacy-data-protection", "official_url": "https://privacymark.jp/system/institution/judge/about.html", "japan_only": True, "third_party_source": "ppc-jp", "third_party_url": "https://www.ppc.go.jp/en/", "cost_usd": 1500, "tier_hint": "professional", "summary": "JIPDEC-registered auditor for Japan's Privacy Mark (JIS Q 15001) scheme.", "family": "jp-national", "experience_years": 3},
    {"id": "jipdec.isms-internal-auditor", "vendor_slug": "jipdec", "vendor_name": "JIPDEC (Japan Institute for Promotion of Digital Economy and Community)", "vendor_url": "https://www.jipdec.or.jp/eng/", "name": "ISMS Internal Auditor (JIS Q 27001)", "name_ja": "ISMS内部監査員", "abbr": "ISMS-IA-JP", "slug": "isms-internal-auditor", "domain": "governance-risk", "secondary_domains": ["privacy-data-protection"], "official_url": "https://isms.jp/", "japan_only": True, "third_party_source": "isms-ac", "third_party_url": "https://isms.jp/aboutus.html", "cost_usd": 600, "tier_hint": "associate", "summary": "JIS Q 27001:2023 internal auditor under ISMS-AC (JAB-accredited) scheme.", "family": "jp-national", "experience_years": 2},

    # ---------------- KISA (Korea) ----------------
    {"id": "kisa.isms-p-auditor", "vendor_slug": "kisa", "vendor_name": "Korea Internet & Security Agency", "vendor_url": "https://www.kisa.or.kr/EN", "name": "ISMS-P Certification Auditor", "abbr": "ISMS-P", "slug": "isms-p-auditor", "domain": "governance-risk", "secondary_domains": ["privacy-data-protection"], "official_url": "https://isms.kisa.or.kr/main/intro/", "third_party_source": "pipc.go.kr", "third_party_url": "https://www.pipc.go.kr/eng/user/lgp/bnp/certification.do", "cost_usd": 400, "tier_hint": "professional", "summary": "KISA-administered auditor for Korea's combined ISMS-P scheme.", "family": "intl-vendor-neutral", "experience_years": 3},

    # ---------------- CREST ----------------
    {"id": "crest.cpsa", "vendor_slug": "crest", "vendor_name": "CREST International", "vendor_url": "https://www.crest-approved.org/", "name": "CREST Practitioner Security Analyst", "abbr": "CPSA", "slug": "cpsa", "domain": "offensive-redteam", "official_url": "https://www.crest-approved.org/skills-certifications-careers/crest-practitioner-security-analyst/", "third_party_source": "ncsc-uk", "third_party_url": "https://www.ncsc.gov.uk/information/check-penetration-testing", "cost_usd": 400, "tier_hint": "associate", "summary": "Entry/practitioner-level pentest exam at Pearson VUE; recognised by UK NCSC CHECK.", "family": "crest", "experience_years": 1},
    {"id": "crest.crt", "vendor_slug": "crest", "vendor_name": "CREST International", "vendor_url": "https://www.crest-approved.org/", "name": "CREST Registered Penetration Tester", "abbr": "CRT", "slug": "crt", "domain": "offensive-redteam", "official_url": "https://www.crest-approved.org/skills-certifications-careers/crest-registered-penetration-tester/", "third_party_source": "ncsc-uk", "third_party_url": "https://www.ncsc.gov.uk/information/check-penetration-testing", "cost_usd": 700, "tier_hint": "professional", "summary": "Intermediate hands-on infra & web pentest exam, NCSC CHECK Team Member equivalent.", "family": "crest", "experience_years": 3},
    {"id": "crest.cct-inf", "vendor_slug": "crest", "vendor_name": "CREST International", "vendor_url": "https://www.crest-approved.org/", "name": "CREST Certified Tester - Infrastructure", "abbr": "CCT INF", "slug": "cct-inf", "domain": "offensive-redteam", "secondary_domains": ["network-defense"], "official_url": "https://www.crest-approved.org/skills-certifications-careers/crest-certified-infrastructure-tester/", "third_party_source": "ncsc-uk", "third_party_url": "https://www.ncsc.gov.uk/information/check-penetration-testing", "cost_usd": 2000, "tier_hint": "expert", "summary": "NCSC CHECK Team Leader (Infrastructure)-equivalent expert pentest exam.", "family": "crest", "experience_years": 5},
    {"id": "crest.cct-app", "vendor_slug": "crest", "vendor_name": "CREST International", "vendor_url": "https://www.crest-approved.org/", "name": "CREST Certified Web Application Tester", "abbr": "CCT APP", "slug": "cct-app", "domain": "application-appsec", "secondary_domains": ["offensive-redteam"], "official_url": "https://www.crest-approved.org/skills-certifications-careers/crest-certified-web-application-tester/", "third_party_source": "ncsc-uk", "third_party_url": "https://www.ncsc.gov.uk/information/check-penetration-testing", "cost_usd": 2000, "tier_hint": "expert", "summary": "NCSC CHECK Team Leader (Web Apps)-equivalent expert exam.", "family": "crest", "experience_years": 5},
    {"id": "crest.ccsas", "vendor_slug": "crest", "vendor_name": "CREST International", "vendor_url": "https://www.crest-approved.org/", "name": "CREST Certified Simulated Attack Specialist", "abbr": "CCSAS", "slug": "ccsas", "domain": "offensive-redteam", "official_url": "https://www.crest-approved.org/skills-certifications-careers/crest-certified-simulated-attack-specialist/", "third_party_source": "bankofengland-uk", "third_party_url": "https://www.bankofengland.co.uk/financial-stability/operational-resilience-of-the-financial-sector/cbest-intelligence-led-testing", "cost_usd": 2500, "tier_hint": "expert", "summary": "Specialist red-team operator exam aligned to Bank of England CBEST and STAR programmes.", "family": "crest", "experience_years": 6},

    # ---------------- TeleTrusT (Germany) ----------------
    {"id": "teletrust.tisp", "vendor_slug": "teletrust", "vendor_name": "TeleTrusT - Bundesverband IT-Sicherheit e.V.", "vendor_url": "https://www.teletrust.de/en/", "name": "TeleTrusT Information Security Professional", "abbr": "T.I.S.P.", "slug": "tisp", "domain": "governance-risk", "secondary_domains": ["security-architecture"], "official_url": "https://www.teletrust.de/tisp/", "third_party_source": "bsi-bund-de", "third_party_url": "https://www.bsi.bund.de/EN/Home/home_node.html", "cost_usd": 3800, "tier_hint": "expert", "summary": "German/EU-focused expert info-sec cert covering BSI IT-Grundschutz, NIS-2, GDPR; proctored by DEKRA/TÜV Rheinland.", "family": "intl-vendor-neutral", "experience_years": 5},

    # ---------------- AiSP (Singapore) ----------------
    {"id": "aisp.qisp", "vendor_slug": "aisp", "vendor_name": "Association of Information Security Professionals (Singapore)", "vendor_url": "https://www.aisp.sg/", "name": "Qualified Information Security Professional", "abbr": "QISP", "slug": "qisp", "domain": "governance-risk", "official_url": "https://www.aisp.sg/qisp.html", "third_party_source": "csa.gov.sg", "third_party_url": "https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/", "cost_usd": 600, "tier_hint": "associate", "summary": "Singapore IS-BOK-based professional cert; proctored at Pearson VUE; CSA SG Cyber Safe-aligned.", "family": "intl-vendor-neutral", "experience_years": 2},

    # ---------------- PECB (ISO auditor / implementer) ----------------
    {"id": "pecb.iso27001-la", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO/IEC 27001 Lead Auditor (PECB)", "abbr": "PECB-27001LA", "slug": "iso27001-la", "domain": "governance-risk", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001/iso-iec-27001-lead-auditor", "third_party_source": "ias", "third_party_url": "https://www.iasonline.org/", "cost_usd": 1200, "tier_hint": "professional", "summary": "PECB-issued ISMS Lead Auditor, accredited under IAS PCB-111 to ISO/IEC 17024.", "family": "iso-auditor", "experience_years": 3},
    {"id": "pecb.iso27001-li", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO/IEC 27001 Lead Implementer (PECB)", "abbr": "PECB-27001LI", "slug": "iso27001-li", "domain": "governance-risk", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001/iso-iec-27001-lead-implementer", "third_party_source": "ukas", "third_party_url": "https://www.ukas.com/", "cost_usd": 1200, "tier_hint": "professional", "summary": "PECB credential for implementing ISMS per ISO/IEC 27001:2022.", "family": "iso-auditor", "experience_years": 3},
    {"id": "pecb.iso27701-la", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO/IEC 27701 Lead Auditor (PECB)", "abbr": "PECB-27701LA", "slug": "iso27701-la", "domain": "privacy-data-protection", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27701/iso-iec-27701-lead-auditor", "third_party_source": "ias", "third_party_url": "https://www.iasonline.org/wp-content/uploads/2017/01/PCB-111-PECB-Scope.pdf", "cost_usd": 1200, "tier_hint": "professional", "summary": "PIMS Lead Auditor; aligned to ISO/IEC 27701 + 27706.", "family": "iso-auditor", "experience_years": 3},
    {"id": "pecb.iso27701-li", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO/IEC 27701 Lead Implementer (PECB)", "abbr": "PECB-27701LI", "slug": "iso27701-li", "domain": "privacy-data-protection", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27701/iso-iec-27701-lead-implementer", "third_party_source": "ias", "third_party_url": "https://www.iasonline.org/", "cost_usd": 1200, "tier_hint": "professional", "summary": "PIMS Lead Implementer for organisations operationalising ISO/IEC 27701.", "family": "iso-auditor", "experience_years": 3},
    {"id": "pecb.iso22301-la", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO 22301 Lead Auditor (PECB)", "abbr": "PECB-22301LA", "slug": "iso22301-la", "domain": "governance-risk", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-22301/iso-22301-lead-auditor", "third_party_source": "ias", "third_party_url": "https://www.iasonline.org/", "cost_usd": 1200, "tier_hint": "professional", "summary": "BCMS Lead Auditor; ISO 22301:2019, IAS-accredited.", "family": "iso-auditor", "experience_years": 3},
    {"id": "pecb.iso22301-li", "vendor_slug": "pecb", "vendor_name": "PECB (Professional Evaluation and Certification Board)", "vendor_url": "https://pecb.com/", "name": "ISO 22301 Lead Implementer (PECB)", "abbr": "PECB-22301LI", "slug": "iso22301-li", "domain": "governance-risk", "official_url": "https://pecb.com/en/education-and-certification-for-individuals/iso-22301/iso-22301-lead-implementer", "third_party_source": "ukas", "third_party_url": "https://www.ukas.com/", "cost_usd": 1200, "tier_hint": "professional", "summary": "BCMS Lead Implementer; ISO/IEC 17024 accredited via UKAS / IAS.", "family": "iso-auditor", "experience_years": 3},

    # ---------------- BSI Group (UK / global) ----------------
    {"id": "bsi-group.iso27001-la", "vendor_slug": "bsi-group", "vendor_name": "BSI Group", "vendor_url": "https://www.bsigroup.com/", "name": "CQI/IRCA Certified ISO/IEC 27001:2022 Lead Auditor (BSI)", "abbr": "BSI-27001LA", "slug": "iso27001-la", "domain": "governance-risk", "official_url": "https://www.bsigroup.com/en-GB/products-and-services/training-courses/iso-iec-270012022-lead-auditor-training-course/", "third_party_source": "cqi-irca", "third_party_url": "https://www.quality.org/", "cost_usd": 2800, "tier_hint": "professional", "summary": "BSI-delivered, CQI/IRCA-certified 5-day ISMS Lead Auditor course (PR373).", "family": "iso-auditor", "experience_years": 3},
    {"id": "bsi-group.iso22301-la", "vendor_slug": "bsi-group", "vendor_name": "BSI Group", "vendor_url": "https://www.bsigroup.com/", "name": "CQI/IRCA Certified ISO 22301 Lead Auditor (BSI)", "abbr": "BSI-22301LA", "slug": "iso22301-la", "domain": "governance-risk", "official_url": "https://www.bsigroup.com/en-GB/products-and-services/training-courses/iso-22301-lead-auditor-training-course/", "third_party_source": "cqi-irca", "third_party_url": "https://www.quality.org/", "cost_usd": 2800, "tier_hint": "professional", "summary": "BSI 5-day BCMS Lead Auditor course, CQI/IRCA certified.", "family": "iso-auditor", "experience_years": 3},

    # ---------------- IRCA / Exemplar Global ----------------
    {"id": "cqi-irca.iso27001-la", "vendor_slug": "cqi-irca", "vendor_name": "CQI / IRCA (Chartered Quality Institute)", "vendor_url": "https://www.quality.org/", "name": "IRCA Certified ISMS Auditor (ISO/IEC 27001:2022)", "abbr": "IRCA-27001", "slug": "iso27001-la", "domain": "governance-risk", "official_url": "https://www.quality.org/", "third_party_source": "iaf", "third_party_url": "https://iaf.nu/", "cost_usd": 2500, "tier_hint": "professional", "summary": "IRCA-managed register/credential for ISMS auditors; the global benchmark register.", "family": "iso-auditor", "experience_years": 3},
    {"id": "exemplar-global.iso27001-la", "vendor_slug": "exemplar-global", "vendor_name": "Exemplar Global", "vendor_url": "https://exemplarglobal.org/", "name": "Certified ISMS Lead Auditor (Exemplar Global)", "abbr": "EG-ISMS-LA", "slug": "iso27001-la", "domain": "governance-risk", "official_url": "https://exemplarglobal.org/certification/information-security-management-system-auditor-iso-27001/", "third_party_source": "ansi", "third_party_url": "https://www.ansi.org/", "cost_usd": 1800, "tier_hint": "professional", "summary": "Exemplar Global TPECS-based ISO 27001:2022 Lead Auditor; ANSI-accredited under ISO/IEC 17024.", "family": "iso-auditor", "experience_years": 3},

    # ---------------- LPI ----------------
    {"id": "lpi.lpic3-303", "vendor_slug": "lpi", "vendor_name": "Linux Professional Institute", "vendor_url": "https://www.lpi.org/", "name": "LPIC-3 Security", "abbr": "LPIC-3 303", "slug": "lpic3-303", "domain": "endpoint-mobile", "secondary_domains": ["security-architecture"], "official_url": "https://www.lpi.org/our-certifications/lpic-3-303-overview/", "third_party_source": "ansi", "third_party_url": "https://www.ansi.org/", "cost_usd": 200, "tier_hint": "expert", "summary": "LPI's expert Linux security certification (303-300); requires active LPIC-2.", "family": "linux-foundation", "experience_years": 5},
    {"id": "lpi.security-essentials", "vendor_slug": "lpi", "vendor_name": "Linux Professional Institute", "vendor_url": "https://www.lpi.org/", "name": "LPI Security Essentials", "abbr": "LPI SEC-110", "slug": "security-essentials", "domain": "governance-risk", "official_url": "https://www.lpi.org/our-certifications/security-essentials-overview/", "third_party_source": "dod-8140", "third_party_url": "https://public.cyber.mil/wid/cwmp/dod-approved-8140-baseline-certifications/", "cost_usd": 120, "tier_hint": "foundational", "summary": "LPI's vendor-neutral foundational security exam.", "family": "linux-foundation"},
]


def main() -> int:
    written = 0
    skipped = []
    for spec in SPECS:
        rel_path, cert = make_cert(spec)
        if rel_path.exists():
            skipped.append(str(rel_path.relative_to(ROOT)))
            continue
        rel_path.parent.mkdir(parents=True, exist_ok=True)
        rel_path.write_text(json.dumps(cert, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written += 1
    print(f"wrote {written} cert files")
    if skipped:
        print(f"skipped {len(skipped)} existing files:")
        for p in skipped:
            print(f"  - {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
