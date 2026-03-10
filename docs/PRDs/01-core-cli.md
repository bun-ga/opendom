# PRD 01: Core CLI Product

## 1. Overview

The **Core CLI Product** provides the foundational command-line interface for domain management across multiple registrar providers. It enables AI agents and developers to programmatically search, purchase, renew, and manage domain names and DNS records through a unified, scriptable terminal interface without the friction of web dashboards, upsells, or popups.

## 2. Target Users

| Segment | Description |
|---------|-------------|
| **Primary** | AI Agents (e.g., OpenClaw, NanoBot, PicoClaw) that need to programmatically register and manage domains as part of autonomous workflows |
| **Secondary** | Individual developers who prefer terminal-based workflows for domain management |

## 3. Product Vision

> **"Domain management from your terminal. No upsells, no popups. Built for AI Agents."**

opendom is designed to be the definitive CLI for domain operations, prioritizing automation, scriptability, and agent usability over marketing-driven UX.

---

## 4. Core Features

### 4.1 Authentication Module

| Feature | Description | Priority |
|---------|-------------|----------|
| Provider Login | Authenticate with Netim, Cloudflare, Porkbun, Namecheap using API keys/tokens | Must Have |
| Credential Storage | Securely store provider credentials (keychain support) | Must Have |
| Logout | Clear credentials for specific provider or all providers | Must Have |
| Multi-Provider Config | Support authenticated sessions with multiple providers simultaneously | Must Have |

### 4.2 Domain Operations Module

| Feature | Description | Priority |
|---------|-------------|----------|
| Domain Search | Check domain availability across TLDs with optional pricing | Must Have |
| Domain Buy | Register new domains with configurable duration, nameservers, owner contact | Must Have |
| Domain List | List all owned domains with expiration dates and auto-renew status | Must Have |
| Domain Info | Get detailed domain information (creation date, expiration, nameservers, WHOIS privacy, registrar lock, auto-renew) | Must Have |
| Domain Renew | Extend domain registration with specified duration | Must Have |
| Domain Preferences | Toggle WHOIS privacy, auto-renew, registrar lock | Should Have |

### 4.3 DNS Management Module

| Feature | Description | Priority |
|---------|-------------|----------|
| DNS List | List all DNS records for a domain | Must Have |
| DNS Set/Add | Add new DNS records (A, AAAA, CNAME, MX, TXT, etc.) with TTL and priority | Must Have |
| DNS Remove | Delete existing DNS records | Must Have |
| DNS Update | Modify existing DNS record values | Should Have |
| Nameserver Update | Change domain nameservers | Must Have |

### 4.4 Account Module

| Feature | Description | Priority |
|---------|-------------|----------|
| Balance Check | Display account balance, currency, thresholds | Could Have |

---

## 5. User Stories

| # | User Story |
|---|------------|
| 1 | As an AI Agent, I want to authenticate with multiple domain providers simultaneously, So that I can compare prices and manage domains across different registrars without re-authenticating |
| 2 | As an AI Agent, I want to search for domain availability with pricing information, So that I can make informed decisions about which domains to register |
| 3 | As a developer, I want to purchase domains programmatically with predefined settings, So that I can automate domain provisioning for my projects |
| 4 | As an AI Agent, I want to manage DNS records (add, remove, update) through CLI commands, So that I can automate DNS configuration as part of deployment workflows |
| 5 | As a developer, I want to view all my domains with their expiration dates and auto-renew status in a single command, So that I can monitor my domain portfolio efficiently |
| 6 | As an AI Agent, I want to renew domains before expiration with a single command, So that I can prevent domain loss due to expiration |
| 7 | As a developer, I want to toggle WHOIS privacy and auto-renew settings via CLI, So that I can manage domain preferences without visiting web dashboards |

---

## 6. Command Surface

### Authentication Commands

```bash
# Login to a provider
opendom login --provider <provider> [provider-specific flags]

# Logout from a specific provider
opendom logout --provider <provider>

# Logout from all providers
opendom logout --all
```

### Domain Operations Commands

```bash
# Search for domain availability
opendom search <name> [--tlds <list>] [--provider <provider>] [--price]

# Purchase a domain
opendom buy <domain> [--yes] [--duration] [--owner <contactId>] [--provider <provider>]

# List all owned domains
opendom domains [--provider <provider>]

# Get domain information
opendom info <domain> [--provider <provider>]

# Renew a domain
opendom renew <domain> [--yes] [--duration] [--provider <provider>]

# Set domain preferences (whois-privacy, auto-renew, registrar-lock)
opendom set <domain> <pref> <on|off> [--provider <provider>]
```

### DNS Management Commands

```bash
# List DNS records
opendom dns list <domain> [--provider <provider>]

# Add a DNS record
opendom dns set <domain> <TYPE> <VALUE> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]

# Remove a DNS record
opendom dns rm <domain> <TYPE> <VALUE> [--subdomain <sub>] [--provider <provider>]

# Update a DNS record
opendom dns update <domain> <TYPE> <OLD> <NEW> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]

# Update nameservers
opendom dns ns <domain> <ns1> <ns2> [ns3...] [--provider <provider>]
```

### Account Commands

```bash
# Check account balance
opendom balance [--provider <provider>]
```

---

## 7. Success Metrics

The Core CLI Product will be considered successful when:

1. **Authentication**: Users can securely authenticate with at least 2 providers (Netim, Cloudflare) and maintain multiple simultaneous sessions
2. **Domain Search**: Domain search returns availability status within 5 seconds across supported TLDs
3. **Domain Purchase**: Complete domain purchase flow works end-to-end with test credentials
4. **DNS Management**: All CRUD operations on DNS records function correctly for A, AAAA, CNAME, MX, TXT record types
5. **Provider Abstraction**: Commands work uniformly across different providers without requiring provider-specific knowledge from users
6. **CLI Usability**: All commands include `--help` documentation and return meaningful error messages
7. **Scriptability**: Commands can be used in scripts and CI/CD pipelines without interactive prompts (except where explicitly required for safety)

---

## 8. Out of Scope

The following features are explicitly **NOT** in scope for this PRD:

- **Domain Transfer**: Transferring domains between registrars
- **Domain Backorder**: Reservation of expiring domains
- **Domain Auction**: Purchasing domains from aftermarket auctions
- **WHOIS Lookup**: Public WHOIS information lookup for non-owned domains
- **SSL Certificate Management**: SSL/TLS certificate provisioning or renewal
- **Email Forwarding**: Email forwarding or catch-all configuration
- **Domain Parking**: Domain parking page configuration
- **Webhook Notifications**: Real-time notifications for domain events
- **Bulk Operations**: Batch processing of multiple domains in a single command
- **Contact Management**: Creating or editing registrant/admin/tech contacts (beyond specifying existing contact IDs)
- **Invoice/Billing History**: Detailed billing reports or invoice generation
- **Private API Endpoints**: Custom or unofficial provider APIs

---

*Last updated: March 2026*
