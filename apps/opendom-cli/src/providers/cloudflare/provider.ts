import { getProvider, setProvider } from "@opendom/config";
import { assertCapability } from "../capabilities.js";
import { CapabilityError, ProviderConstraintError } from "../errors.js";
import type {
  AccountInfo,
  DnsRecord,
  DnsSetOptions,
  DomainInfo,
  DomainSummary,
  OperationResult,
  ProviderAdapter,
  ProviderAuthInput,
  ProviderPreference,
  RegisterOptions,
  SearchResponse,
} from "../types.js";
import { CloudflareClient } from "./client.js";

function normalizeName(subdomain: string, domain: string): string {
  if (!subdomain || subdomain === "@") return domain;
  return `${subdomain}.${domain}`;
}

function toSubdomain(recordName: string, domain: string): string {
  const suffix = `.${domain}`.toLowerCase();
  const lower = recordName.toLowerCase();
  if (lower === domain.toLowerCase()) return "@";
  if (lower.endsWith(suffix)) {
    return recordName.slice(0, recordName.length - suffix.length);
  }
  return recordName;
}

function toDone(raw?: unknown): OperationResult {
  return { status: "DONE", raw };
}

function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/[$,]/g, "");
    if (!normalized) return undefined;
    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return undefined;
}

function buildClient(): CloudflareClient {
  const state = getProvider("cloudflare");
  const creds = (state?.credentials ?? {}) as {
    token?: string;
    accountId?: string;
  };
  if (!creds.token) {
    throw new Error(
      "Cloudflare provider is not configured. Run: opendom login cloudflare",
    );
  }
  return new CloudflareClient({
    token: creds.token,
    accountId: creds.accountId,
  });
}

export class CloudflareProvider implements ProviderAdapter {
  readonly id = "cloudflare" as const;

  async login(input: ProviderAuthInput): Promise<void> {
    const token = String(input.token || "").trim();
    const accountId = String(
      input["account-id"] || input.accountId || "",
    ).trim();
    if (!token) {
      throw new Error(
        "Usage: opendom login --provider cloudflare --token <API_TOKEN> [--account-id <ACCOUNT_ID>]",
      );
    }

    const client = new CloudflareClient({
      token,
      accountId: accountId || undefined,
    });
    await client.verifyToken();

    setProvider(
      "cloudflare",
      {
        env: "prod",
        credentials: {
          token,
          accountId: accountId || undefined,
        },
      },
      false,
    );
  }

  async logout(): Promise<void> {
    // Cloudflare tokens are stateless for this CLI; clearing local config is sufficient.
  }

  async balance(): Promise<AccountInfo> {
    assertCapability("cloudflare", "balance");
    const client = buildClient();
    await client.verifyToken();
    return {
      currency: "USD",
      details: {
        note: "Cloudflare Registrar does not expose account balance in this API flow.",
      },
    };
  }

