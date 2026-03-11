# Account Management Examples

Examples for account operations and error handling.

## Check Balance

View account balance and details:

```bash
# Check balance with default provider
opendom balance

# Check balance with specific provider
opendom balance --provider netim
opendom balance --provider cloudflare
opendom balance --provider porkbun
opendom balance --provider namecheap
```

Output:
```
  Account Overview
  ─────────────────
  Provider          netim
  Balance           $500.00
  Currency          USD
  Report threshold  $20.00
  Block threshold   $10.00
  Domain auto-renew ON
```

## Handle Authentication Errors

```bash
#!/bin/bash
# Robust script with auth error handling

PROVIDER="netim"

# Function to check auth
check_auth() {
  opendom balance --provider "$PROVIDER" 2>&1
}

# Check auth status
if ! check_auth; then
  echo "Authentication failed or expired"
  echo "Please login:"
  opendom login "$PROVIDER"
  
  # Verify login worked
  if ! check_auth; then
    echo "Login failed. Check credentials."
    exit 1
  fi
fi

echo "Authenticated and ready"
```

## Rate Limit Handling

```bash
#!/bin/bash
# Handle rate limits with retry logic

MAX_RETRIES=3
RETRY_DELAY=5

retry_command() {
  local cmd="$*"
  local attempt=1
  
  while [ $attempt -le $MAX_RETRIES ]; do
    echo "Attempt $attempt of $MAX_RETRIES..."
    
    if output=$($cmd 2>&1); then
      echo "$output"
      return 0
    fi
    
    # Check for rate limit error
    if echo "$output" | grep -qi "rate.*limit\|too.*many\|429"; then
      echo "Rate limited. Waiting ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
      attempt=$((attempt + 1))
      RETRY_DELAY=$((RETRY_DELAY * 2))  # Exponential backoff
    else
      # Non-rate-limit error, fail immediately
      echo "Error: $output"
      return 1
    fi
  done
  
  echo "Max retries reached"
  return 1
}

# Usage
retry_command opendom search myapp --provider netim
retry_command opendom dns list myapp.io --provider cloudflare
```

## Session Management

```bash
#!/bin/bash
# Check which providers are authenticated

for provider in netim cloudflare porkbun namecheap; do
  if opendom balance --provider "$provider" >/dev/null 2>&1; then
    echo "$provider: authenticated"
  else
    echo "$provider: not authenticated"
  fi
done
```

## Script: Pre-flight Check

```bash
#!/bin/bash
# Pre-flight check before running domain operations

PROVIDER="${PROVIDER:-netim}"
DOMAIN="${DOMAIN:-myapp.io}"

echo "=== Pre-flight Check ==="
echo "Provider: $PROVIDER"
echo "Domain: $DOMAIN"
echo

# Check auth
echo -n "Auth: "
if opendom balance --provider "$PROVIDER" >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED - Run: opendom login $PROVIDER"
  exit 1
fi

# Check domain exists
echo -n "Domain: "
if opendom info "$DOMAIN" --provider "$PROVIDER" >/dev/null 2>&1; then
  echo "OK"
else
  echo "NOT FOUND"
  exit 1
fi

# Check auto-renew
echo -n "Auto-renew: "
if opendom info "$DOMAIN" --provider "$PROVIDER" | grep -q "Auto-Renew.*ON"; then
  echo "ON"
else
  echo "OFF (consider enabling)"
fi

echo "=== Ready ==="
```

## Account Summary Script

```bash
#!/bin/bash
# Get summary of all accounts

echo "=== Account Summary ==="
echo

for provider in netim cloudflare porkbun namecheap; do
  echo "--- $provider ---"
  if opendom balance --provider "$provider" 2>/dev/null; then
    echo
    echo "Domains:"
    opendom domains --provider "$provider" 2>/dev/null | grep "^  •" || echo "  None"
  else
    echo "  Not authenticated"
  fi
  echo
done
```

## Error Code Handling

```bash
#!/bin/bash
# Parse specific error codes

opendom buy myapp.io --yes --provider netim 2>&1
RESULT=$?

case $RESULT in
  0)
    echo "Success"
    ;;
  1)
    echo "General error or domain taken"
    ;;
  *)
    echo "Unexpected exit code: $RESULT"
    ;;
esac
```

**Notes:**
- Balance may not be available for all providers (some use credit systems)
- Rate limits vary by provider and endpoint
- Always handle auth errors gracefully in scripts
- Use environment variables for provider selection in automation
- Some operations may return PENDING status requiring polling for completion
