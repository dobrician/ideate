# Deployment

## Infrastructure
- **Host:** localhost (local network)
- **Reverse Proxy:** Nginx Proxy Manager
- **Domain:** ideate.surcod.ro (HTTPS via Let's Encrypt)
- **Route:** ideate.surcod.ro → http://localhost:4100

## Docker Containers

### Staging (Production-like)
- Port: 4100
- Always running (`restart: unless-stopped`)
- Updated only after sprint tests pass
- This is what ideate.surcod.ro serves

### Dev (Sprint Work)
- Port: 4101
- Active during sprints
- May be broken at any time
- Not externally accessible

## Environment Variables
See `.env.example` for full list. Critical ones:
- `JWT_SECRET` — generate with `openssl rand -base64 32`
- `SMTP_*` — configured SMTP provider credentials
- `APP_URL` — `https://ideate.surcod.ro`
- `DATABASE_URL` — SQLite path inside container

## Deploy Process
```bash
# After sprint completion and all tests pass:
cd /home/dc/work/ideate
git checkout main
docker compose down
docker compose up -d staging --build
```

## Database
- SQLite file persisted via Docker volume
- Migrations managed by Drizzle Kit
- Backup: volume snapshot or file copy

## Monitoring
- Health endpoint: `GET /api/health`
- Docker logs: `docker compose logs -f staging`

## Rollback
```bash
# Quick rollback to previous commit
git checkout HEAD~1
docker compose up -d staging --build
```

## Cloudflare Deployment (Issue #13)
A deployment spike assessed Cloudflare Pages + D1 + Workers compatibility. See `docs/cloudflare-deployment-spike.md` for full findings. Summary: feasible but requires replacing better-sqlite3, nodemailer, pino, and bcryptjs (11-16h effort). Deferred until free hosting or edge performance is needed.


## October domain migration and isolated test

Production now serves `https://ideate.surcod.ro` on :4100 through rootless Podman
Quadlet `ideate-staging.service`. Its image/database are retained. The legacy
`idea.surmont.co` host redirects 301 preserving path/query. The existing homelab
owner manages NPM/TLS/DNS and SurCod's owner updated the portfolio links.

The essential UX branch runs separately at `https://test.ideate.surcod.ro` on
:4104, with synthetic SQLite data, a distinct session secret and Development
OIDC. Test noindex/no-store headers are enforced by the proxy. Outbound SMTP and
public E2E seed access are disabled. See [actual runtime units and rollback](../ops/README.md).
The historical Docker Compose recipe above remains a local alternative; do not
use it to replace the live Quadlet or promote the preview without review.