  async search(domains: string[], withPrice: boolean): Promise<SearchResponse> {
    assertCapability("cloudflare", "search");
    const client = buildClient();
    const response: SearchResponse = { results: {}, prices: {} };

    for (const domain of domains) {
      try {
        const details = await client.getRegistrarDomain(domain);
        const canRegister = details.can_register;
        response.results[domain] = {
          result: canRegister === true ? "available" : "unavailable",
        };

        if (withPrice) {
          const priceValue =
            extractNumber(details.price) ??
            extractNumber(details.registration_price) ??
            extractNumber(details.registrationPrice) ??
            extractNumber(details.cost);
          if (typeof priceValue === "number") {
            response.prices[domain] = priceValue;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("(404)")) {
          response.results[domain] = {
            result: "unknown",
            reason: "Cloudflare registrar lookup did not return this domain.",
          };
          continue;
        }
        throw error;
      }
    }

    return response;
  }

  async buy(
    _domain: string,
    _options: RegisterOptions,
  ): Promise<OperationResult> {
    throw new CapabilityError(
      "cloudflare",
      "buy",
      "Cloudflare Registrar API does not expose direct purchase in this CLI flow. Use Cloudflare Registrar dashboard.",
    );
  }

  async domains(): Promise<DomainSummary[]> {
    assertCapability("cloudflare", "domains");
    const client = buildClient();
    try {
      const registrarDomains = await client.listRegistrarDomains();
      if (registrarDomains.length > 0) {
        return registrarDomains.map((domain) => ({
          domainName: domain.name,
          status: typeof domain.status === "string" ? domain.status : undefined,
          dateExpiration:
            typeof domain.expires_at === "string"
              ? domain.expires_at
              : undefined,
          autoRenew:
            typeof domain.auto_renew === "boolean"
              ? domain.auto_renew
              : undefined,
        }));
      }
    } catch {
      // Token may not have registrar scope; DNS zones fallback below.
    }

    const zones = await client.listZones();
    return zones.map((zone) => ({
      domainName: zone.name,
      status: zone.status,
      dateExpiration: undefined,
    }));
  }

  async info(domain: string): Promise<DomainInfo> {
    assertCapability("cloudflare", "info");
    const client = buildClient();
    let registrar: Record<string, unknown> | undefined;
    let zoneData:
      | {
          name: string;
          status?: string;
          created_on?: string;
          name_servers?: string[];
        }
      | undefined;

    try {
      registrar = await client.getRegistrarDomain(domain);
    } catch {
      registrar = undefined;
    }

    try {
      zoneData = await client.getZone(domain);
    } catch {
      zoneData = undefined;
    }

    if (!registrar && !zoneData) {
      throw new ProviderConstraintError(
        "cloudflare",
        `Domain not found in Cloudflare registrar or zones: ${domain}`,
      );
    }

    return {
      domainName: zoneData?.name || domain,
      status: (registrar?.status as string | undefined) || zoneData?.status,
      dateCreate: zoneData?.created_on,
      dateExpiration: registrar?.expires_at as string | undefined,
      nameservers: zoneData?.name_servers,
      autoRenew: registrar?.auto_renew as boolean | undefined,
      registrarLock: registrar?.locked as boolean | undefined,
      whoisPrivacy: registrar?.privacy as boolean | undefined,
      raw: {
        registrar,
        zone: zoneData,
      },
    };
  }

  async renew(_domain: string, _duration: number): Promise<OperationResult> {
    throw new CapabilityError(
      "cloudflare",
      "renew",
      "Cloudflare Registrar API does not expose direct renew in this CLI flow. Use Cloudflare Registrar dashboard.",
    );
  }

  async setPreference(
    domain: string,
    preference: ProviderPreference,
    enabled: boolean,
  ): Promise<OperationResult> {
    assertCapability("cloudflare", "set");
    const client = buildClient();

    switch (preference) {
      case "auto-renew": {
        const raw = await client.updateRegistrarDomain(domain, {
          auto_renew: enabled,
        });
        return toDone(raw);
      }
      case "lock": {
        const raw = await client.updateRegistrarDomain(domain, {
          locked: enabled,
        });
        return toDone(raw);
      }
      case "whois-privacy": {
        const raw = await client.updateRegistrarDomain(domain, {
          privacy: enabled,
        });
        return toDone(raw);
      }
      default:
        throw new CapabilityError(
          "cloudflare",
          "set",
          `Unsupported preference: ${preference}`,
        );
    }
  }

  async dnsList(domain: string): Promise<DnsRecord[]> {
    assertCapability("cloudflare", "dns-list");
    const client = buildClient();
    const records = await client.listDnsRecords(domain);
    return records.map((record) => ({
      id: record.id,
      subdomain: toSubdomain(record.name, domain),
      type: record.type,
      value: record.content,
      ttl: record.ttl,
      priority: record.priority,
    }));
  }

  async dnsSet(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
    options: DnsSetOptions,
  ): Promise<OperationResult> {
    assertCapability("cloudflare", "dns-set");
    const client = buildClient();
    const name = normalizeName(subdomain, domain);
    await client.createDnsRecord(domain, {
      type,
      name,
      content: value,
      ttl: options.ttl,
      priority: options.priority ? Number(options.priority) : undefined,
    });
    return toDone();
  }

  async dnsRemove(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
  ): Promise<OperationResult> {
    assertCapability("cloudflare", "dns-rm");
    const client = buildClient();
    const name = normalizeName(subdomain, domain);
    const found = await client.findDnsRecord(domain, {
      type,
      name,
      content: value,
    });
    if (!found) {
      throw new ProviderConstraintError(
        "cloudflare",
        `DNS record not found for removal: ${type} ${name} -> ${value}`,
      );
    }
    await client.deleteDnsRecord(domain, found.id);
    return toDone();
  }

  async dnsUpdate(
    domain: string,
    type: string,
    oldValue: string,
    newValue: string,
    subdomain: string,
    ttl: number,
  ): Promise<OperationResult> {
    assertCapability("cloudflare", "dns-update");
    const client = buildClient();
    const name = normalizeName(subdomain, domain);
    const found = await client.findDnsRecord(domain, {
      type,
      name,
      content: oldValue,
    });
    if (!found) {
      throw new ProviderConstraintError(
        "cloudflare",
        `DNS record not found for update: ${type} ${name} -> ${oldValue}`,
      );
    }
    await client.updateDnsRecord(domain, found.id, {
      type,
      name,
      content: newValue,
      ttl,
      priority: found.priority,
    });
    return toDone();
  }

  async dnsNs(_domain: string, _servers: string[]): Promise<OperationResult> {
    throw new CapabilityError(
      "cloudflare",
      "dns-ns",
      "Cloudflare authoritative nameservers are managed by Cloudflare and cannot be changed in this CLI flow.",
    );
  }
}
