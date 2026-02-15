# Deployment

## Infrastructure
- **Host:** 10.57.1.1 (local network)
- **Reverse Proxy:** Nginx Proxy Manager
- **Domain:** idea.surmont.co (HTTPS via Let's Encrypt)
- **Route:** idea.surmont.co → http://10.57.1.1:4100

## Docker Containers

### Staging (Production-like)
- Port: 4100
- Always running (`restart: unless-stopped`)
- Updated only after sprint tests pass
- This is what idea.surmont.co serves

### Dev (Sprint Work)
- Port: 4101
- Active during sprints
- May be broken at any time
- Not externally accessible

## Environment Variables
See `.env.example` for full list. Critical ones:
- `JWT_SECRET` — generate with `openssl rand -base64 32`
- `SMTP_*` — smtp2go credentials
- `APP_URL` — `https://idea.surmont.co`
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
