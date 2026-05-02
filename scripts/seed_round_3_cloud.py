#!/usr/bin/env python3
"""
Round-3 seed: cloud-vendor cert gaps (AWS, Azure, GCP, Oracle, IBM) gathered
by the cloud-cert audit agent. Reuses the make_cert helper from seed_round_2.

Run: python3 scripts/seed_round_3_cloud.py
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from seed_round_2 import make_cert  # noqa
import json

SPECS = [
    # ---------- AWS ----------
    {"id": "aws.clf-c02", "vendor_slug": "aws", "vendor_name": "Amazon Web Services", "vendor_url": "https://aws.amazon.com/", "name": "AWS Certified Cloud Practitioner", "abbr": "CLF-C02", "slug": "clf-c02", "domain": "cloud-security", "secondary_domains": ["governance-risk"], "official_url": "https://aws.amazon.com/certification/certified-cloud-practitioner/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/tpai/aws-certified-cloud-practitioner-training", "cost_usd": 100, "tier_hint": "foundational", "summary": "Foundational AWS cloud literacy with security, compliance, and shared-responsibility basics.", "family": "vendor-cloud", "experience_years": 0},
    {"id": "aws.sap-c02", "vendor_slug": "aws", "vendor_name": "Amazon Web Services", "vendor_url": "https://aws.amazon.com/", "name": "AWS Certified Solutions Architect - Professional", "abbr": "SAP-C02", "slug": "sap-c02", "domain": "security-architecture", "secondary_domains": ["cloud-security", "governance-risk"], "official_url": "https://aws.amazon.com/certification/certified-solutions-architect-professional/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/tpai/aws-certified-solutions-architect-professional-training", "cost_usd": 300, "tier_hint": "professional", "summary": "Professional-tier AWS architecture covering secure multi-account, encryption, and resilient design.", "family": "vendor-cloud", "experience_years": 2},
    {"id": "aws.dop-c02", "vendor_slug": "aws", "vendor_name": "Amazon Web Services", "vendor_url": "https://aws.amazon.com/", "name": "AWS Certified DevOps Engineer - Professional", "abbr": "DOP-C02", "slug": "dop-c02", "domain": "cloud-security", "secondary_domains": ["application-appsec", "incident-forensics"], "official_url": "https://aws.amazon.com/certification/certified-devops-engineer-professional/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/tpai/aws-certified-devops-engineer-professional-training", "cost_usd": 300, "tier_hint": "professional", "summary": "Professional DevOps on AWS with policy automation, secret management, and incident response pipelines.", "family": "vendor-cloud", "experience_years": 2},
    {"id": "aws.ans-c01", "vendor_slug": "aws", "vendor_name": "Amazon Web Services", "vendor_url": "https://aws.amazon.com/", "name": "AWS Certified Advanced Networking - Specialty", "abbr": "ANS-C01", "slug": "ans-c01", "domain": "network-defense", "secondary_domains": ["cloud-security"], "official_url": "https://aws.amazon.com/certification/certified-advanced-networking-specialty/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/institute-information-technology/aws-certified-advanced-networking", "cost_usd": 300, "tier_hint": "professional", "summary": "Specialty-tier AWS networking with WAF, IDS/IPS, DDoS protection, and hybrid VPN/MPLS security.", "family": "vendor-cloud", "experience_years": 3},

    # ---------- Microsoft Azure ----------
    {"id": "microsoft.sc-900", "vendor_slug": "microsoft", "vendor_name": "Microsoft", "vendor_url": "https://learn.microsoft.com/credentials/", "name": "Microsoft Security, Compliance, and Identity Fundamentals (SC-900)", "abbr": "SC-900", "slug": "sc-900", "domain": "governance-risk", "secondary_domains": ["iam", "cloud-security"], "official_url": "https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/techsherpas-365/sc-900-microsoft-security-compliance-identity", "cost_usd": 99, "tier_hint": "foundational", "summary": "Entry-level Microsoft security/compliance/identity literacy across Azure, Entra, Purview, Defender.", "family": "vendor-cloud", "experience_years": 0},
    {"id": "microsoft.az-104", "vendor_slug": "microsoft", "vendor_name": "Microsoft", "vendor_url": "https://learn.microsoft.com/credentials/", "name": "Microsoft Azure Administrator Associate (AZ-104)", "abbr": "AZ-104", "slug": "az-104", "domain": "cloud-security", "secondary_domains": ["iam", "network-defense"], "official_url": "https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/training/catalog/training-camp/microsoft-azure-administrator-certification-az-104", "cost_usd": 165, "tier_hint": "associate", "summary": "Azure operations covering RBAC, Entra ID, NSGs, policy, and key vault administration.", "family": "vendor-cloud", "experience_years": 1},
    {"id": "microsoft.az-305", "vendor_slug": "microsoft", "vendor_name": "Microsoft", "vendor_url": "https://learn.microsoft.com/credentials/", "name": "Microsoft Azure Solutions Architect Expert (AZ-305)", "abbr": "AZ-305", "slug": "az-305", "domain": "security-architecture", "secondary_domains": ["cloud-security", "iam"], "official_url": "https://learn.microsoft.com/en-us/credentials/certifications/azure-solutions-architect/", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/training-camp/microsoft-azure-solutions-architect-expert-certification", "cost_usd": 165, "tier_hint": "expert", "summary": "Expert Azure infrastructure design with identity, governance, and zero-trust architecture.", "family": "vendor-cloud", "experience_years": 3},

    # ---------- Google Cloud ----------
    {"id": "google.cdl", "vendor_slug": "google", "vendor_name": "Google Cloud", "vendor_url": "https://cloud.google.com/certification", "name": "Google Cloud Digital Leader", "abbr": "CDL", "slug": "cdl", "domain": "governance-risk", "secondary_domains": ["cloud-security"], "official_url": "https://cloud.google.com/learn/certification/cloud-digital-leader", "third_party_source": "pearsonvue-google", "third_party_url": "https://googlecloudexamstore.pearsonvue.com/", "cost_usd": 99, "tier_hint": "foundational", "summary": "Foundational Google Cloud literacy with shared-responsibility, IAM, and compliance basics.", "family": "vendor-cloud", "experience_years": 0},
    {"id": "google.pca", "vendor_slug": "google", "vendor_name": "Google Cloud", "vendor_url": "https://cloud.google.com/certification", "name": "Google Professional Cloud Architect", "abbr": "PCA", "slug": "pca", "domain": "security-architecture", "secondary_domains": ["cloud-security", "governance-risk"], "official_url": "https://cloud.google.com/learn/certification/cloud-architect", "third_party_source": "niccs", "third_party_url": "https://niccs.cisa.gov/education-training/catalog/phoenix-ts/google-cloud-fundamentals-core-infrastructure", "cost_usd": 200, "tier_hint": "professional", "summary": "Professional GCP architecture with secure design, IAM, VPC service controls, and compliance.", "family": "vendor-cloud", "experience_years": 3},
    {"id": "google.pcne", "vendor_slug": "google", "vendor_name": "Google Cloud", "vendor_url": "https://cloud.google.com/certification", "name": "Google Professional Cloud Network Engineer", "abbr": "PCNE", "slug": "pcne", "domain": "network-defense", "secondary_domains": ["cloud-security"], "official_url": "https://cloud.google.com/learn/certification/cloud-network-engineer", "third_party_source": "pearsonvue-google", "third_party_url": "https://googlecloudexamstore.pearsonvue.com/", "cost_usd": 200, "tier_hint": "professional", "summary": "Professional GCP networking with VPCs, hybrid connectivity, Cloud Armor, and segmentation.", "family": "vendor-cloud", "experience_years": 3},

    # ---------- Oracle Cloud ----------
    {"id": "oracle.oci-security-pro", "vendor_slug": "oracle", "vendor_name": "Oracle", "vendor_url": "https://www.oracle.com/", "name": "Oracle Cloud Infrastructure Security Professional", "abbr": "OCI-SP", "slug": "oci-security-pro", "domain": "cloud-security", "secondary_domains": ["iam", "security-architecture"], "official_url": "https://education.oracle.com/oracle-cloud-infrastructure-2025-security-professional/pexam_1Z0-1104-25", "third_party_source": "pearsonvue-oracle", "third_party_url": "https://www.pearsonvue.com/us/en/oracle.html", "cost_usd": 245, "tier_hint": "professional", "summary": "OCI security controls: IAM, network security, data protection, threat detection, compliance.", "family": "vendor-cloud", "experience_years": 2},
    {"id": "oracle.oci-architect-pro", "vendor_slug": "oracle", "vendor_name": "Oracle", "vendor_url": "https://www.oracle.com/", "name": "Oracle Cloud Infrastructure Architect Professional", "abbr": "OCI-AP", "slug": "oci-architect-pro", "domain": "security-architecture", "secondary_domains": ["cloud-security"], "official_url": "https://education.oracle.com/oracle-cloud-infrastructure-2024-architect-professional/pexam_1Z0-997-24", "third_party_source": "pearsonvue-oracle", "third_party_url": "https://www.pearsonvue.com/us/en/oracle.html", "cost_usd": 245, "tier_hint": "professional", "summary": "OCI architecture with secure design, hybrid networking, identity domains, and resilience.", "family": "vendor-cloud", "experience_years": 3},

    # ---------- IBM Cloud ----------
    {"id": "ibm.cloud-security-engineer", "vendor_slug": "ibm", "vendor_name": "IBM", "vendor_url": "https://www.ibm.com/", "name": "IBM Cloud Security Engineer Specialty", "abbr": "IBM-CSE", "slug": "cloud-security-engineer", "domain": "cloud-security", "secondary_domains": ["iam", "incident-forensics"], "official_url": "https://www.ibm.com/training/certification/ibm-cloud-security-engineer-v1-specialty-S0011100", "third_party_source": "pearsonvue-ibm", "third_party_url": "https://www.pearsonvue.com/us/en/ibm.html", "cost_usd": 200, "tier_hint": "professional", "summary": "IBM Cloud security: hybrid connectivity, Kubernetes/VMware hardening, IAM, and compliance config.", "family": "vendor-cloud", "experience_years": 2},
]


def main() -> int:
    written = []
    skipped = []
    for spec in SPECS:
        rel_path, cert = make_cert(spec)
        if rel_path.exists():
            skipped.append(str(rel_path.relative_to(ROOT)))
            continue
        rel_path.parent.mkdir(parents=True, exist_ok=True)
        rel_path.write_text(json.dumps(cert, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(str(rel_path.relative_to(ROOT)))
    print(f"wrote {len(written)} cloud cert files")
    if skipped:
        print(f"skipped {len(skipped)} existing:")
        for p in skipped:
            print(f"  - {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
