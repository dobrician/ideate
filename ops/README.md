# Separate production and essential UX preview

Production: https://ideate.surcod.ro → vm-apps :4100.
Test: https://test.ideate.surcod.ro → vm-apps :4104.
Legacy: idea.surmont.co → direct 301 preserving path/query to production.

The existing homelab agent owns DNS, NPM 35/36, TLS certificate 42 and legacy
proxy 23. Do not promote the experimental user interface to production as part
of this migration. The authorized SSO-only patch uses image a20e131fbea0; prior bda634076936 is
retained for rollback. Its SQLite volume and frozen project interface are
preserved; runtime origin overrides remain APP_URL and OIDC_REDIRECT_URI.
`ideate-staging.container` records the rootless Podman Quadlet configuration.
The old container name is retained to preserve operational references.

The test systemd user service uses `/home/dc/work/ideate-test`, on branch
`sprint/2026-10-04-essential-user-experience`. Its private runtime environment is
`/home/dc/.config/ideate/test.env` (0600), with a distinct JWT secret and the
existing Development OIDC client. Its database and mail log are under
`/home/dc/.local/share/ideate-test` (0700). No production database was imported.
SMTP outbound delivery and E2E seed access are disabled in the public test
runtime. Keep test data synthetic. NPM adds noindex/nofollow/noarchive and
Cache-Control no-store to the public test responses.

## Rebuild test only

Use the installed Node 22.23.2 runtime; Node 24 has an incompatible native
SQLite binding in the current dependency installation. Build to a new owned,
registered directory before switching the service:

```bash
NEXT_DIST_DIR=.next-mobile-compact SKIP_DB_INIT=1 npm run build
cp -al .next-mobile-compact/static .next-mobile-compact/standalone/.next-mobile-compact/static
cp -al public .next-mobile-compact/standalone/public
```

Do not overwrite an active build. Update the service WorkingDirectory only
after a successful build, then daemon-reload/restart `ideate-test.service`.
The committed unit records the current build directory. Secrets remain outside
the repository. New builds do not seed or migrate the production database.
After a test restart, run smoke with APP_URL set to the test host and MAIL_LOG_FILE
set to its private local mail log. Mandatory auth smoke creates synthetic
accounts; it must not send messages to real users.

## Verification and rollback

Run unit/E2E suites with isolated SQLite, JWT and mail logs. The IP-limit case
runs separately because concurrent fixture seeds reset global limit state (#76).
Preserve failed-run evidence and passing rechecks. The static-assets smoke
asserts actual CSS/JS presence and status; global networkidle is inappropriate
when the existing missing offline route aborts service-worker precaching (#72).
The offline defect is tracked; project code freeze prevents unrelated fixes.

To roll back the test UI, stop `ideate-test.service` or point it to the prior
owned standalone build; retain its independent database. Production rollback
uses the retained previous image dc53ece7a0d8 and the same production volume.
Coordinate domain/redirect rollback with homelab, preserving old callback URIs.
The previous Quadlet snapshot and test/build logs are under the registered
`/tmp/codex-ideate-simplify-20261004` evidence directory.

Live local SSO is verified with real PKCE authorization codes on both origins.
The existing SSO subject maps to Ciprian's existing production account; the test
mapping points to the separate synthetic Ciprian owner. Private browser states
are in `ideate-oidc-local-state.json` under the private surcod-demo state directory.
Google login is not verified; it requires DC's fresh provider login.


Production auth smoke uses configured SMTP even when MAIL_LOG_FILE is set.
A local log does not disable delivery. The migration smoke sent two technical
emails to catch-all addresses; this was disclosed and must not be repeated
under DC's no-email constraint. For production follow-up use read-only checks
and the already verified local SSO session. Run email integration checks only
against the isolated test runtime with SMTP disabled, unless DC explicitly
authorizes production email delivery. No coordination notifications are allowed.

The mobile proposal review (#89) now uses `.next-mobile-compact/standalone` on test only; `.next-sso-only` is its retained rollback. Production remains on `a20e131fbea0`. The authorized change reopens only responsive proposal presentation, with descriptions opened deliberately on touch.

The Opus-reviewed polish (#90) uses `.next-opus-polish/standalone` on test only; `.next-mobile-compact` is its retained rollback. Project-detail pagination defaults remain unchanged; only the Projects list opts into a compact mobile window. Production stays on `a20e131fbea0`. See the canonical handover and adversarial review for the real reviewer/validation scope.
