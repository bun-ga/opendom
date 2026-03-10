# PRD 05: Documentation Platform

## 1. Overview

The **Documentation Platform** provides comprehensive, searchable, and developer-friendly documentation for opendom. It serves as the primary resource for users to get started with the CLI, understand authentication workflows, execute domain operations, and integrate AI agents. The documentation platform is built on Vocs and hosted at `/docs-web`, serving both human users through an interactive web interface and AI agents through machine-readable formats.

---

## 2. Product Vision

> **"Get started in minutes. Complete reference for every command."**

The documentation platform aims to make opendom accessible to users of all experience levels while providing the depth required for advanced automation and AI agent integration.

---

## 3. Current State

The documentation platform is **partially built** using Vocs in `apps/docs-web/`. The current implementation includes:

- **Vocs configuration** in `vocs.config.ts` with initial sidebar structure
- **Partially complete pages**:
  - `getting-started.mdx` - Installation instructions for Homebrew and npm, first login, first command, troubleshooting
  - `authentication.mdx` - Provider-specific login commands, credential verification, logout, troubleshooting
  - `first-commands.mdx` - Initial command examples (under development)
  - `index.mdx` - Landing page
- **Provider notes** in `docs/providers/`:
  - `capabilities.md` - Provider feature comparison
  - `cloudflare-notes.md`, `namecheap-notes.md`, `porkbun-notes.md` - Provider-specific quirks

**Work remaining:**
- Complete all planned documentation sections
- Add provider guides for all four providers
- Build complete command reference
- Implement AI agent documentation
- Add content examples and samples
- Create provider capability comparison table

---

## 4. Documentation Structure

The documentation is organized into five main sections, accessible from the sidebar navigation.

### 4.1 Getting Started

The Getting Started section serves as the entry point for new users, providing all information needed to install and use opendom for the first time.

**Content Requirements:**

| Topic | Description |
|-------|-------------|
| **Installation** | Step-by-step installation instructions for Homebrew (macOS/Linuxbrew), npm, and manual binary download. Include verification commands. |
| **First Login** | Quick authentication guide with the most common provider (Netim). Include provider-specific flags explanation. |
| **First Command** | Walk through executing the first domain search command with explanations of each flag. |
| **Troubleshooting** | Common installation issues, PATH problems, authentication errors, and resolution steps. Include error messages users may encounter. |

**Page Structure:**
```
/getting-started
  ├── Installation
  │   ├── Homebrew
  │   ├── npm
  │   └── Manual binary
  ├── First Login
  ├── First Command
  └── Troubleshooting
```

### 4.2 Authentication

The Authentication section provides detailed coverage of all provider login methods, credential verification, and security best practices.

**Content Requirements:**

| Topic | Description |
|-------|-------------|
| **Provider Login Commands** | Complete, copy-paste ready commands for each provider (Netim, Cloudflare, Porkbun, Namecheap) with all required and optional flags documented. |
| **Credential Verification** | How to confirm authentication is working using `balance` and `domains` commands. Include provider-specific verification approaches. |
| **Security Notes** | Keychain usage for credential storage, environment variable alternatives, security best practices, and credential lifecycle management. |

**Page Structure:**
```
/authentication
  ├── Overview
  ├── Netim Login
  ├── Cloudflare Login
  ├── Porkbun Login
  ├── Namecheap Login
  ├── Verify Authentication
  ├── Logout Commands
  └── Security Notes
```

### 4.3 First Commands

The First Commands section provides a guided journey through the core domain operations, designed as a tutorial for new users.

**Content Requirements:**

| Topic | Description |
|-------|-------------|
| **Search for Domains** | How to use `opendom search` with TLD filters, pricing display, and provider selection. Include output format explanations. |
| **Buy a Domain** | Step-by-step domain purchase with `--yes` flag for non-interactive mode, duration options, and owner contact configuration. |
| **Check Domain Info** | Retrieving detailed domain information including creation date, expiration, nameservers, WHOIS privacy, registrar lock, and auto-renew status. |
| **Configure DNS** | Adding, listing, removing, and updating DNS records (A, AAAA, CNAME, MX, TXT, etc.) with TTL and priority explanations. |

