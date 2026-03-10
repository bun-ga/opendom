# PRD 04: Safety & Reliability

## 1. Overview

The **Safety & Reliability** module ensures that all domain operations executed through opendom are safe, predictable, and protected against accidental modifications. This module establishes trust between AI agents and domain operations by implementing guardrails that prevent unintended spending, accidental domain modifications, and unreliable execution patterns.

## 2. Product Vision

> **"AI agents should never accidentally spend money or modify domains without explicit intent."**

Every operation that involves financial transactions, domain modifications, or critical changes requires deliberate, explicit confirmation. The safety system treats the CLI as a high-stakes environment where mistakes have real-world consequences.

## 3. Safety Philosophy

The safety philosophy is built on three core principles:

| Principle | Description |
|-----------|-------------|
| **Explicit Over Implicit** | No operation should execute without clear user intent expressed through flags, confirmations, or deliberate actions |
| **Preview Before Action** | Every destructive or financial operation must show exactly what will happen before execution |
| **Fail Safely** | When in doubt, the CLI should error on the side of caution rather than proceeding silently |

### Design Rationale

AI agents operate with high autonomy but lack human intuition for detecting potential mistakes. By requiring explicit confirmation flags and providing dry-run capabilities, opendom ensures that:

1. **Financial safety**: No domain purchases or renewals happen accidentally
2. **Operational safety**: DNS changes can be previewed before applying
3. **Reliability**: Operations complete successfully or fail with clear, actionable errors

---

## 4. Safety Features

### 4.1 Dry-Run Mode

**Description**: All operations support a `--dry-run` flag that simulates the operation without making any changes. This allows AI agents and developers to verify the exact API calls that would be made and the expected outcomes.

**Implementation Details**:

- Dry-run mode makes read-only API calls where possible (e.g., availability checks)
- For write operations, the CLI constructs the request payload but does not send it
- Output includes all parameters that would be used in the actual operation
- Exit code 0 indicates the operation would succeed; non-zero indicates it would fail

**Example Commands**:

```bash
# Preview domain purchase without executing
opendom buy example.com --dry-run
opendom buy example.com --duration 2 --dry-run
opendom buy example.com --provider porkbun --dry-run

# Preview domain renewal without executing
opendom renew example.com --dry-run
opendom renew example.com --duration 1 --dry-run

# Preview DNS changes without executing
opendom dns set example.com A 1.2.3.4 --dry-run
opendom dns rm example.com A 1.2.3.4 --dry-run
opendom dns update example.com A old-ip new-ip --dry-run

# Preview nameserver changes
opendom dns ns example.com ns1.cloudflare.com ns2.cloudflare.com --dry-run
```

**Expected Dry-Run Output**:

```bash
$ opendom buy myproject.io --provider porkbun --dry-run

  Dry Run - No Changes Will Be Made
  ─────────────────────────────────
  Operation:  Domain Registration
  Provider:   porkbun
  Domain:     myproject.io
  Duration:   1 year(s)
  Price:      $12.00 USD
  Nameservers: cloudflare/ns1.cloudflare.com, cloudflare/ns2.cloudflare.com

  This was a dry-run. Run without --dry-run to execute.
```

---

### 4.2 Explicit Confirmation Required

**Description**: All purchases and renewals require explicit confirmation via `--yes` or `-y` flags. There are no silent auto-renewals without explicit CLI invocation.

**Flag Requirements**:

| Operation | Required Flags | Example |
|-----------|---------------|---------|
| Domain Purchase | `--yes` or `-y` | `opendom buy example.com --yes` |
| Domain Renewal | `--yes` or `-y` | `opendom renew example.com --yes` |
| DNS Modification | `--yes` or `-y` | `opendom dns set example.com A 1.2.3.4 --yes` |
| Nameserver Change | `--yes` or `-y` | `opendom dns ns example.com ns1.com ns2.com --yes` |

**Behavior Without Confirmation Flag**:

```bash
$ opendom buy example.com
Error: Purchase requires explicit confirmation.
Add --yes or -y flag to confirm: opendom buy example.com --yes

$ opendom renew example.com
Error: Renewal requires explicit confirmation.
Add --yes or -y flag to confirm: opendom renew example.com --yes
```

**Auto-Renew Policy**:

- Auto-renew is a provider-level setting, not a CLI default
- Users must explicitly enable auto-renew through provider APIs
- The CLI never automatically renews domains without user invocation
- Renewal commands must be run explicitly each time

---

### 4.3 Operation Preview

**Description**: Before any financial or destructive operation, the CLI displays a detailed summary showing exactly what will happen. This serves as a final checkpoint before execution.

**Preview Output Format**:

```
  Registration Summary
  ────────────────────
  Provider:    porkbun
  Domain:      myproject.io
  Duration:    1 year(s)
  Price:       $12.00 USD/year
  Auto-Renew:  Off

  Nameservers
  ───────────
  • ns1.cloudflare.com
  • ns2.cloudflare.com

  Confirm? (y/N):
```

**Renewal Preview**:

