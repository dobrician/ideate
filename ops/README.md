# Production and isolated test runtime

Production: https://ideate.surcod.ro → :4100. Test: https://test.ideate.surcod.ro → :4104. Legacy idea.surmont.co redirects directly with HTTP 301 and preserves path/query. Homelab owns DNS/NPM/TLS; publishing this release changes no infrastructure.

## Approved production release — 4 October

DC approved the reviewed essential user experience. Main `160b646` has the same application/test source as reviewed `ecb537d`. Current rootless Podman image: `96d45a6855c4`, tagged `localhost/ideate-essential:20261004-ecb537d` and `docker.io/library/ideate-staging:latest`. `ideate-staging.service` and container `ideate.surmont.co` retain volume `ideate-data-staging`, private `.env.local`, Redis, APP_URL and OIDC_REDIRECT_URI. No schema change or data seed. `ideate-staging.container` mirrors the unchanged runtime unit.

Before promotion, retain the current image under an immutable rollback tag and take a consistent SQLite backup. Build from approved source with `podman build`, tag the verified new image as `docker.io/library/ideate-staging:latest`, then restart only `ideate-staging.service`. Run `APP_URL=https://ideate.surcod.ro npm run test:smoke` and inspect container health. Failure requires a fix or rollback before declaring success. The current SSO-only smoke sends no email and makes no AI calls.

Rollback this release:

```bash
podman tag localhost/ideate-rollback:pre-essential-20261004 docker.io/library/ideate-staging:latest
systemctl --user restart ideate-staging.service
APP_URL=https://ideate.surcod.ro npm run test:smoke
```

The retained previous image is `a20e131fbea0`. Keep the same database volume and environment. Evidence and a private consistent backup are registered under `/tmp/codex-ideate-promote-20261004` through 11 October. HANDOVER records validation and unchanged data hashes.

## Independent test runtime

`ideate-test.service` runs `/home/dc/work/ideate-test/.next-opus-polish/standalone` on :4104. `.next-mobile-compact` remains its rollback. Both builds are protected through 3 November. Private environment: `/home/dc/.config/ideate/test.env` (0600), distinct JWT secret and existing Development OIDC. Synthetic database: `/home/dc/.local/share/ideate-test/ideate.db`. Outbound SMTP, Redis and public E2E seeds are disabled. NPM adds noindex/nofollow/noarchive and Cache-Control no-store. Production data is never imported.

Use installed Node 22.23.2 for local builds/tests; Node 24 is incompatible with the installed SQLite binding. Register a fresh build directory before building. Do not overwrite an active or rollback build. Set NEXT_DIST_DIR to that fresh directory, build with SKIP_DB_INIT=1, copy static/public assets into standalone, then update WorkingDirectory only after build success. Rerun test-host smoke after restart.

Real local SSO/PKCE was verified on both origins; existing sessions and provider/account mappings remain valid after promotion. Google login has not been verified. Private browser state is under the surcod-demo state directory and must never enter git or chat.

Known deferred issues: proxy attribution #88, Safari SSE timing #83, isolated rate-limit tests #76, dependencies #75, offline precache #72 and frozen-layout edge cases #91. Public smoke checks actual CSS/JS responses rather than global networkidle. No unrelated project backend changes are part of this release.
