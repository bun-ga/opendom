# Porkbun Provider Notes

## Supported in v1
- `search`, `buy`, `domains`, `info`
- DNS list/create/update/delete
- Nameserver updates (`dns ns`)
- `set auto-renew`

## Constraints
- Porkbun API is POST-only, including read operations.
- Each domain must have API access enabled in Porkbun dashboard.
- CLI validates API visibility with `domain/listAll` before domain-scoped operations.
- `buy` requires API check response pricing because create call requires `cost`.
- `buy` must use the domain's API-reported `minDuration`; CLI enforces matching `--duration`.
- `renew` remains fail-fast: public API does not expose documented immediate renew endpoint.

## Auth Requirements
- `--apikey`
- `--secretapikey`

## Preference Commands
- `set auto-renew` is supported.
- `set whois-privacy` and `set lock` are fail-fast with dashboard guidance.