```
  Renewal Summary
  ───────────────
  Provider:    porkbun
  Domain:      myproject.io
  Current Exp: 2025-06-15
  New Exp:     2026-06-15
  Duration:    1 year(s)
  Price:       $12.00 USD

  Confirm? (y/N):
```

**DNS Change Preview**:

```
  DNS Update Summary
  ──────────────────
  Domain:    example.com
  Provider:  cloudflare

  Changes
  ───────
  + A    @        1.2.3.4        TTL: 3600
  + TXT  @        "v=spf1 include:_spf.google.com ~all"  TTL: 3600

  Confirm? (y/N):
```

**Confirmation Flow**:

1. User runs command with `--yes` flag
2. CLI displays operation preview with all details
3. If user did NOT include `--yes`, CLI prompts interactively: `Confirm? (y/N):`
4. Interactive prompt times out after 60 seconds (configurable)
5. Timeout or "N" response aborts the operation

---

### 4.4 Error Handling

**Description**: Clear, actionable error messages help users understand what went wrong and how to fix it. All errors include suggested actions where applicable.

**Error Message Components**:

| Component | Description |
|-----------|-------------|
| Error Code | Unique code for programmatic handling (e.g., `ERR_AUTH_FAILED`) |
| Message | Human-readable description of the error |
| Suggestion | Actionable fix recommendation |
| Operation ID | UUID for async operations to track status |
| Provider Code | Original error from provider API (if applicable) |

**Error Output Examples**:

```bash
# Authentication error
$ opendom info example.com
Error: Authentication failed for provider 'porkbun'
Code: ERR_AUTH_EXPIRED
Suggestion: Run 'opendom login --provider porkbun' to re-authenticate

# Invalid arguments
$ opendom buy invalid..com --yes
Error: Invalid domain format
Code: ERR_INVALID_DOMAIN
Suggestion: Domain must be a valid fully qualified domain name

# Provider API error
$ opendom buy example.com --yes
Error: Domain already registered by another user
Code: ERR_PROVIDER_API
Provider Code: DOMAIN_NOT_AVAILABLE
Suggestion: Try a different domain or TLD

# Timeout error
$ opendom dns list example.com
Error: Request timed out after 30 seconds
Code: ERR_TIMEOUT
Suggestion: Provider API is slow. Try again or use --timeout flag to increase limit
Operation ID: op-abc123-def456
```

**Timeout Handling**:

- Default timeout: 30 seconds for synchronous operations
- Configurable via `--timeout <seconds>` flag
- Async operations return operation ID for polling status
- Graceful degradation with partial results where possible

---

### 4.5 Rate Limiting

**Description**: Built-in rate limiting prevents overwhelming provider APIs, which could result in temporary blocks or throttling.

**Rate Limiting Strategy**:

| Strategy | Description |
|----------|-------------|
| Per-Provider Limits | Each provider has configurable request limits |
| Configurable Delays | Set minimum delay between operations |
| Exponential Backoff | Retries use increasing delays on failure |
| Burst Protection | Queue prevents rapid-fire requests |

**Configuration Options**:

```bash
# Set rate limiting in config
opendom config set rate-limit.enabled true
opendom config set rate-limit.delay-ms 1000
opendom config set rate-limit.max-retries 3

# Override at runtime
opendom buy example.com --yes --rate-limit-delay 500
```

**Rate Limit Error**:

```bash
$ opendom buy example.com --yes
Error: Rate limit exceeded for provider 'netim'
Code: ERR_RATE_LIMITED
Retry After: 45 seconds
Suggestion: Wait before retrying or adjust rate-limit settings
```

---

## 5. Reliability Features

### 5.1 Connection Retry Logic

**Description**: Automatic retry with configurable policies ensures operations complete reliably despite transient network issues.

**Retry Configuration**:

```typescript
interface RetryConfig {
  maxRetries: number;        // Default: 3
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2.0
  retryableErrors: string[]; // Error codes that trigger retry
}
```

**Retry Behavior**:

- Retries only on transient errors (network timeout, 5xx errors, rate limits)
- Does not retry on permanent errors (auth failure, invalid domain, not found)
- Logs each retry attempt with delay duration
- Respects provider-specific retry headers when available

**Example**:

```bash
$ opendom dns list example.com
[Attempt 1/3] Connecting to cloudflare API...
Error: Connection reset by peer

[Attempt 2/3] Retrying in 1s...
Error: Connection reset by peer

[Attempt 3/3] Retrying in 2s...
Success! Retrieved 5 records
```

### 5.2 Timeout Handling

**Description**: All network operations have configurable timeouts to prevent hanging indefinitely.

**Timeout Configuration**:

```bash
# Set global timeout
opendom config set timeout.default 30000

# Set per-command timeout
opendom dns list example.com --timeout 60000

# Timeout for different operation types
opendom config set timeout.search 10000
opendom config set timeout.purchase 60000
opendom config set timeout.dns 30000
```

### 5.3 Error Recovery Mechanisms