**Page Structure:**
```
/first-commands
  ├── Search for Domains
  ├── Buy a Domain
  ├── Check Domain Info
  └── Configure DNS
```

### 4.4 Provider Guides

The Provider Guides section provides in-depth, provider-specific documentation covering setup, quirks, limitations, and best practices.

**Content Requirements:**

| Provider | Description |
|----------|-------------|
| **Netim** | Reseller ID setup, API secret configuration, OTE vs production environments, rate limiting, TLD availability, quirks with specific operations. |
| **Cloudflare** | API token creation with correct scopes, account ID usage, zone vs registrar operations, DNS vs registrar differences, rate limiting. |
| **Porkbun** | API key and secret generation, endpoint differences, TLD support quirks, sandbox environment usage. |
| **Namecheap** | API user setup, whitelisted IP requirements, sandbox mode, username vs API user distinction, API key management. |

**Page Structure:**
```
/providers
  ├── Netim
  │   ├── Setup
  │   ├── Authentication
  │   ├── Supported TLDs
  │   ├── Rate Limits
  │   └── Quirks & Limitations
  ├── Cloudflare
  │   ├── Setup
  │   ├── Token Scopes
  │   ├── Account vs Zone
  │   ├── Rate Limits
  │   └── Quirks & Limitations
  ├── Porkbun
  │   ├── Setup
  │   ├── API Keys
  │   ├── Sandbox
  │   ├── TLD Support
  │   └── Quirks & Limitations
  └── Namecheap
      ├── Setup
      ├── IP Whitelisting
      ├── Sandbox Mode
      ├── API Users
      └── Quirks & Limitations
```

### 4.5 Reference

The Reference section provides complete technical documentation for every command, flag, output format, and exit code.

**Content Requirements:**

| Topic | Description |
|-------|-------------|
| **Full Command Reference** | Complete listing of all commands organized by category (Auth, Domains, DNS, Account). Each command includes syntax, description, required flags, optional flags, and examples. |
| **Flag Documentation** | All global flags and command-specific flags with types, default values, and usage examples. |
| **Output Formats** | JSON, table, and plain text output formats. Include examples of parsing JSON output programmatically. |
| **Exit Codes** | Complete list of exit codes (0 for success, 1 for general error, specific codes for authentication failures, network errors, validation errors, etc.). |

**Page Structure:**
```
/reference
  ├── Command Reference
  │   ├── Auth Commands
  │   │   ├── login
  │   │   └── logout
  │   ├── Domain Commands
  │   │   ├── search
  │   │   ├── buy
  │   │   ├── list
  │   │   ├── info
  │   │   ├── renew
  │   │   └── preferences
  │   ├── DNS Commands
  │   │   ├── list
  │   │   ├── add
  │   │   ├── remove
  │   │   └── update
  │   └── Account Commands
  │       └── balance
  ├── Flag Reference
  │   ├── Global Flags
  │   └── Command Flags
  ├── Output Formats
  │   ├── JSON
  │   ├── Table
  │   └── Plain Text
  └── Exit Codes
```

---

## 5. Documentation Requirements

The following requirements define the minimum acceptable documentation quality and coverage:

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Installation guides for all platforms | **Must Have** | Complete installation instructions for Homebrew, npm, and manual binary download. Must include verification steps and platform-specific notes. |
| Provider-specific authentication | **Must Have** | Detailed, copy-paste ready login commands for all four providers with all required and optional flags documented. Must include verification steps. |
| Command examples for every operation | **Must Have** | At least one working example for every command in the reference. Examples must be realistic and cover common use cases. |
| Error code reference | **Should Have** | Complete list of exit codes with descriptions of what each error means and potential resolutions. |
| Provider capability comparison | **Should Have** | Matrix showing which features are available for each provider (search, buy, DNS, renew, WHOIS privacy, auto-renew, etc.). |
| AI agent usage examples | **Must Have** | Dedicated section showing how to use opendom in AI agent workflows, including shell command construction, JSON output parsing, error handling, and idempotency patterns. |

---

## 6. AI Agent Documentation

A dedicated section for AI agent integration, recognizing that opendom's primary users are AI agents.

