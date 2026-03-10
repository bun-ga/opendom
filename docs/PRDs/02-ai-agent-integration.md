# PRD 02: AI Agent Integration

## 1. Overview

The **AI Agent Integration** feature transforms opendom into a domain management tool that AI agents can use autonomously. While the Core CLI provides the foundational domain operations, this PRD focuses on the specific requirements that make opendom executable, parseable, and reliable from AI agent workflows—including shell-executability, structured output formats, idempotency guarantees, and dry-run capabilities.

## 2. Target Users

| Segment | Description |
|---------|-------------|
| **Primary** | AI Agents (OpenClaw, NanoBot, PicoClaw) that autonomously manage domains as part of larger automation workflows |
| **Secondary** | Individual developers who prefer terminal-based, scriptable domain management |

## 3. Product Vision

> **"The domain management tool that AI agents can actually use autonomously."**

opendom provides a CLI-first interface designed specifically for AI agent consumption—eliminating the friction of human-oriented dashboards filled with upsells, popups, and non-parseable interfaces.

---

## 4. Why This Matters

AI agents need to manage domains as part of autonomous workflows (deploying websites, provisioning infrastructure, managing domain portfolios). However, existing domain management solutions present critical barriers:

| Problem | Impact on AI Agents |
|---------|---------------------|
| **Human-oriented dashboards** | Not executable from CLI; require browser automation |
| **Upsells and popups** | Break automated flows; require interaction handling |
| **Non-parseable output** | Cannot extract domain status, pricing, or operation results programmatically |
| **Interactive prompts** | Block autonomous execution; require human intervention |
| **Slow API responses** | Timeout agent workflows; no progress tracking for async operations |

opendom solves these by providing a CLI-first interface that works seamlessly in shell scripts, CI/CD pipelines, and autonomous agent loops.

---

## 5. Key Requirements for AI Agents

### 5.1 Shell-Executability

Every command must work via shell execution without interactive prompts.

| Requirement | Implementation |
|-------------|----------------|
| **Non-interactive execution** | All inputs provided via flags; no stdin prompts |
| **Flag-based confirmation** | `--yes` or `-y` flags for destructive operations (buy, renew, delete) |
| **Provider specification** | `--provider <name>` flag (mandatory) for all operations |
| **Exit codes** | Consistent `0` for success, `1` for errors |

**Example:**
```bash
opendom buy example.com --yes --provider cloudflare
# No interactive prompts; completes or fails based on API response
```

### 5.2 Structured Output

Commands must support both human-readable and machine-parseable output formats.

| Output Mode | Flag | Use Case |
|-------------|------|----------|
| **Tabular** | Default | Debugging, manual inspection |
| **JSON** | `--json` | Agent processing, script parsing |

**Requirements:**
- JSON output must be valid, parseable JSON
- All providers return consistent JSON schema for equivalent operations
- Human-readable output uses aligned columns for readability

**Example - Tabular Output:**
```bash
$ opendom domains --provider cloudflare
+------------------+-------------+---------------+-------------+
| Domain           | Expires     | Auto-Renew    | Registrar   |
+------------------+-------------+---------------+-------------+
| example.com      | 2026-03-15 | true          | Cloudflare  |
| test.io          | 2026-05-20 | false         | Cloudflare  |
+------------------+-------------+---------------+-------------+
```

**Example - JSON Output:**
```bash
$ opendom domains --provider cloudflare --json
{
  "success": true,
  "data": [
    {
      "domain": "example.com",
      "expires": "2026-03-15T00:00:00Z",
      "autoRenew": true,
      "registrar": "Cloudflare"
    },
    {
      "domain": "test.io",
      "expires": "2026-05-20T00:00:00Z",
      "autoRenew": false,
      "registrar": "Cloudflare"
    }
  ]
}
```

### 5.3 Idempotency

Commands must be safely re-runnable without side effects.

