# Email Deliverability Setup

Ideate uses SMTP magic links for authentication. To ensure emails reach inboxes (not spam), configure SPF and DKIM records for your sending domain.

## Quick Check

Run the built-in deliverability checker:

```
curl http://localhost:3000/api/email/deliverability
```

This returns SPF, DKIM, and MX status with specific recommendations.

## SPF (Sender Policy Framework)

SPF tells receiving servers which mail servers are authorized to send email for your domain.

### Setup for smtp2go

Add a TXT record to your DNS:

| Type | Host | Value |
|------|------|-------|
| TXT  | @    | `v=spf1 include:_spf.smtp2go.com ~all` |

### Verification

```bash
dig TXT surcod.ro +short
# Should show: "v=spf1 include:_spf.smtp2go.com ~all"
```

## DKIM (DomainKeys Identified Mail)

DKIM adds a cryptographic signature to outgoing emails, proving they weren't tampered with.

### Setup for smtp2go

1. Log into your smtp2go dashboard
2. Go to Settings > Sender Domains
3. Add your domain (e.g., `surcod.ro`)
4. smtp2go provides DKIM DNS records to add
5. Add the CNAME or TXT records to your DNS

Typical records:

| Type  | Host                          | Value                        |
|-------|-------------------------------|------------------------------|
| CNAME | `s1._domainkey.surcod.ro`     | (provided by smtp2go)        |
| CNAME | `s2._domainkey.surcod.ro`     | (provided by smtp2go)        |

### Verification

```bash
dig TXT default._domainkey.surcod.ro +short
# Should return a DKIM public key record
```

## DMARC (Optional but recommended)

DMARC builds on SPF and DKIM to specify how to handle failed authentication.

| Type | Host     | Value |
|------|----------|-------|
| TXT  | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@surcod.ro` |

## MX Records

Ensure your domain has MX records if you also need to receive email:

```bash
dig MX surcod.ro +short
```

## Troubleshooting

### Emails going to spam
1. Run `/api/email/deliverability` and fix any failures
2. Ensure SPF record exists and is valid (only one SPF record allowed)
3. Ensure DKIM is properly configured
4. Check your sender reputation at [mail-tester.com](https://www.mail-tester.com/)

### SMTP connection fails
1. Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `.env`
2. Test with: `curl http://localhost:3000/api/health` (checks SMTP config)
3. Ensure port 587 (TLS) or 465 (SSL) is not blocked by firewall

## Environment Variables

| Variable    | Description            | Example              |
|-------------|------------------------|----------------------|
| `SMTP_HOST` | SMTP server hostname   | `mail.smtp2go.com`   |
| `SMTP_PORT` | SMTP port              | `587`                |
| `SMTP_USER` | SMTP username          | `your-username`      |
| `SMTP_PASS` | SMTP password          | `your-password`      |
| `SMTP_FROM` | From email address     | `idea@surcod.ro`     |
