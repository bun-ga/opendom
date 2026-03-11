# opendom CLI - AI Agent Reference

## Overview

opendom is a domain management CLI tool designed for AI agents. It provides a unified interface to manage domains across multiple domain registrars (Netim, Cloudflare, Porkbun, Namecheap) with commands for searching, buying, renewing, and managing DNS records.

## Quick Reference

```bash
# Authentication
opendom login <provider> [flags]     # Login to provider
opendom logout [--provider <provider>]  # Logout from provider
opendom set-default <provider>       # Set default provider

# Domain Operations
opendom search <name> [--tlds tlds]   # Search domain availability
opendom buy <domain> [--yes]          # Purchase domain
opendom domains                       # List owned domains
opendom info <domain>                 # Get domain details
opendom renew <domain> [--yes]        # Renew domain
opendom set <domain> <pref> <on|off> # Set preferences

# DNS Management
opendom dns list <domain>             # List DNS records
opendom dns set <domain> <TYPE> <VALUE> [--subdomain <sub>] [--ttl <sec>]
opendom dns rm <domain> <TYPE> <VALUE> [--subdomain <sub>]
opendom dns update <domain> <TYPE> <OLD> <NEW> [--subdomain <sub>]
opendom dns ns <domain> <ns1> <ns2> [ns3...]

# Account
opendom balance                       # Check account balance
```

## Provider Capabilities Matrix

| Feature         | Netim   | Cloudflare | Porkbun  | Namecheap |
|-----------------|---------|------------|----------|-----------|
| search          | Yes     | Yes        | Yes      | Yes       |
| buy             | Yes     | No         | Yes      | Yes       |
| domains         | Yes     | Yes        | Yes      | Yes       |
| info            | Yes     | Yes        | Yes      | Yes       |
| renew           | Yes     | No         | No       | Yes       |
| set             | Yes     | Yes        | Yes      | Yes       |
| dns-list        | Yes     | Yes        | Yes      | Yes       |
| dns-set         | Yes     | Yes        | Yes      | Yes       |
| dns-rm          | Yes     | Yes        | Yes      | Yes       |
| dns-update      | Yes     | Yes        | Yes      | Yes       |
| dns-ns          | Yes     | No         | Yes      | Yes       |
| balance         | Yes     | Yes        | Yes      | Yes       |

## Command Compatibility (Detailed)

| Command              | Netim | Cloudflare | Porkbun | Namecheap |
|:--------------------|:-----:|:----------:|:-------:|:---------:|
| login/logout        | OK    | OK         | OK      | OK        |
| balance             | OK    | PARTIAL    | PARTIAL | PARTIAL   |
| search              | OK    | PARTIAL    | OK      | OK        |
| buy                 | OK    | FAIL-FAST  | OK      | OK        |
| domains             | OK    | OK         | OK      | OK        |
| info                | OK    | OK         | OK      | OK        |
| renew               | OK    | FAIL-FAST  | FAIL-FAST | OK      |
| set whois-privacy   | OK    | OK         | FAIL-FAST | OK      |
| set auto-renew      | OK    | OK         | OK      | FAIL-FAST |
| set lock            | OK    | OK         | FAIL-FAST | OK      |
| dns list            | OK    | OK         | OK      | OK        |
| dns set             | OK    | OK         | OK      | OK        |
| dns rm              | OK    | OK         | OK      | OK        |
| dns update          | OK    | OK         | OK      | OK        |
| dns ns              | OK    | FAIL-FAST  | OK      | OK        |

Legend:
- **OK**: Fully supported
- **PARTIAL**: Works but may have limited data
- **FAIL-FAST**: Blocked intentionally with guidance message

## Authentication

### Netim

```bash
opendom login netim --id <RESELLER_ID> --secret <API_SECRET> [--ote]
```

- `--id`: Netim reseller ID
- `--secret`: Netim API secret key
- `--ote`: Use OTE (Operational Testing Environment) sandbox

### Cloudflare

```bash
opendom login cloudflare --token <API_TOKEN> [--account-id <ACCOUNT_ID>]
```

- `--token`: Cloudflare API token
- `--account-id`: Optional account ID for organizations

