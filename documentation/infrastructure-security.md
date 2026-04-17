# Infrastructure Security Confirmation

> **Document status:** Active  
> **Last reviewed:** 2026-04-14  
> **Audience:** Engineering, Security, Compliance

This document explicitly confirms the platform-level security controls that are
delegated to SoloCompass's infrastructure providers (Vercel, Render, and Supabase).
It exists to satisfy the SC-SHARED-08 audit requirement for written confirmation of
TLS 1.3 and AES-256 at-rest encryption.

---

## 1. TLS 1.3 (Transport Layer Security)

### Frontend — Vercel

Vercel enforces **TLS 1.2 as the minimum** and supports **TLS 1.3** on all
deployments.  Vercel's edge network automatically negotiates TLS 1.3 when the
client supports it; clients that support only TLS 1.2 are still served (this is
acceptable per OWASP TLS recommendations).

**References:**
- Vercel documentation: [Vercel Security — TLS](https://vercel.com/docs/security/vercel-edge)
- TLS 1.0 and 1.1 are **disabled** on all Vercel edge nodes.

**Action required:**  
None.  Verify by running: `nmap --script ssl-enum-ciphers -p 443 <production-domain>` 
and confirming TLSv1.3 is listed.

### Backend — Render

Render automatically provisions a TLS certificate (via Let's Encrypt) for all
web services.  Render's load balancer terminates TLS and supports **TLS 1.2 minimum**
with **TLS 1.3** preferred.

**References:**
- Render documentation: [Render Custom Domains and TLS](https://docs.render.com/custom-domains)

**Action required:**  
None.  Optionally confirm with: `openssl s_client -tls1_3 -connect <api-domain>:443`

---

## 2. AES-256 Encryption at Rest — Supabase (PostgreSQL)

Supabase stores all project databases on AWS infrastructure.  Data volumes
(EBS/S3) are encrypted using **AES-256** (AWS server-side encryption).

### Confirmation

| Layer | Encryption | Standard |
|---|---|---|
| Database volume (EBS) | AES-256 | AWS default encryption |
| Backups (S3) | AES-256 | AWS SSE-S3 / SSE-KMS |
| File Storage (Supabase Storage) | AES-256 | AWS S3 SSE |

**References:**
- Supabase documentation: [Supabase Security](https://supabase.com/docs/guides/platform/security)
- AWS EBS Encryption: [AWS EBS Encryption](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSEncryption.html)

**Action required:**  
None — this is a platform default.  If the project ever migrates to a self-hosted
Supabase deployment, the team **must** explicitly enable EBS encryption on the EC2/EBS
resources used.

---

## 3. Additional Platform Security Controls (FYI)

| Control | Provider | Status |
|---|---|---|
| DDoS protection (L3/L4/L7) | Vercel Edge Network | ✅ Included |
| Web Application Firewall (WAF) | Vercel (pro plan) / Render | ✅ Available |
| Automatic secret rotation | Infisical (configured) | ✅ Configured |
| Vulnerability scanning | GitHub Dependabot + CodeQL | ✅ Enabled |
| npm audit in CI | backend.yml + frontend.yml | ✅ Enabled |

---

## 4. Action Items for IaC

If the team ever provisions infrastructure via Terraform or Pulumi, the following
should be codified:

```hcl
# Example Terraform (AWS RDS / self-hosted fallback)
resource "aws_db_instance" "solocompass" {
  storage_encrypted = true          # AES-256 via KMS
  # ...
}
```

```yaml
# render.yaml — TLS enforced automatically; no explicit config needed
services:
  - type: web
    # Render provisions TLS automatically for all web services
```

---

*Reviewed by:* Engineering Lead  
*Next review:* 2026-10-14 (6-month cadence)
