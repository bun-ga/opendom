# Provider Capabilities (v1)

| Command | Netim | Cloudflare | Porkbun | Namecheap |
|:--|:--|:--|:--|:--|
| `search` | ✅ | ✅ (registrar lookup) | ✅ | ✅ |
| `buy` | ✅ | ❌ fail-fast | ✅ | ✅ (requires contact profile) |
| `domains` | ✅ | ✅ | ✅ | ✅ |
| `info` | ✅ | ✅ | ✅ | ✅ |
| `renew` | ✅ | ❌ fail-fast | ❌ fail-fast | ✅ |
| `set whois-privacy` | ✅ | ✅ | ❌ | ✅ |
| `set auto-renew` | ✅ | ✅ | ✅ | ❌ |
| `set lock` | ✅ | ✅ | ❌ | ✅ |
| `dns list/set/rm/update` | ✅ | ✅ | ✅ | ✅ |
| `dns ns` | ✅ | ❌ fail-fast | ✅ | ✅ |
| `balance` | ✅ | partial | partial | partial |

## Notes
- Cloudflare registrar `buy/renew` remain fail-fast in CLI; `search` and `set` rely on registrar token/account scope.
- Netim `buy` auto-resolves Owner/Admin/Tech/Billing from account defaults when local defaults are missing.
- Porkbun requires per-domain API Access enabled in dashboard.
- Porkbun `renew` is fail-fast because public API does not expose a documented immediate renew endpoint.
- Porkbun `set` supports `auto-renew` only.
- Namecheap defaults to production endpoint; use `--sandbox` during login/testing.
- Namecheap `buy` requires a stored contact profile in config.