### Porkbun

```bash
opendom login porkbun --apikey <API_KEY> --secretapikey <SECRET_API_KEY>
```

- `--apikey`: Porkbun API key
- `--secretapikey`: Porkbun secret API key

### Namecheap

```bash
opendom login namecheap --api-user <API_USER> --username <USERNAME> --api-key <API_KEY> --client-ip <CLIENT_IP> [--sandbox] [--address-id <ADDRESS_ID>]
```

- `--api-user`: Namecheap API username
- `--username`: Namecheap account username
- `--api-key`: Namecheap API key
- `--client-ip`: Client IP address for API calls
- `--sandbox`: Use sandbox environment
- `--address-id`: Address ID for domain registration

## Command Reference

### Authentication Commands

#### login

Authenticate with a provider. Credentials are stored encrypted in `~/.config/opendom/config.json`.

```bash
# Interactive login (prompts for credentials)
opendom login netim
opendom login cloudflare

# Non-interactive login with flags
opendom login netim --id RESELLER_ID --secret SECRET_KEY
opendom login cloudflare --token API_TOKEN
opendom login porkbun --apikey KEY --secretapikey SECRET
opendom login namecheap --api-user user --username name --api-key key --client-ip 1.2.3.4
```

#### logout

Remove stored credentials for a provider.

```bash
# Logout from specific provider
opendom logout --provider netim

# Logout from all providers
opendom logout --all
```

#### set-default

Set the default provider to use when no `--provider` flag is specified.

```bash
opendom set-default cloudflare
```

---

### Domain Commands

#### search

Check domain availability across TLDs.

```bash
# Search with default TLDs
opendom search example

# Search with specific TLDs
opendom search example --tlds com,io,dev

# Search with price information
opendom search example --price

# Search specific domain
opendom search example.com
```

Output:
```
  ✓ example.com    available   $12.00
  ✗ example.io     taken
  ! example.dev    premium     $50.00
```

#### buy

Purchase a domain. Requires confirmation unless `--yes` flag is used.

```bash
# Buy domain (interactive confirmation)
opendom buy example.com

# Buy domain without confirmation
opendom buy example.com --yes

# Buy with custom duration
opendom buy example.com --yes --duration 2

# Buy with custom nameservers
opendom buy example.com --yes --ns1 ns1.example.com --ns2 ns2.example.com

# Buy with owner contact
opendom buy example.com --yes --owner CONTACT_ID
```

#### domains

List all domains registered with the provider.

```bash
opendom domains
opendom domains --provider cloudflare
```

#### info

Get detailed information about a domain.

```bash
opendom info example.com
```

Output:
```
  example.com
  ──────────────────────────
  Provider      cloudflare
  Status        ACTIVE
  Created       2024-01-15
  Expires       2025-01-15
  NS1           ns1.cloudflare.com
  NS2           ns2.cloudflare.com
  Whois Privacy ON
  Auto-Renew    ON
  Registrar Lock ON
```

#### renew

Renew a domain registration. Requires confirmation unless `--yes` is used.

```bash
# Renew for 1 year (default)
opendom renew example.com --yes

# Renew for multiple years
opendom renew example.com --yes --duration 2
```

Note: Cloudflare and Porkbun do not support renew via API. Use provider dashboard.

#### set

Set domain preferences (whois-privacy, auto-renew, registrar lock).

```bash
# Enable WHOIS privacy
opendom set example.com whois-privacy on

# Disable auto-renew
opendom set example.com auto-renew off

# Enable registrar lock
opendom set example.com lock on
```

Valid preferences: `whois-privacy`, `auto-renew`, `lock`
Valid values: `on`, `off`, `1`, `0`, `true`, `false`, `yes`, `no`

---

### DNS Commands

#### dns list

List all DNS records for a domain.

```bash
opendom dns list example.com
opendom dns list sub.example.com
```

Output:
```
  DNS Records for example.com
  ──────────────────────────────────
  A     @                   → 192.0.2.1      (3600s)
  A     www                → 192.0.2.1      (3600s)
  CNAME @                   → example.com.   (3600s)
  TXT   @                   → v=spf1 include:_spf.google.com ~all
```

