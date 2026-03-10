# Smoke Report Template

Use this template for both automated and manual smoke runs.

## Metadata
- Date (UTC):
- Runner:
- Environment: OT&E
- Commit:
- Branch:
- Mutation enabled: yes/no
- Domain used (if mutation): `<domain-or-n/a>`

## Gate Commands
| Command | Expected | Actual | Result |
|:--|:--|:--|:--|
| `npm run build` | exit 0 |  |  |
| `npm run start -- --help` | exit 0 |  |  |
| `npm run test:smoke:preflight` | exit 0 |  |  |
| `npm run test:smoke:read` | exit 0 |  |  |

## Automated Read-Only Cases
| Case | Command | Expected | Actual | Result |
|:--|:--|:--|:--|:--|
| CLI help | `node dist/index.js --help` | usage shown |  |  |
| CLI version | `node dist/index.js --version` | semver output |  |  |
| DNS help | `node dist/index.js dns --help` | dns usage shown |  |  |
| Unknown command | `node dist/index.js doesnotexist` | exit 1 + error |  |  |
| Login usage | `node dist/index.js login` | exit 1 + usage |  |  |
| DNS list usage | `node dist/index.js dns list` | exit 1 + usage |  |  |
| Balance | `node dist/index.js balance` | account overview |  |  |
| Domains | `node dist/index.js domains` | list/empty handled |  |  |
| Search | `node dist/index.js search ... --price` | success output |  |  |

## Manual Mutating Checklist
| Step | Command | Expected | Actual | Result |
|:--|:--|:--|:--|:--|
| Buy | `npm run start -- buy ... --yes` | success/pending |  |  |
| Info verify | `npm run start -- info ...` | domain shown |  |  |
| DNS set | `npm run start -- dns set ...` | success/pending |  |  |
| DNS update | `npm run start -- dns update ...` | success |  |  |
| DNS remove | `npm run start -- dns rm ...` | success |  |  |
| Pref toggles | `npm run start -- set ...` | success |  |  |
| Renew | `npm run start -- renew ... --yes` | success/pending |  |  |
| DNS NS (optional) | `npm run start -- dns ns ...` | success/pending |  |  |

## Failures and Diagnostics
- Failure summary:
- Relevant logs:
- Retry attempts:
- Root-cause hypothesis:

## Final Verdict
- Gate status: PASS/FAIL
- Provider implementation unlocked: yes/no
- Follow-up actions:
