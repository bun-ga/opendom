# Multi-Provider Strategy PRD

## 1. Overview

The Multi-Provider Strategy enables OpenDOM to work with multiple domain registrars through a unified CLI interface. By abstracting provider-specific APIs behind a common adapter interface, users can manage domains across different registrars without learning unique command syntax or workflows for each provider. This strategy supports provider selection based on pricing, feature availability, and API reliability while maintaining consistent CLI behavior.

## 2. Product Vision

OpenDOM provides a unified CLI interface that abstracts away the differences between domain registrars. Users authenticate once with their preferred provider, then execute the same commands regardless of which registrar handles their domains. This unified experience eliminates vendor lock-in and allows users to choose providers based on their specific needs—pricing for bulk registrations, API reliability for automation, or specific feature availability.

```bash
# Same commands work regardless of provider
opendom domains list
opendom domains info example.com
opendom dns list example.com
opendom dns set A example.com 192.0.2.1
```

## 3. Provider Ecosystem

The current provider ecosystem includes four integrated registrars with varying capability levels:

| Provider | Status | Capabilities | Notes |
|----------|--------|--------------|-------|
| Netim | ✅ Full | All features | Primary provider in v0.2.x |
| Cloudflare | ⚠️ Partial | No buy, no renew, no ns update | DNS-focused |
| Porkbun | ✅ Full | All features except renew | Budget-friendly |
| Namecheap | ✅ Full | All features | Popular registrar |

**Status Legend:**
- ✅ Full: All core domain operations supported
- ⚠️ Partial: Subset of features available (see capability matrix)
- ❌ Not Started: Integration planned but not implemented

## 4. Provider Abstraction

All providers implement the `ProviderAdapter` interface defined in `apps/opendom-cli/src/providers/types.ts`. This interface defines a consistent set of methods that every provider must implement, ensuring identical command surface across all registrars.

### Interface Contract

```typescript
interface ProviderAdapter {
  readonly id: ProviderId;
  login(input: ProviderAuthInput): Promise<void>;
  logout(): Promise<void>;
  balance(): Promise<AccountInfo>;
  search(domains: string[], withPrice: boolean): Promise<SearchResponse>;
  buy(domain: string, options: RegisterOptions): Promise<OperationResult>;
  domains(): Promise<DomainSummary[]>;
  info(domain: string): Promise<DomainInfo>;
  renew(domain: string, duration: number): Promise<OperationResult>;
  setPreference(domain: string, preference: ProviderPreference, enabled: boolean): Promise<OperationResult>;
  dnsList(domain: string): Promise<DnsRecord[]>;
  dnsSet(domain: string, type: string, value: string, subdomain: string, options: DnsSetOptions): Promise<OperationResult>;
  dnsRemove(domain: string, type: string, value: string, subdomain: string): Promise<OperationResult>;
  dnsUpdate(domain: string, type: string, oldValue: string, newValue: string, subdomain: string, ttl: number): Promise<OperationResult>;
  dnsNs(domain: string, servers: string[]): Promise<OperationResult>;
}
```

### Example Commands

Once authenticated with any provider, users execute identical commands:

```bash
# Domain search works the same way for all providers
opendom domains search example.com example.net

# Domain info retrieval is unified
opendom domains info example.com

# DNS management is consistent across providers
opendom dns list example.com
opendom dns set A example.com 192.0.2.1 --ttl 3600
opendom dns rm A example.com 192.0.2.1
```

### Provider Selection

Users select their provider during authentication:

```bash
# Authenticate with a specific provider
opendom login netim
opendom login porkbun
opendom login namecheap
opendom login cloudflare
```

The authentication flow stores provider credentials in `~/.config/opendom/config.json`, associating them with the selected provider for subsequent commands.

## 5. Capability Matrix

The following table shows feature support for each implemented provider:

| Feature | Netim | Cloudflare | Porkbun | Namecheap |
|---------|:-----:|:----------:|:-------:|:---------:|
| `search` | ✅ | ✅ | ✅ | ✅ |
| `buy` | ✅ | ❌ | ✅ | ✅ |
| `domains` | ✅ | ✅ | ✅ | ✅ |
| `info` | ✅ | ✅ | ✅ | ✅ |
| `renew` | ✅ | ❌ | ❌ | ✅ |
| `set preference` | ✅ | ✅ | ✅ | ✅ |
| `dns-list` | ✅ | ✅ | ✅ | ✅ |
| `dns-set` | ✅ | ✅ | ✅ | ✅ |
| `dns-rm` | ✅ | ✅ | ✅ | ✅ |
| `dns-update` | ✅ | ✅ | ✅ | ✅ |
| `dns-ns` | ✅ | ❌ | ✅ | ✅ |
| `balance` | ✅ | ✅ | ✅ | ✅ |

### Capability Details

- **search**: Check domain availability with optional pricing
- **buy**: Purchase available domains
- **domains**: List all domains in account
- **info**: Get detailed domain information (expiration, status, nameservers)
- **renew**: Extend domain registration period
- **set preference**: Configure domain preferences (whois-privacy, auto-renew, lock)
- **dns-list**: List all DNS records for a domain
- **dns-set**: Add new DNS records
- **dns-rm**: Remove DNS records
- **dns-update**: Modify existing DNS records
- **dns-ns**: Update nameserver assignments
- **balance**: Retrieve account balance information

### Capability Enforcement

When a user attempts an unsupported operation, the CLI throws a `CapabilityError` with a helpful message:

```bash
$ opendom domains buy example.com
Error: `buy` is not available for this provider. Use provider dashboard.
```