#### dns set

Add a new DNS record.

```bash
# Add A record
opendom dns set example.com A 192.0.2.1

# Add A record with subdomain
opendom dns set example.com A 192.0.2.1 --subdomain www

# Add A record with custom TTL
opendom dns set example.com A 192.0.2.1 --ttl 7200

# Add CNAME record
opendom dns set example.com CNAME example.com. --subdomain @

# Add TXT record
opendom dns set example.com TXT "v=spf1 include:_spf.google.com ~all"

# Add MX record with priority
opendom dns set example.com MX mail.example.com --subdomain @ --priority 10
```

#### dns rm

Remove a DNS record.

```bash
# Remove A record
opendom dns rm example.com A 192.0.2.1

# Remove record with subdomain
opendom dns rm example.com A 192.0.2.1 --subdomain www
```

#### dns update

Update an existing DNS record value.

```bash
# Update A record
opendom dns update example.com A 192.0.2.1 192.0.2.2

# Update with subdomain
opendom dns update example.com A 192.0.2.1 192.0.2.2 --subdomain www
```

#### dns ns

Update domain nameservers.

```bash
# Set two nameservers
opendom dns ns example.com ns1.example.com ns2.example.com

# Set multiple nameservers
opendom dns ns example.com ns1.example.com ns2.example.com ns3.example.com ns4.example.com
```

---

### Account Commands

#### balance

Check account balance and details.

```bash
opendom balance
opendom balance --provider netim
```

Output:
```
  Account Overview
  ─────────────────
  Provider      netim
  Balance       $500.00
  Currency      USD
```

---

## Error Handling

### Exit Codes

- **0**: Success
- **1**: Error (capability not available, authentication failure, rate limit, provider constraint, or other error)

### Error Types

#### CapabilityError

Thrown when a provider doesn't support a command. Example:

```
CapabilityError: buy is not available for this provider. Use provider dashboard.
```

**Handling**: Check the capabilities matrix before calling a command, or catch the error and use an alternative provider.

#### AuthError

Thrown when authentication fails due to invalid credentials.

```
AuthError: Invalid API credentials for cloudflare
```

**Handling**: Re-run login with correct credentials. Check API token permissions.

#### RateLimitError

Thrown when provider rate limit is exceeded.

```
RateLimitError: Too many requests. Retry after 60 seconds.
```

**Handling**: Implement exponential backoff and retry. Check `retryAfterMs` if available.

#### ProviderConstraintError

Thrown when provider-specific constraints are violated.

```
ProviderConstraintError: Domain name exceeds maximum length
```

**Handling**: Fix the constraint violation (e.g., shorten domain name, use allowed TLD).

### Handling Pending Operations

Some operations return `PENDING` status (async operations). Recommended pattern:

```bash
# Pseudo-code for handling pending operations
MAX_ATTEMPTS=5
DELAY_SECONDS=20

attempt=0
while [ $attempt -lt $MAX_ATTEMPTS ]; do
  result=$(opendom buy example.com --yes 2>&1)
  if echo "$result" | grep -q "DONE"; then
    echo "Operation completed"
    break
  elif echo "$result" | grep -q "PENDING"; then
    attempt=$((attempt + 1))
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
      echo "Operation pending... retrying in ${DELAY_SECONDS}s (attempt $attempt/$MAX_ATTEMPTS)"
      sleep $DELAY_SECONDS
    else
      echo "WARNING: Operation still pending after $MAX_ATTEMPTS attempts"
      echo "Please check provider dashboard for status"
      # Alert master/operator
      exit 1
    fi
  else
    echo "Error: $result"
    exit 1
  fi
done
```

**Recommended timing**: Poll every 20-30 seconds, max 5 attempts. If still pending after 5 attempts, warn the operator/master.

---

## Confirmation Bypass

Use `--yes` or `-y` flags to skip interactive confirmations for commands that require user confirmation:

```bash
# Buy without confirmation
opendom buy example.com --yes

# Renew without confirmation
opendom renew example.com --yes
```

---

## Rate Limits per Provider