| Requirement | Implementation |
|-------------|----------------|
| **Safe retries** | Operations can be re-run without creating duplicates or changing state incorrectly |
| **Clear error messages** | Distinguish between "already exists" and "failed to create" |
| **Operation IDs** | Return tracking IDs for async operations (purchases, transfers) |
| **State detection** | Report current state when operation is unnecessary |

**Example:**
```bash
# Domain already owned - idempotent response
$ opendom buy example.com --yes --provider cloudflare
{
  "success": false,
  "error": "domain_already_owned",
  "message": "Domain example.com is already registered to this account",
  "domain": "example.com"
}

# DNS record already exists - idempotent response
$ opendom dns set example.com A 1.2.3.4 --provider cloudflare
{
  "success": false,
  "error": "record_exists",
  "message": "Record A -> 1.2.3.4 already exists for example.com",
  "record": {
    "type": "A",
    "name": "example.com",
    "value": "1.2.3.4"
  }
}
```

### 5.4 Dry-Run Mode

Preview what an operation would do without executing it.

| Flag | Behavior |
|------|----------|
| `--dry-run` | Simulate operation; return expected outcome without making API changes |

**Examples:**
```bash
# Preview domain purchase
$ opendom buy example.com --dry-run --provider porkbun
{
  "success": true,
  "dryRun": true,
  "operation": "domain_purchase",
  "domain": "example.com",
  "estimatedCost": {
    "amount": 12.00,
    "currency": "USD",
    "duration": 1
  },
  "wouldExecute": [
    "Check domain availability",
    "Charge account $12.00",
    "Register domain for 1 year",
    "Set nameservers to default"
  ]
}

# Preview DNS change
$ opendom dns set example.com A 1.2.3.4 --dry-run --provider cloudflare
{
  "success": true,
  "dryRun": true,
  "operation": "dns_record_create",
  "record": {
    "type": "A",
    "name": "example.com",
    "value": "1.2.3.4",
    "ttl": 3600
  },
  "wouldExecute": [
    "Create A record: example.com -> 1.2.3.4",
    "Set TTL to 3600 seconds"
  ]
}
```

---

## 6. AI Agent Workflows

### Workflow 1: Deploy Website

Autonomous domain purchase and DNS setup for a new project.

```bash
# Step 1: Search for available domains
opendom search myproject --tlds com,io --provider porkbun
# Output: JSON with availability and pricing for each TLD

# Step 2: Purchase the preferred domain
opendom buy myproject.io --yes --duration 1 --provider porkbun
# Output: JSON with purchase confirmation and operation ID

# Step 3: Configure DNS A record
opendom dns set myproject.io A 203.0.113.4 --provider porkbun
# Output: JSON with DNS record creation confirmation

# Step 4: Verify domain info
opendom info myproject.io --provider porkbun
# Output: JSON with domain details, nameservers, expiration
```

### Workflow 2: Domain Portfolio Management

Monitor and maintain existing domain holdings.

```bash
# Step 1: List all owned domains
opendom domains --provider cloudflare
# Output: JSON array of all domains with expiration dates

# Step 2: Get detailed info for specific domain
opendom info example.com --provider cloudflare
# Output: JSON with full domain details

# Step 3: Renew domain before expiration
opendom renew example.com --duration 2 --yes --provider cloudflare
# Output: JSON with renewal confirmation and new expiration date
```

### Workflow 3: DNS Configuration Sync

Replicate DNS configuration across providers or backup records.

```bash
# Step 1: Export current DNS records
opendom dns list example.com --provider cloudflare --json > dns-backup.json

# Step 2: Apply to new domain
opendom dns set newdomain.com A $(jq -r '.data[] | select(.type=="A") | .value' dns-backup.json) --provider cloudflare

# Step 3: Verify configuration
opendom dns list newdomain.com --provider cloudflare --json
```

---

## 7. Technical Requirements

