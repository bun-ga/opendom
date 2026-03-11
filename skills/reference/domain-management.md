# Domain Management Examples

Examples for managing domain lifecycle and settings.

## List All Domains

View all domains in your account:

```bash
opendom domains
```

Output:
```
  Your Domains (5)
  ──────────────────────────
  • myapp.io           expires 2026-03-15 [auto-renew]
  • myapp.dev          expires 2025-11-20
  • example.com        expires 2026-01-10 [auto-renew]
  • test.org           expires 2025-08-05
  • sandbox.co         expires 2026-04-22

  (5 domains)
```

## Get Domain Info

Retrieve detailed information about a specific domain:

```bash
opendom info myapp.io
```

Output:
```
  myapp.io
  ──────────────────────────
  Provider          netim
  Status            ok
  Created           2024-03-15
  Expires           2026-03-15
  NS1               ns1.cloudflare.com
  NS2               ns2.cloudflare.com
  Owner             OWNER123
  Whois Privacy     ON
  Auto-Renew        ON
  Registrar Lock    ON
```

## Enable/Disable Auto-Renew

Manage automatic domain renewal:

```bash
# Enable auto-renew
opendom set myapp.io auto-renew on

# Disable auto-renew
opendom set myapp.io auto-renew off

# Short form
opendom set myapp.io autorenew on
```

Output:
```
  ✓ auto-renew is now ON for myapp.io
```

## Enable/Disable WHOIS Privacy

Manage domain privacy protection:

```bash
# Enable WHOIS privacy
opendom set myapp.io privacy on
opendom set myapp.io whois-privacy on

# Disable WHOIS privacy
opendom set myapp.io privacy off
opendom set myapp.io whois-privacy off
```

Output:
```
  ✓ whois-privacy is now ON for myapp.io
```

## Enable/Disable Registrar Lock

Manage registrar lock (transfer lock) for security:

```bash
# Enable registrar lock
opendom set myapp.io lock on
opendom set myapp.io registrar-lock on

# Disable registrar lock (required before transferring)
opendom set myapp.io lock off
opendom set myapp.io registrar-lock off
```

Output:
```
  ✓ lock is now ON for myapp.io
```

**Note:** Always disable lock before initiating a domain transfer.

## Renew Domain

Renew domain registration:

```bash
# Renew for 1 year (default)
opendom renew myapp.io --yes

# Renew for multiple years
opendom renew myapp.io --yes --duration 2
opendom renew myapp.io --yes --duration 5
```

Output:
```
  Registration Summary
  ────────────────────
  Provider          netim
  Domain            myapp.io
  Duration          1 year(s)

  Confirm registration? [y/N] y
  ✓ myapp.io renewed for 1 year(s)!
```

## Bulk Operations Script

```bash
#!/bin/bash
# Enable auto-renew and privacy on all domains

for domain in $(opendom domains | grep "^  •" | awk '{print $2}'); do
  echo "Configuring $domain..."
  opendom set "$domain" auto-renew on
  opendom set "$domain" privacy on
  opendom set "$domain" lock on
done
```

## Check Expiring Domains

```bash
#!/bin/bash
# Find domains expiring within 30 days

opendom domains | grep -E "expires.*[0-9]{4}-[0-9]{2}-[0-9]{2}" | while read line; do
  DOMAIN=$(echo "$line" | awk '{print $2}')
  DATE=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  # Check if expiring within 30 days (compare dates)
  echo "Domain: $DOMAIN expires: $DATE"
done
```

**Notes:**
- Auto-renew prevents accidental expiration
- WHOIS privacy hides personal information in public records
- Registrar lock prevents unauthorized transfers
- Renewal extends the expiration date from current expiry
- Some providers may return PENDING status for async operations
- Domain settings may take time to propagate across all registry systems