| Provider    | Rate Limit                        |
|------------|-----------------------------------|
| Namecheap  | 50 req/min, 700 req/hour, 8000 req/day |
| Cloudflare | 1200 req/5 min, 200 req/second  |
| Netim      | 5000 req/day                     |
| Porkbun    | Unknown (implement conservative backoff) |

**Handling**: Implement exponential backoff when rate limited. For Namecheap/Cloudflare, track request counts to stay within limits.

---

## Idempotent Patterns

### search

Always safe and idempotent. Can be called multiple times without side effects.

```bash
# Safe to call repeatedly
opendom search example.com
opendom search example.com
```

### buy

Not idempotent - attempting to buy an already registered domain will fail.

```bash
# Check availability first
opendom search example.com

# Then buy if available
opendom buy example.com --yes
```

If domain is already registered, you'll get an error:
```
example.com is taken. Cannot register.
```

### renew

Generally safe to re-run. Renewal may be idempotent depending on provider - re-running may extend the expiry date or be a no-op.

```bash
# Safe to check first
opendom info example.com

# Then renew
opendom renew example.com --yes
```

### dns set

Safe to re-run. If the record already exists, it may be updated or be a no-op depending on provider.

```bash
# Add record (idempotent)
opendom dns set example.com A 192.0.2.1
```

### dns rm

May fail if record doesn't exist. Check with `dns list` first or handle "not found" error.

```bash
# Check record exists first
opendom dns list example.com

# Then remove (may fail if already removed)
opendom dns rm example.com A 192.0.2.1
```

### info

Always safe - read-only operation.

```bash
# Safe to call repeatedly
opendom info example.com
opendom info example.com
```

---

## Known Limitations per Provider

### Netim
- Full support for all features
- Use `--ote` flag for testing in sandbox environment
- `buy` auto-resolves Owner/Admin/Tech/Billing from account defaults when not provided; use `--owner` to override

### Cloudflare
- Cannot buy domains (use dashboard)
- Cannot renew domains (use dashboard)
- Cannot set nameservers via API (managed by Cloudflare)
- `search` and `set` require registrar scope token (not just zone scope)

### Porkbun
- Cannot renew domains (use dashboard)
- All other features fully supported
- **Important**: Domain-level API Access must be enabled in dashboard before using CLI

### Namecheap
- Full support for all features
- Requires `--sandbox` flag for testing
- Requires valid `--client-ip` for API calls (must be whitelisted in account)
- `set auto-renew` not supported via CLI

---

## Tips for AI Agents

### Version Checking

Always check CLI version before running commands:

```bash
# Check version
opendom --version
# Output: 0.2.2

# Verify minimum version in your agent
VERSION=$(opendom --version)
if [ "$VERSION" \< "0.2.0" ]; then
  echo "Error: Minimum version 0.2.0 required"
  exit 1
fi
```

Current stable version: **0.2.2**

### Provider Selection

1. **Use `--provider` flag** to override the default provider for a specific command:
   ```bash
   opendom buy example.com --provider namecheap
   ```

2. **Set default provider** with `set-default` to avoid repeated `--provider` flags:
   ```bash
   opendom set-default cloudflare
   ```

### Before Purchases

1. **Check balance** before making purchases:
   ```bash
   opendom balance --provider netim
   ```

2. **Search first** to verify domain availability:
   ```bash
   opendom search example --tlds com,io
   ```

3. **Check domain info** before renewals:
   ```bash
   opendom info example.com
   ```

### Error Recovery

1. **Handle capability errors** by trying a different provider:
   ```typescript
   try {
     await provider.buy(domain, options);
   } catch (error) {
     if (error instanceof CapabilityError) {
       // Try different provider
     }
   }
   ```

2. **Implement retry logic** for rate limits:
   ```typescript
   async function withRetry(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error instanceof RateLimitError && error.retryAfterMs) {
           await sleep(error.retryAfterMs);
           continue;
         }
         throw error;
       }
     }
   }
   ```

### Best Practices

1. Always use `--yes` for automated workflows
2. Log all operations for debugging
3. Validate domain availability before purchase attempts
4. Store credentials securely (never log or expose API keys)
5. Use test/sandbox environments when available (Netim OTE, Namecheap sandbox)