### 7.1 Exit Code Specification

| Exit Code | Meaning |
|-----------|---------|
| `0` | Success - operation completed as expected |
| `1` | Error - operation failed (invalid input, API error, network failure) |

### 7.2 Required CLI Flags

| Flag | Description | Required |
|------|-------------|----------|
| `--provider` | Specify provider (cloudflare, porkbun, netim, namecheap) | Yes - all commands |
| `--json` | Output in JSON format instead of tabular | No |
| `--dry-run` | Preview operation without executing | No |
| `--yes`, `-y` | Confirm destructive operations | For buy, renew, delete |

### 7.3 JSON Response Schema

All JSON responses follow consistent schema:

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  dryRun?: boolean;
  operationId?: string;
}

// Error response
interface ErrorResponse {
  success: false;
  error: string;        // Machine-readable error code
  message: string;     // Human-readable message
  details?: Record<string, unknown>;
}

// Domain info response
interface DomainInfo {
  domain: string;
  registrar: string;
  created: string;      // ISO 8601
  expires: string;      // ISO 8601
  autoRenew: boolean;
  nameservers: string[];
  whoisPrivacy: boolean;
  registrarLock: boolean;
}

// DNS record response
interface DnsRecord {
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}
```

### 7.4 Provider Abstraction

All supported providers must implement identical command interfaces:

| Command | Cloudflare | Porkbun | Netim | Namecheap |
|---------|------------|---------|-------|-----------|
| `search` | ✓ | ✓ | ✓ | ✓ |
| `buy` | ✓ | ✓ | ✓ | ✓ |
| `domains` | ✓ | ✓ | ✓ | ✓ |
| `info` | ✓ | ✓ | ✓ | ✓ |
| `renew` | ✓ | ✓ | ✓ | ✓ |
| `dns list` | ✓ | ✓ | ✓ | ✓ |
| `dns set` | ✓ | ✓ | ✓ | ✓ |
| `dns rm` | ✓ | ✓ | ✓ | ✓ |

---

## 8. Success Metrics

The AI Agent Integration will be considered successful when:

| Metric | Target |
|--------|--------|
| **Shell executability** | 100% of commands complete without interactive prompts |
| **JSON output validity** | All `--json` responses are valid, parseable JSON |
| **Idempotency** | All commands safely re-run without duplicate resources or errors |
| **Dry-run accuracy** | Dry-run output matches actual operation within 100% |
| **Exit code accuracy** | Exit code correctly reflects success/failure state |
| **Provider consistency** | Identical command syntax works across all supported providers |
| **Agent workflow success** | Complete workflows (buy → DNS → verify) execute autonomously |

---

## 9. Future Enhancements

### 9.1 HTTP API Server

Expose CLI functionality via REST API for remote agent execution:

```bash
# Start API server
opendom serve --port 3000

# HTTP requests
curl -X POST http://localhost:3000/domains/buy \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "provider": "cloudflare"}'
```

### 9.2 Python Bindings

Native Python library for direct import in Python-based agents:

```python
import opendom

client = opendom.Client(provider="cloudflare")
domains = client.domains.list()
client.domains.buy("newproject.io", duration=1)
client.dns.set("newproject.io", "A", "203.0.113.1")
```

### 9.3 Webhook Notifications

Async operation completion via webhooks:

```bash
opendom buy example.com --provider cloudflare \
  --webhook https://agent.example.com/hooks/domain-purchased
```

### 9.4 Batch Operations

Process multiple domains in single command:

```bash
opendom batch buy --domains domains.txt --provider cloudflare --yes
```

---

## 10. Out of Scope

The following are explicitly **NOT** in scope for this PRD:

- Graphical user interface (GUI)
- Browser-based dashboard
- Interactive configuration wizards
- Provider-specific advanced features not abstracted
- Real-time streaming output
- Multi-step transaction wizards

---

*Last updated: March 2026*
