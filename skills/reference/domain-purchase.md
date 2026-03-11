# Domain Purchase Examples

Examples for purchasing and registering domains.

## Full Purchase Flow (Search Then Buy)

Search first, then purchase the available domain:

```bash
# Step 1: Search for availability
opendom search myapp --tlds io,dev --price

# Step 2: Purchase available domain (adds --yes to skip confirmation)
opendom buy myapp.io --yes
```

Output:
```
  Registration Summary
  ────────────────────
  Provider          netim
  Domain            myapp.io
  Duration          1 year(s)

  ✓ myapp.io is now registered on netim.
```

## Purchase with Custom Nameservers

Specify custom nameservers at purchase time:

```bash
opendom buy myapp.io --yes \
  --ns1 ns1.cloudflare.com \
  --ns2 ns2.cloudflare.com
```

## Purchase with Duration

Register for multiple years:

```bash
# Register for 2 years
opendom buy myapp.io --yes --duration 2

# Register for 5 years
opendom buy myapp.io --yes --duration 5
```

## Purchase with Owner Contact

Associate a contact ID (requires contact to be pre-created in provider account):

```bash
opendom buy myapp.io --yes --owner CONTACT_ID
```

## Idempotent Purchase Pattern

Always check availability first to avoid errors:

```bash
#!/bin/bash
DOMAIN="myapp.io"
PROVIDER="netim"

# Check availability first
RESULT=$(opendom search "$DOMAIN" --provider "$PROVIDER")
if echo "$RESULT" | grep -q "available"; then
  echo "Domain available, purchasing..."
  opendom buy "$DOMAIN" --yes --provider "$PROVIDER"
else
  echo "Domain not available"
  exit 1
fi
```

## Handling "Domain Taken" Errors

The CLI automatically checks availability before purchase, but handle errors gracefully:

```bash
#!/bin/bash
DOMAIN="myapp.io"
PROVIDER="netim"

opendom buy "$DOMAIN" --yes --provider "$PROVIDER" 2>&1 && {
  echo "Purchase successful"
} || {
  ERROR=$?
  if echo "$ERROR" | grep -qi "taken\|unavailable"; then
    echo "Domain already taken, trying alternative TLDs..."
    for TLD in dev co io app; do
      opendom buy "myapp.$TLD" --yes --provider "$PROVIDER" && exit 0
    done
  fi
  exit $ERROR
}
```

## Verify Purchase

After purchase, verify the domain is in your account:

```bash
# List all domains
opendom domains

# Get detailed info
opendom info myapp.io
```

## Auto-Renew at Purchase

Enable auto-renew during or after purchase:

```bash
# After purchase, enable auto-renew
opendom set myapp.io auto-renew on
```

**Notes:**
- `--yes` / `-y` skips the confirmation prompt (useful for scripts)
- The CLI validates availability before attempting purchase
- Some providers may return PENDING status for async operations
- Purchase duration affects the initial registration term, not renewal behavior