### 6.1 Example Shell Commands

```bash
# Search for available domains
opendom search example --tlds com,io,net --provider netim --json

# Purchase a domain (with confirmation flag for automation)
opendom buy example.com --provider netim --yes --duration 1 --json

# List all domains
opendom domains --provider cloudflare --json

# Get domain info
opendom info example.com --provider porkbun --json

# Add DNS record
opendom dns add example.com --type A --name www --value 192.0.2.1 --ttl 3600 --provider cloudflare --json

# Check account balance
opendom balance --provider netim --json
```

### 6.2 JSON Output Format

All commands support `--json` flag for structured output. Example response:

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "available": true,
    "price": 12.99,
    "currency": "USD",
    "renewalPrice": 14.99
  },
  "provider": "netim",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_ERROR",
    "message": "Invalid API credentials",
    "provider": "cloudflare"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 6.3 Error Handling Patterns

AI agents should implement retry logic with exponential backoff for transient errors:

```bash
# Retry pattern for network errors
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
  result=$(opendom search example.com --provider netim --json)
  if [ $? -eq 0 ]; then
    echo "$result"
    exit 0
  fi
  sleep $((RETRY_DELAY * i))
done

echo "Failed after $MAX_RETRIES attempts" >&2
exit 1
```

Exit codes to handle:
- `0` - Success
- `1` - General error
- `2` - Authentication/credential error
- `3` - Network/connection error
- `4` - Validation error (invalid domain, missing required flag)
- `5` - Provider-specific error (rate limit, TLD not supported)

### 6.4 Idempotency Notes

AI agents should implement idempotent domain operations:

| Operation | Idempotent Strategy |
|-----------|---------------------|
| Domain search | Always idempotent - no state change |
| Domain purchase | Check domain info first; only purchase if not owned |
| DNS add | Check existing records before adding; use record ID for updates |
| DNS remove | Check existence before removal; ignore if not found |
| Domain renew | Check expiration before renewal; skip if sufficient time remaining |

Example idempotent purchase:

```bash
#!/bin/bash
DOMAIN="example.com"
PROVIDER="netim"

# Check if domain already owned
existing=$(opendom info "$DOMAIN" --provider "$PROVIDER" --json 2>/dev/null)
if [ $? -eq 0 ] && echo "$existing" | grep -q '"owned":true'; then
  echo "Domain already owned: $DOMAIN"
  exit 0
fi

# Purchase domain
opendom buy "$DOMAIN" --provider "$PROVIDER" --yes --json
```

---

## 7. Content Examples

### 7.1 Installation Page Example

```markdown
# Installation

Install opendom using your preferred package manager.

## Homebrew (macOS / Linux)

```bash
brew tap bunga/opendom
brew install opendom-cli
```

## npm

```bash
npm install -g @bunga/opendom-cli
```

## Verify Installation

```bash
opendom --version
opendom --help
```

Expected output:

```
opendom v0.3.0

AUTH COMMANDS
  opendom login      Authenticate with a provider
  opendom logout     Remove stored credentials

DOMAIN COMMANDS
  opendom search     Check domain availability
  opendom buy        Purchase a domain
  opendom domains    List owned domains
  ...

Run 'opendom <command> --help' for more information on a command.
```

## Next Steps

- [Authentication](/authentication) - Connect to your domain provider
- [First Commands](/first-commands) - Search and buy your first domain
```

### 7.2 Command Reference Entry Example

```markdown
## opendom search

Check domain availability across TLDs.

### Synopsis

\`\`\`bash
opendom search <name> [flags]
\`\`\`

### Description

The search command checks if a domain name is available for registration. 
You can search across multiple TLDs simultaneously and optionally include 
pricing information.

### Examples

\`\`\`bash
# Search for a domain in common TLDs
opendom search myproject --tlds com,io,net

# Search with pricing information
opendom search example --tlds com,net --price

# Search using a specific provider
opendom search myapp --provider cloudflare --tlds com,io

# JSON output for scripting
opendom search example --tlds com --json
\`\`\`

### Flags

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--tlds` | string | No | - | Comma-separated list of TLDs to search |
| `--provider` | string | No | netim | Provider to use for search |
| `--price` | boolean | No | false | Include pricing information in output |
| `--json` | boolean | No | false | Output in JSON format |

