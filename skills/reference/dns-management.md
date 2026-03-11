# DNS Management Examples

Examples for managing DNS records.

## List All DNS Records

View all DNS records for a domain:

```bash
opendom dns list myapp.io
```

Output:
```
  DNS Records for myapp.io
  ──────────────────────────────────
  A       @                   → 192.0.2.1
  CNAME   www                 → @
  MX      @                   → mail.myapp.io     (3600s)
  TXT     @                   → v=spf1 include:_spf.google.com ~all
```

## Add A Record

Create an A record for a domain or subdomain:

```bash
# Add root domain A record
opendom dns set myapp.io A 192.0.2.1

# Add subdomain A record
opendom dns set myapp.io A 192.0.2.1 --subdomain www

# Add with custom TTL (300 seconds)
opendom dns set myapp.io A 192.0.2.1 --subdomain api --ttl 300
```

## Add CNAME Record

Create a CNAME record for subdomain:

```bash
# CNAME for www to root
opendom dns set myapp.io CNAME @

# CNAME for blog to external site
opendom dns set myapp.io CNAME blog.example.com --subdomain blog

# CNAME with shorter TTL
opendom dns set myapp.io CNAME @ --ttl 600
```

## Add MX Record

Set up mail servers:

```bash
# Add MX record (priority 10)
opendom dns set myapp.io MX mail.myapp.io --priority 10

# Add backup MX server
opendom dns set myapp.io MX mail2.myapp.io --priority 20
```

## Add TXT Record

Create TXT records for SPF, DKIM, DMARC:

```bash
# Basic SPF record
opendom dns set myapp.io TXT "v=spf1 include:_spf.google.com ~all"

# DMARC record
opendom dns set myapp.io TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"

# DKIM selector
opendom dns set myapp.io TXT "default._domainkey.v=DKIM1; k=rsa; p=PUBLIC_KEY..."

# Google Workspace SPF
opendom dns set myapp.io TXT "v=spf1 include:_spf.google.com ~all" --subdomain @
```

## Remove DNS Record

Delete an existing record:

```bash
# Remove A record
opendom dns rm myapp.io A 192.0.2.1

# Remove specific subdomain A record
opendom dns rm myapp.io A 192.0.2.1 --subdomain www

# Remove CNAME
opendom dns rm myapp.io CNAME blog.example.com --subdomain blog

# Remove TXT record
opendom dns rm myapp.io TXT "v=spf1 include:_spf.google.com ~all"
```

## Update DNS Record

Change an existing record value:

```bash
# Update A record IP
opendom dns update myapp.io A 192.0.2.1 203.0.113.50

# Update with new TTL
opendom dns update myapp.io A 192.0.2.1 203.0.113.50 --ttl 600 --subdomain www
```

## Change Nameservers

Update the domain's nameservers:

```bash
# Change to Cloudflare nameservers
opendom dns ns myapp.io ns1.cloudflare.com ns2.cloudflare.com

# Change to custom nameservers (3 servers)
opendom dns ns myapp.io ns1.example.com ns2.example.com ns3.example.com

# Change to provider default (use after custom)
opendom dns ns myapp.io ns1.netim.com ns2.netim.com
```

## Bulk Operations Script

```bash
#!/bin/bash
# Script to configure DNS for a new domain

DOMAIN="myapp.io"
IP="192.0.2.1"

# Clear existing and add fresh records
opendom dns set "$DOMAIN" A "$IP"
opendom dns set "$DOMAIN" A "$IP" --subdomain www
opendom dns set "$DOMAIN" CNAME @ --subdomain www
opendom dns set "$DOMAIN" MX mail."$DOMAIN" --priority 10
opendom dns set "$DOMAIN" TXT "v=spf1 include:_spf.google.com ~all"

# Verify
opendom dns list "$DOMAIN"
```

**Notes:**
- TTL defaults to 3600 seconds (1 hour) if not specified
- Some providers may take time to propagate DNS changes
- Use `--subdomain` or `-s` flag for subdomains, default is `@` (root)
- DNS operations are typically fast but may show PENDING status for some providers