**Description**: When operations fail, the CLI provides recovery paths where possible.

**Recovery Strategies**:

| Scenario | Recovery Action |
|----------|-----------------|
| Partial DNS update | Show which records succeeded, which failed |
| Purchase timeout | Poll for order status, return operation ID |
| Auth token expired | Prompt for re-authentication |
| Provider API down | Suggest alternative provider |

---

## 6. Exit Codes

**Description**: Standardized exit codes allow scripts to handle errors programmatically.

| Exit Code | Name | Description |
|-----------|------|-------------|
| 0 | Success | Operation completed successfully |
| 1 | General Error | Unexpected error occurred |
| 2 | Invalid Arguments | Command-line arguments are invalid |
| 3 | Authentication Error | Credentials are missing, invalid, or expired |
| 4 | Provider API Error | Provider API returned an error |
| 5 | Operation Pending | Async operation queued (check operation ID) |
| 6 | Rate Limited | Provider rate limit exceeded |
| 7 | Timeout | Operation timed out |

**Usage in Scripts**:

```bash
#!/bin/bash
opendom buy example.com --yes
EXIT_CODE=$?

case $EXIT_CODE in
  0) echo "Domain purchased successfully" ;;
  2) echo "Invalid arguments provided" ;;
  3) echo "Authentication required" ;;
  4) echo "Provider error - check logs" ;;
  *) echo "Unknown error occurred" ;;
esac
```

---

## 7. Audit & Logging

### 7.1 Operation Logging

**Description**: All operations are logged with timestamps for audit trails and troubleshooting.

**Log Entry Format**:

```
[2026-03-06T14:32:15Z] [INFO] opendom buy example.com --provider porkbun --yes
[2026-03-06T14:32:15Z] [INFO] Dry-run: false
[2026-03-06T14:32:16Z] [INFO] Domain available - proceeding
[2026-03-06T14:32:18Z] [INFO] Order placed successfully
[2026-03-06T14:32:18Z] [INFO] Operation ID: op-abc123-def456
[2026-03-06T14:32:20Z] [INFO] Domain registered successfully
[2026-03-06T14:32:20Z] [INFO] Purchase complete - $12.00 USD
```

**Log Location**:

- Default: `~/.local/share/opendom/logs/`
- Configurable via `opendom config set log.path /path/to/logs`
- Rotation: Daily files, 30-day retention

### 7.2 Debug Mode

**Description**: `--debug` flag enables verbose output for troubleshooting.

**Debug Output Includes**:

- Full HTTP request/response headers
- Raw API payloads
- Timing information for each operation
- Internal state snapshots

**Example**:

```bash
$ opendom buy example.com --yes --debug
[2026-03-06T14:32:15Z] [DEBUG] Request: POST https://api.porkbun.com/json/v3/domain/register
[2026-03-06T14:32:15Z] [DEBUG] Headers: { "Authorization": "***", "Content-Type": "application/json" }
[2026-03-06T14:32:15Z] [DEBUG] Body: { "domain": "example.com", "years": 1 }
[2026-03-06T14:32:18Z] [DEBUG] Response: 200 OK
[2026-03-06T14:32:18Z] [DEBUG] Body: { "status": "SUCCESS", "orderId": "12345" }
[2026-03-06T14:32:18Z] [INFO] Domain registered successfully
```

---

## 8. Success Metrics

The Safety & Reliability module will be considered successful when:

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Dry-Run Accuracy** | 100% | Dry-run predictions match actual operation outcomes |
| **Accidental Purchases** | 0 | No domain purchased without `--yes` flag |
| **Error Message Clarity** | >90% | Users understand errors and know how to fix |
| **Retry Success Rate** | >80% | Transient errors resolved via retry |
| **Timeout Handling** | <1% | Operations fail gracefully with clear messages |
| **Rate Limit Prevention** | 100% | No provider API blocks due to CLI rate limits |
| **Audit Trail** | 100% | All operations logged with timestamps |

### Verification Commands

```bash
# Verify dry-run mode works
opendom buy example.com --dry-run && echo "Dry-run: PASS"

# Verify confirmation required
opendom buy example.com 2>&1 | grep -q "requires explicit confirmation" && echo "Confirmation: PASS"

# Verify error codes
opendom invalid-cmd 2>/dev/null; [ $? -eq 2 ] && echo "Exit codes: PASS"

# Verify logging
ls ~/.local/share/opendom/logs/ && echo "Logging: PASS"
```

---

## 9. Out of Scope

The following are explicitly **NOT** in scope for this PRD:

- **Transaction Reversals**: Refund or rollback mechanisms (provider-dependent)
- **Insurance**: Financial protection against accidental purchases
- **Approval Workflows**: Multi-step approval processes for purchases
- **Alerting**: External notifications for domain events
- **Budget Controls**: Spending limits per user or time period
- **Provider Failover**: Automatic switching between providers on failure
- **Offline Mode**: Full offline operation without network access
- **Encrypted Logs**: Tamper-proof audit logs

---

*Last updated: March 2026*