The capability matrix is defined in `apps/opendom-cli/src/providers/capabilities.ts` and enforced at runtime via the `assertCapability()` function.

## 6. Provider Selection Criteria

Users should evaluate providers based on the following criteria:

### Price Considerations
- **Registration costs**: Compare base domain prices across providers
- **Renewal pricing**: Some providers offer lower first-year rates but higher renewals
- **Bulk discounts**: Porkbun and Namecheap often have better bulk pricing
- **Currency and payment methods**: Ensure provider accepts preferred payment

### Feature Requirements
- **Full domain lifecycle**: Choose Netim or Namecheap for buy + renew + ns update
- **DNS management only**: Cloudflare provides excellent DNS-only functionality
- **Budget constraints**: Porkbun offers competitive pricing for new registrations
- **API reliability**: Netim provides the most comprehensive API coverage

### API Reliability Factors
- **Rate limits**: Check provider API throttling policies
- **Uptime guarantees**: Enterprise users should prioritize providers with SLAs
- **Error handling**: Providers with better error responses simplify debugging
- **Documentation quality**: Well-documented APIs reduce integration issues

### Recommended Use Cases

| Use Case | Recommended Provider |
|----------|---------------------|
| Full domain lifecycle management | Netim, Namecheap |
| DNS-focused workflows | Cloudflare |
| Budget-conscious registrations | Porkbun |
| Enterprise requirements | Netim |
| Agent/automation scripts | Any (use capability matrix to validate) |

## 7. Future Providers

The following providers are under consideration for future integration:

| Provider | Priority | Notes |
|----------|----------|-------|
| GoDaddy | Medium | Largest market share; good for agent-based bulk operations |
| Name.com | Medium | Budget registrar with competitive pricing |
| Google Domains | Low | Transitioning to Squarespace; limited API availability |
| AWS Route 53 | Low | Enterprise use cases; primarily DNS management |

### Prioritization Factors

1. **Market share**: Providers with larger user bases offer broader utility
2. **API quality**: Well-documented APIs with comprehensive endpoints preferred
3. **Differentiation**: Providers offering unique features (e.g., premium domains, auctions)
4. **Cost efficiency**: Competitive pricing for bulk operations
5. **Reliability**: Proven API stability and uptime

### Provider Integration Effort

Adding a new provider requires:
1. Implement `ProviderAdapter` interface in `apps/opendom-cli/src/providers/<provider>/`
2. Add provider ID to `ProviderId` type in `types.ts`
3. Register capabilities in `capabilities.ts`
4. Add authentication logic to factory in `factory.ts`
5. Add provider-specific tests in `apps/opendom-cli/tests/`

## 8. Implementation Notes

### Architecture Overview

The provider abstraction follows the Adapter pattern, isolating provider-specific logic from the CLI command layer:

```
┌─────────────────────────────────────────────┐
│           CLI Commands (index.ts)           │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         Command Handlers (handlers/)        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│     Provider Factory (factory.ts)           │
│  - Creates provider adapters                │
│  - Manages authentication                    │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│   Provider Adapters (providers/*/provider.ts)│
│  - NetimAdapter                             │
│  - CloudflareAdapter                        │
│  - PorkbunAdapter                           │
│  - NamecheapAdapter                         │
└─────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `providers/types.ts` | Defines `ProviderAdapter` interface and types |
| `providers/capabilities.ts` | Capability matrix and enforcement logic |
| `providers/factory.ts` | Provider instantiation and authentication |
| `providers/errors.ts` | Custom errors including `CapabilityError` |
| `providers/netim/provider.ts` | Netim adapter implementation |
| `providers/cloudflare/provider.ts` | Cloudflare adapter implementation |
| `providers/porkbun/provider.ts` | Porkbun adapter implementation |
| `providers/namecheap/provider.ts` | Namecheap adapter implementation |

### Adding a New Provider

To add a new provider:

1. Create directory `apps/opendom-cli/src/providers/<providername>/`
2. Implement `ProviderAdapter` in `provider.ts`
3. Add authentication client if needed (e.g., `client.ts`)
4. Update `factory.ts` to handle the new provider
5. Add capabilities to `capabilities.ts`
6. Add tests in `apps/opendom-cli/tests/`

The factory pattern ensures all providers are instantiated consistently and authentication is handled uniformly.

## 9. Success Metrics

Multi-provider support is considered successful when the following metrics are achieved:

### Adoption Metrics
- **Provider diversity**: At least 25% of active users authenticate with non-Netim providers
- **Provider switching**: Users successfully switch between providers without data loss
- **Multi-provider accounts**: Users manage domains across multiple providers from single CLI

### Capability Coverage
- **Feature parity**: At least 80% of commands work identically across all "full" status providers
- **Capability enforcement**: Users receive clear error messages for unsupported operations
- **Graceful degradation**: Partial providers function correctly for supported features only

### Reliability Metrics
- **Provider uptime**: Each provider integration maintains 99.5% API availability
- **Error handling**: All provider errors surface actionable messages to users
- **Test coverage**: Provider implementations maintain >80% test coverage

### User Satisfaction
- **Onboarding success**: New users successfully authenticate with any provider on first attempt
- **Feature discoverability**: Users can discover available capabilities for their provider
- **Documentation completeness**: All providers have complete API documentation

### Development Metrics
- **Integration speed**: New providers can be integrated in <2 days
- **Bug resolution**: Provider-specific bugs resolved within 1 sprint
- **Code quality**: All providers pass lint, typecheck, and test suites
