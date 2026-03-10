# Namecheap Provider Notes

## Supported in v1
- `search`, `buy`, `domains`, `info`, `renew`
- DNS list/create/update/delete (`setHosts` merge-write)
- Nameserver updates (`dns ns`)
- `set lock`, `set whois-privacy`

## API Constraints
- XML response format (query-string command model).
- `ClientIp` must be whitelisted in Namecheap panel.
- Production API may be unavailable for accounts below Namecheap thresholds.

## Environment
- Production is default.
- Use `--sandbox` on login to store sandbox mode.

## Buy Requirements
- Namecheap domain creation requires contact profile fields in config.
- If contact profile is missing, CLI returns fail-fast guidance.

## Auto-Renew Preference
- `set auto-renew` is fail-fast in v1 for Namecheap.
