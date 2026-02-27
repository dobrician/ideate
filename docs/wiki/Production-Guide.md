# Production Guide

Complete guide for deploying, configuring, monitoring, and maintaining Ideate in production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Database Management](#database-management)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Feature Reference](#feature-reference)
- [Security Checklist](#security-checklist)

---

## Prerequisites

- **Docker** 24+ with Docker Compose v2
- **Node.js** 22+ (for local development only)
- **Domain** with HTTPS (Let's Encrypt or managed certificate)
- **SMTP provider** (Resend, SendGrid, SES, or self-hosted)
- **Git** access to repository

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Session signing key (min 32 chars) | `openssl rand -base64 32` |
| `APP_URL` | Public URL (no trailing slash) | `https://idea.surmont.co` |
| `NEXT_PUBLIC_APP_URL` | Same as APP_URL (client-side) | `https://idea.surmont.co` |
| `DATABASE_URL` | SQLite path or PostgreSQL DSN | `/data/database.sqlite` |
| `SMTP_HOST` | SMTP server hostname | `smtp.resend.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `resend` |
| `SMTP_PASS` | SMTP password/API key | `re_xxx` |
| `SMTP_FROM` | Sender email address | `idea@surcod.ro` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_DRIVER` | `sqlite` or `postgresql` | `sqlite` |
| `REDIS_URL` | Redis connection URL (enables L2 cache) | none |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key | none |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | none |
| `SENTRY_DSN` | Sentry error tracking DSN | none |
| `OPENAI_API_KEY` | OpenAI API key (AI features) | none |
| `GEMINI_API_KEY` | Google Gemini API key (alt AI) | none |
| `NODE_ENV` | `production` or `development` | `production` |

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### PostgreSQL Mode

Set `DATABASE_DRIVER=postgresql` and provide a PostgreSQL DSN:
```
DATABASE_URL=postgresql://user:pass@host:5432/ideate
```

Run PostgreSQL migrations:
```bash
npm run db:migrate
```

---

## Deployment

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
services:
  staging:
    build: .
    ports:
      - "4100:3000"
    volumes:
      - ideate-data:/data
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  ideate-data:
```

### Deploy Steps

```bash
# Pull latest code
git pull origin main

# Build and deploy
docker compose down
docker compose up -d staging --build

# Verify health
curl -s https://idea.surmont.co/api/health | jq
```

### CI/CD (GitHub Actions)

The CI pipeline automatically:
1. Runs lint, typecheck, tests
2. Builds the application
3. Runs E2E tests
4. Pushes Docker image to `ghcr.io`

To deploy from CI image:
```bash
docker pull ghcr.io/dobrician/ideate:latest
docker compose up -d staging
```

### Rollback

```bash
# Quick rollback to previous commit
git checkout HEAD~1
docker compose up -d staging --build

# Or use a specific Docker image tag
docker pull ghcr.io/dobrician/ideate:<commit-sha>
```

---

## Database Management

### Migrations

Migrations are applied automatically on startup. To run manually:
```bash
npm run db:migrate
```

### Backup

Automated backup script:
```bash
npm run db:backup
```

This creates a timestamped copy in `backups/`. For Docker:
```bash
docker exec ideate-staging cp /data/database.sqlite /data/backups/$(date +%Y%m%d).sqlite
```

### Restore

```bash
docker exec ideate-staging cp /data/backups/<timestamp>.sqlite /data/database.sqlite
docker restart ideate-staging
```

### Schema (33 migrations, Sprints 1-62)

Key tables: `users`, `projects`, `proposals`, `votes`, `comments`, `audit_logs`, `api_keys`, `webhooks`, `webhook_deliveries`, `push_subscriptions`, `cache_entries`, `jobs`, `integrations`, `workflow_stages`, `workflow_transitions`

---

## Monitoring

### Health Check
```
GET /api/health
```

### Performance Dashboard
- URL: `/admin/perf-dashboard/`
- Requires admin role
- Shows: Web Vitals, cache hit rates, query timing, error rates

### Web Vitals API
```
GET /api/perf/vitals
```

### Sentry Integration

Set `SENTRY_DSN` to enable error tracking. Configuration files:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

### Docker Logs
```bash
docker compose logs -f staging --tail 100
```

---

## Backup & Recovery

### Automated Backups
```bash
# Add to crontab for daily backups
0 2 * * * cd /home/dc/work/ideate && npm run db:backup
```

### Disaster Recovery

1. Stop the container: `docker compose down`
2. Restore database from backup
3. Verify backup integrity: `sqlite3 /data/database.sqlite "PRAGMA integrity_check;"`
4. Restart: `docker compose up -d staging`
5. Verify: `curl https://idea.surmont.co/api/health`

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | App not started | Check `docker compose logs staging` |
| Auth loops | JWT_SECRET mismatch | Ensure same secret across deploys |
| Empty database | Volume not mounted | Check Docker volume mapping |
| Slow queries | Missing indexes | Run migrations (auto-applied) |
| Push not working | VAPID keys missing | Generate and set VAPID env vars |
| AI features disabled | No API key | Set OPENAI_API_KEY or GEMINI_API_KEY |
| Redis errors | Redis not reachable | App works without Redis (L2 cache disabled) |
| Rate limit 429 | Too many requests | Wait for window reset (1 min for auth, 1h for API) |

### Debug Mode
```bash
# Enable verbose logging
docker compose exec staging env NODE_ENV=development
```

### Database Recovery
```bash
# Check database integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"

# Rebuild FTS indexes
sqlite3 database.sqlite "INSERT INTO projects_fts(projects_fts) VALUES('rebuild');"
```

---

## Feature Reference

### Sprints 54-62 Features

| Feature | Sprint | Admin Path | Config |
|---------|--------|-----------|--------|
| Vote Velocity Analytics | 54 | `/admin/analytics/` | Automatic |
| Workflow Engine | 55 | `/admin/workflows/` | Custom stages |
| Dynamic RBAC | 56 | `/admin/permissions/` | Time-based rules |
| Real-time Collaboration | 57 | N/A | WebSocket auto |
| AI Insights | 58 | `/admin/ai-insights/` | Requires API key |
| Search & Discovery | 59 | `/admin/analytics/` | FTS5 auto |
| Cache & Performance | 60 | `/admin/perf-dashboard/` | Redis optional |
| Integrations | 61 | `/admin/integrations/` | Slack/Teams/Discord |
| Mobile & Accessibility | 62 | N/A | PWA auto |
| Production Hardening | 63 | N/A | This guide |

### Integration Setup

**Slack:** Create a Slack Incoming Webhook, add URL in `/admin/integrations/`
**Teams:** Create a Teams Incoming Webhook connector, add URL
**Discord:** Create a Discord Webhook in channel settings, add URL
**API Keys:** Generate in `/admin/integrations/`, choose tier (basic/pro/enterprise)

### Webhook Events

12 events available: `project.created`, `project.updated`, `project.archived`, `project.deadline`, `proposal.created`, `proposal.updated`, `proposal.status_changed`, `vote.cast`, `comment.created`, `user.joined`, `workflow.stage_changed`, `integration.test`

---

## Security Checklist

- [ ] JWT_SECRET is at least 32 characters, randomly generated
- [ ] HTTPS enforced (HSTS headers active)
- [ ] SMTP credentials not in source code
- [ ] API keys use `idk_` prefix with SHA-256 hashing
- [ ] Rate limiting active on all endpoints
- [ ] CSRF protection enabled (sameSite + origin validation)
- [ ] Push notification URLs restricted to HTTPS
- [ ] Webhook secrets use HMAC-SHA256 signatures
- [ ] Database backups automated
- [ ] Sentry DSN configured for error tracking
- [ ] Docker volumes persisted across restarts
- [ ] No `continue-on-error` in CI pipeline
