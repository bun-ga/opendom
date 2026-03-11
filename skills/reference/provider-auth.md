# Provider Authentication Examples

Examples for logging in and managing provider credentials.

## Login to Each Provider

### Netim

```bash
# Interactive login (will prompt for credentials)
opendom login netim

# Non-interactive with flags
opendom login netim --id YOUR_RESELLER_ID --secret YOUR_API_SECRET

# Connect to OT&E (test environment)
opendom login netim --id YOUR_RESELLER_ID --secret YOUR_API_SECRET --ote
```

### Cloudflare

```bash
# Interactive login
opendom login cloudflare

# Non-interactive with API token
opendom login cloudflare --token YOUR_API_TOKEN

# With account ID (if using account-scoped token)
opendom login cloudflare --token YOUR_API_TOKEN --account-id YOUR_ACCOUNT_ID
```

### Porkbun

```bash
# Interactive login
opendom login porkbun

# Non-interactive with API keys
opendom login porkbun --apikey YOUR_API_KEY --secretapikey YOUR_SECRET_API_KEY
```

### Namecheap

```bash
# Interactive login
opendom login namecheap

# Non-interactive with credentials
opendom login namecheap \
  --api-user your_api_username \
  --username your_account_username \
  --api-key YOUR_API_KEY \
  --client-ip your_ip_address

# Sandbox/Test environment
opendom login namecheap \
  --api-user your_api_username \
  --username your_account_username \
  --api-key YOUR_API_KEY \
  --client-ip your_ip_address \
  --sandbox
```

## Check Current Auth Status

After login, verify authentication and view account info:

```bash
# Check balance (also validates auth)
opendom balance

# View account details
opendom balance --provider netim
opendom balance --provider cloudflare
```

Output:
```
  Account Overview
  ─────────────────
  Provider          netim
  Balance           $500.00
  Currency          USD
  Domain auto-renew ON
```

## Logout from Provider

```bash
# Logout from specific provider
opendom logout --provider netim
opendom logout --provider cloudflare
opendom logout --provider porkbun
opendom logout --provider namecheap

# Logout from all providers
opendom logout --all
```

## Set Default Provider

Set a preferred provider to avoid specifying `--provider` each time:

```bash
opendom set-default netim
opendom set-default cloudflare
opendom set-default porkbun
opendom set-default namecheap
```

Output:
```
  ✓ Default provider set to netim.
```

## Switch Between Providers

```bash
# Use specific provider for a command (overrides default)
opendom search myapp --provider cloudflare
opendom buy myapp.io --provider porkbun
opendom dns list myapp.io --provider netim
opendom balance --provider namecheap

# Temporarily override default in script
PROVIDER=cloudflare opendom search myapp --provider $PROVIDER
```

## Credential Storage

Credentials are stored in `~/.config/opendom/config.json`. The CLI attempts to encrypt credentials when possible.

```bash
# View config location (shown after login)
# Config saved to /home/user/.config/opendom/config.json
```

## Interactive Login Flow

When running without flags, the CLI prompts for required credentials:

```bash
$ opendom login netim
Reseller ID: YOUR_RESELLER_ID
API Secret: [hidden input]
Validating netim credentials...
✓ netim authenticated successfully.
```

## Error Handling

```bash
#!/bin/bash
# Check auth before running commands

opendom balance --provider netim 2>&1 && {
  echo "Authenticated successfully"
} || {
  echo "Authentication failed, please login:"
  opendom login netim
}
```

**Notes:**
- Provider credentials are saved locally and persist across sessions
- Use OT&E/sandbox environments for testing before production
- Some providers require IP whitelisting for API access
- Clear credentials with `logout` when switching accounts
- Default provider can be overridden per-command with `--provider`
