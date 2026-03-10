# Cloudflare Provider Notes

## Supported in v1
- Registrar domain listing/info/search (token scope permitting)
- Registrar preference updates: `auto-renew`, `lock`, `whois-privacy`
- Zone listing and domain info fallback
- DNS list/create/update/delete
- Token verification and account-level checks

## Not Supported in v1
- `buy`
- `renew`
- `dns ns`

These operations return fail-fast errors with guidance to use Cloudflare dashboard.

## Auth Requirements
- Use scoped API Token with at least zone read + DNS edit permissions.
- For registrar operations (`search`, `set`, registrar `domains/info`), token needs account/registrar scope.
- `--account-id` is recommended for consistent registrar operations.

## Zone Resolution
- CLI resolves `zone_id` automatically from domain name.
- Parent-domain fallback is applied for subdomain inputs.
