# OT&E Smoke Checklist (Mutating)

## Scope and Safety
- Environment must be OT&E only (`ote: true` in `~/.config/opendom/config.json`).
- Use only disposable domains for mutating checks.
- Never run these steps against production credentials.
- Capture all results in a report under `reports/smoke/`.

## Prerequisites
- `npm run test:smoke:preflight` is `PASS`.
- `npm run build` is `PASS`.
- `npm run test:smoke:read` is `PASS`.
- Export mutation guard variables:
  - `OPENDOM_SMOKE_ALLOW_MUTATION=true`
  - `OPENDOM_SMOKE_DOMAIN=<disposable-domain>`

## MUST PASS Steps
1. Buy disposable domain
- Command: `npm run start -- buy "$OPENDOM_SMOKE_DOMAIN" --yes`
- Expectation: exit code `0`; command reports `DONE` or explicit ownership confirmation.

2. Verify domain info
- Command: `npm run start -- info "$OPENDOM_SMOKE_DOMAIN"`
- Expectation: exit code `0`; output contains domain details and status fields.

3. Add DNS record
- Command: `npm run start -- dns set "$OPENDOM_SMOKE_DOMAIN" A 1.2.3.4 --subdomain smoke --ttl 300`
- Expectation: exit code `0`; operation status `DONE` or `PENDING`.

4. Validate DNS record appears
- Command: `npm run start -- dns list "$OPENDOM_SMOKE_DOMAIN"`
- Expectation: output includes `smoke` subdomain and `1.2.3.4`.

5. Update DNS record
- Command: `npm run start -- dns update "$OPENDOM_SMOKE_DOMAIN" A 1.2.3.4 5.6.7.8 --subdomain smoke --ttl 300`
- Expectation: exit code `0`; update result is successful.

6. Validate updated DNS record
- Command: `npm run start -- dns list "$OPENDOM_SMOKE_DOMAIN"`
- Expectation: old value removed, new value `5.6.7.8` present.

7. Remove DNS record
- Command: `npm run start -- dns rm "$OPENDOM_SMOKE_DOMAIN" A 5.6.7.8 --subdomain smoke`
- Expectation: exit code `0`; record removal reported as successful.

8. Toggle domain preferences
- Commands:
  - `npm run start -- set "$OPENDOM_SMOKE_DOMAIN" whois-privacy on`
  - `npm run start -- set "$OPENDOM_SMOKE_DOMAIN" auto-renew on`
  - `npm run start -- set "$OPENDOM_SMOKE_DOMAIN" lock on`
- Expectation: each command exits `0` and reports successful change.

9. Verify preference state
- Command: `npm run start -- info "$OPENDOM_SMOKE_DOMAIN"`
- Expectation: ON values are reflected for privacy/auto-renew/lock.

10. Renew domain
- Command: `npm run start -- renew "$OPENDOM_SMOKE_DOMAIN" --duration 1 --yes`
- Expectation: exit code `0`; renewal result is `DONE` or `PENDING`.

11. Optional nameserver change check
- Command: `npm run start -- dns ns "$OPENDOM_SMOKE_DOMAIN" ns1.netim.net ns2.netim.net`
- Expectation: exit code `0`; nameserver operation reported successfully.

## Rollback / Cleanup
- Remove any temporary DNS records created during tests.
- Reset modified preferences if required by your OT&E baseline.
- If the domain should not remain registered, decommission according to OT&E policy.

## Exit Criteria
- All MUST PASS steps pass with evidence.
- Any FAIL blocks provider implementation work.
- Optional checks are documented separately and do not override MUST FAIL blockers.
