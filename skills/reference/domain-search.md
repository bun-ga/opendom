# Domain Search Examples

Examples for searching domain availability across different providers.

## Search Single Domain

Search for a single domain with default TLDs:

```bash
opendom search myapp
```

Output:
```
  ✔ myapp.io      available
  ✔ myapp.dev     available
  ✘ myapp.com     taken
  ✘ myapp.net     taken
  ✘ myapp.org     taken
  ✘ myapp.co      taken
  ✘ myapp.app     taken

  2 available. Register with: opendom buy <domain> --provider <provider>
```

## Search with Multiple TLDs

Specify custom TLDs to check:

```bash
opendom search myapp --tlds com,net,org,io,dev,ai,co
```

## Search with Price Output

Show pricing information for available domains:

```bash
opendom search myapp --tlds com,io,dev --price
```

Output:
```
  ✘ myapp.com     taken
  ✔ myapp.io      available  $12.00
  ✔ myapp.dev     available  $8.00

  2 available. Register with: opendom buy <domain> --provider <provider>
```

## Search Specific Provider

Search using a specific provider (useful when multiple providers are configured):

```bash
opendom search myapp --tlds com,io --provider netim
opendom search myapp --tlds com,io --provider cloudflare
opendom search myapp --tlds com,io --provider porkbun
opendom search myapp --tlds com,io --provider namecheap
```

## Parse Results Programmatically

Use in scripts to find available domains:

```bash
#!/bin/bash
# Find first available .io domain
DOMAIN=$(opendom search myapp --tlds io,co,dev --price | grep "available" | head -1 | awk '{print $2}')
if [ -n "$DOMAIN" ]; then
  echo "Found: $DOMAIN"
  opendom buy "$DOMAIN" --yes
fi
```

## Idempotent Search

Search is idempotent and safe to run multiple times. Use it to:
- Check domain availability before purchase
- Compare prices across providers
- Monitor domain expiration for renewal decisions

**Note:** Some providers may not expose search functionality. The CLI handles this gracefully and falls back to available information.
