# @bun-ga/opendom

> Multi-provider domain management from your terminal.  
> No upsells, no popups, no cookie banners.

```bash
opendom search startup --tlds com,io,dev
opendom buy startup.com --yes
opendom dns set startup.com A 1.2.3.4
```

`opendom` is a CLI for searching, buying, renewing, and managing domains across multiple registrars with one command surface.

## Install

```bash
npm install -g @bun-ga/opendom
opendom --help
```

## Quick Start

```bash
# Netim login (OT&E)
opendom login --provider netim --id YOUR_RESELLER_ID --secret YOUR_API_SECRET --ote

# Provider-scoped command examples
opendom domains --provider netim
opendom search myproject --tlds com,io --provider porkbun
opendom dns list example.com --provider cloudflare
```

## Supported Providers

- Netim
- Cloudflare
- Porkbun
- Namecheap

Capability matrix and provider caveats:
- https://opendom.bun.ga/getting-started
- https://opendom.bun.ga/authentication
- https://opendom.bun.ga/first-commands
- https://opendom.bun.ga/providers-matrix
- https://opendom.bun.ga/reference

## CLI

### Global Flags

- `--provider <netim|cloudflare|porkbun|namecheap>`
- `--help`, `-h`
- `--version`, `-v`

Provider flag will be mandatory in `v0.3.0`. In `v0.2.x`, missing provider falls back to Netim with warning.

### Auth Commands

```bash
opendom login --provider netim --id <ID> --secret <SECRET> [--ote]
opendom login --provider cloudflare --token <TOKEN> [--account-id <ACCOUNT_ID>]
opendom login --provider porkbun --apikey <APIKEY> --secretapikey <SECRETAPIKEY>
opendom login --provider namecheap --api-user <API_USER> --username <USERNAME> --api-key <API_KEY> --client-ip <IP> [--sandbox]

opendom logout --provider <provider>
opendom logout --all
```

### Domain Commands

```bash
opendom search <name> [--tlds com,io] [--price] --provider <provider>
opendom buy <domain> [--duration 1] [--yes] [--owner <CONTACT_ID>] --provider <provider>
opendom domains --provider <provider>
opendom info <domain> --provider <provider>
opendom renew <domain> [--duration 1] [--yes] --provider <provider>
opendom set <domain> <whois-privacy|auto-renew|lock> <on|off> --provider <provider>
```

### DNS Commands

```bash
opendom dns list <domain> --provider <provider>
opendom dns set <domain> <TYPE> <VALUE> [--subdomain <sub>] [--ttl <sec>] [--priority <n>] --provider <provider>
opendom dns rm <domain> <TYPE> <VALUE> [--subdomain <sub>] --provider <provider>
opendom dns update <domain> <TYPE> <OLD> <NEW> [--subdomain <sub>] [--ttl <sec>] --provider <provider>
opendom dns ns <domain> <ns1> <ns2> [ns3...] --provider <provider>
```

## Command Compatibility

Legend:
- `OK` = supported
- `PARTIAL` = supported with scope or feature limits
- `FAIL-FAST` = intentionally blocked with a guidance message

| Command | Netim | Cloudflare | Porkbun | Namecheap | Notes |
|:--|:--|:--|:--|:--|:--|
| `login` / `logout` | OK | OK | OK | OK | Provider-specific auth flags required. |
| `balance` | OK | PARTIAL | PARTIAL | PARTIAL | Cloudflare/Porkbun may not expose real account balance values. |
| `search` | OK | PARTIAL | OK | OK | Cloudflare needs registrar/account scope. |
| `buy` | OK | FAIL-FAST | OK | OK | Cloudflare buy is dashboard-only. Namecheap needs contact profile in config. |
| `domains` | OK | OK | OK | OK | Cloudflare may use registrar list or zone fallback depending on token scope. |
| `info` | OK | OK | OK | OK | Cloudflare merges registrar and zone data when possible. |
| `renew` | OK | FAIL-FAST | FAIL-FAST | OK | Cloudflare/Porkbun renew not exposed in this CLI flow. |
| `set whois-privacy` | OK | OK | FAIL-FAST | OK | Porkbun directs to dashboard. |
| `set auto-renew` | OK | OK | OK | FAIL-FAST | Namecheap auto-renew toggle not exposed in this CLI flow. |
| `set lock` | OK | OK | FAIL-FAST | OK | Porkbun lock toggle not exposed in this CLI flow. |
| `dns list` | OK | OK | OK | OK | Namecheap DNS uses `setHosts` merge-write model. |
| `dns set` | OK | OK | OK | OK | Porkbun requires per-domain API Access enabled. |
| `dns rm` | OK | OK | OK | OK | Record must match exactly (`type`, `subdomain`, `value`). |
| `dns update` | OK | OK | OK | OK | Updates are provider-specific under the hood, CLI contract is common. |
| `dns ns` | OK | FAIL-FAST | OK | OK | Cloudflare authoritative NS cannot be changed in this CLI flow. |

## Provider Notes

- Cloudflare: `buy/renew` are fail-fast; `search` and `set` require registrar scope and usually account-level access.
- Netim: `buy` auto-resolves Owner/Admin/Tech/Billing from account defaults when not provided; use `--owner` to override.
- Porkbun: domain-level API Access must be enabled in the dashboard.
- Porkbun: `set` currently supports `auto-renew` only; `renew` is fail-fast in CLI.
- Namecheap: production default; API requires whitelisted `ClientIp` and may need account eligibility.

## Config And Migration

`opendom` stores config under:

```text
~/.config/opendom/config.json
```

Config format moved to v2 (`schemaVersion: 2`) with provider-specific credential blocks:

```json
{
  "schemaVersion": 2,
  "defaults": { "provider": "netim" },
  "providers": {
    "netim": {
      "env": "ote",
      "credentials": {
        "resellerId": "...",
        "apiSecret": "..."
      }
    }
  }
}
```

Legacy Netim configs are auto-migrated and backed up as:

```text
~/.config/opendom/config.json.bak-v1
```

## Repository And Docs

- Documentation: https://opendom.bun.ga/
- Repository: https://github.com/bun-ga/opendom
- Issues: https://github.com/bun-ga/opendom/issues
- Package source: https://github.com/bun-ga/opendom/tree/main/apps/opendom-cli

## License

AGPL-3.0-only