### Output

Plain text output:

```
example.com      available   $12.99/year
example.io       available   $39.00/year
example.net      unavailable
```

JSON output:

\`\`\`json
{
  "success": true,
  "data": {
    "query": "example",
    "results": [
      {"domain": "example.com", "available": true, "price": 12.99, "currency": "USD"},
      {"domain": "example.io", "available": true, "price": 39.00, "currency": "USD"},
      {"domain": "example.net", "available": false}
    ]
  },
  "provider": "netim"
}
\`\`\`

### Exit Codes

- `0` - Search completed successfully
- `1` - General error
- `4` - Invalid domain name or TLD
```

### 7.3 Provider Guide Template

```markdown
# ProviderName

Complete guide to using ProviderName with opendom.

## Overview

[Provider name] is a domain registrar and DNS provider. 
[Key characteristics, strengths, typical use cases].

## Setup

### Prerequisites

- [Requirement 1]
- [Requirement 2]

### Authentication

\`\`\`bash
opendom login --provider providername [flags]
\`\`\`

#### Required Flags

| Flag | Description |
|------|-------------|
| `--flag1` | Description of flag 1 |
| `--flag2` | Description of flag 2 |

#### Optional Flags

| Flag | Description |
|------|-------------|
| `--optional-flag` | Description |

### Verification

\`\`\`bash
opendom balance --provider providername
\`\`\`

## Supported Operations

| Operation | Support | Notes |
|-----------|---------|-------|
| Domain Search | ✅ | Full support |
| Domain Purchase | ✅ | All TLDs |
| Domain List | ✅ | - |
| Domain Info | ✅ | - |
| DNS List | ✅ | - |
| DNS Add | ✅ | - |
| DNS Remove | ✅ | - |

## Rate Limits

[Provider-specific rate limit information]

## Quirks & Limitations

- [Limitation 1]
- [Limitation 2]

## Troubleshooting

### Common Issues

**Issue: Error message**

Solution: How to resolve

## Next Steps

- [First Commands](/first-commands) - Try your first domain operations
- [Reference](/reference) - Full command documentation
```

---

## 8. Success Metrics

The documentation platform will be considered successful when the following metrics are met:

| Metric | Target | Measurement |
|--------|--------|--------------|
| **Installation Success Rate** | >95% | Users can install and verify installation without assistance |
| **First Command Success Rate** | >90% | Users can execute their first domain search within 10 minutes of starting |
| **Authentication Success Rate** | >90% | Users can authenticate with at least one provider on first attempt |
| **Search/Buy Completion** | >80% | Users can complete search-to-buy workflow without external help |
| **AI Agent Integration Success** | >95% | AI agents can successfully use JSON output and error handling patterns |
| **Documentation Coverage** | 100% | All commands, flags, and providers documented |
| **Provider Guide Completeness** | 100% | All four providers have complete setup, quirks, and troubleshooting sections |
| **Feedback Response Time** | <24h | User-reported issues addressed within 24 hours |

---

## 9. Future Enhancements

The following enhancements are planned for future iterations:

### 9.1 Video Tutorials

- Short (<2 min) embedded videos for key workflows
- Installation walkthrough for each platform
- First purchase tutorial
- AI agent integration example

### 9.2 Interactive Examples

- In-browser CLI playground (using WebAssembly or embedded terminal)
- Interactive examples that users can run directly from the docs
- Provider selection wizard

### 9.3 API Reference Generation

- Auto-generate reference documentation from source code comments
- Keep command reference in sync with CLI implementation
- Include TypeScript type definitions in reference

### 9.4 Additional Enhancements

- **Provider status dashboard** - Real-time status for each provider's API
- **Changelog auto-generation** - Keep release notes up-to-date
- **Search functionality** - Full-text search across documentation
- **Dark/light mode** - Theme toggle for user preference
- **Multi-language support** - Translations for common languages
- **PDF export** - Downloadable offline documentation
- **Versioned docs** - Historical documentation for previous versions
