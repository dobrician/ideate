#!/usr/bin/env bash
# Cloudflare Pages + D1 deployment script for Ideate
#
# Prerequisites:
#   - wrangler CLI installed: npm install -g wrangler
#   - Authenticated: wrangler login
#   - D1 database created: wrangler d1 create ideate-db
#   - R2 bucket created: wrangler r2 bucket create ideate-uploads
#   - KV namespace created: wrangler kv namespace create RATE_LIMIT
#   - Update wrangler.toml with the actual database_id and KV namespace id
#   - Set environment variables in Cloudflare Pages dashboard
#
# Usage:
#   ./scripts/cf-deploy.sh [--local]    # --local for local D1 testing

set -euo pipefail

LOCAL_FLAG=""
if [[ "${1:-}" == "--local" ]]; then
  LOCAL_FLAG="--local"
  echo "==> Running in local mode"
fi

echo "==> Applying D1 migrations..."
for sql_file in drizzle/*.sql; do
  if [[ -f "$sql_file" ]]; then
    echo "    Applying: $(basename "$sql_file")"
    wrangler d1 execute ideate-db $LOCAL_FLAG --file="$sql_file" 2>/dev/null || true
  fi
done

echo "==> Migrations complete"

if [[ -z "$LOCAL_FLAG" ]]; then
  echo "==> Building for Cloudflare Pages..."
  npx @cloudflare/next-on-pages

  echo "==> Deploying to Cloudflare Pages..."
  wrangler pages deploy .vercel/output/static \
    --project-name=ideate

  echo "==> Deploy complete!"
else
  echo "==> Local D1 ready. Run 'wrangler pages dev' to start local server."
fi
