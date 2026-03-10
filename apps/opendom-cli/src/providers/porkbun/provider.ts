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
import { PorkbunClient } from "./client.js";

function buildClient(): PorkbunClient {
  const state = getProvider("porkbun");
  const creds = (state?.credentials ?? {}) as {
    apikey?: string;
    secretapikey?: string;
  };
  if (!creds.apikey || !creds.secretapikey) {
    throw new Error(
      "Porkbun provider is not configured. Run: opendom login porkbun",
    );
  }
  return new PorkbunClient({
    apikey: creds.apikey,
    secretapikey: creds.secretapikey,
  });
}

function toDone(raw?: unknown): OperationResult {
  return { status: "DONE", raw };
}

function normalizeSubdomain(input: string): string {
  if (!input || input === "@") return "";
  return input;
}

function rootDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export class PorkbunProvider implements ProviderAdapter {
  readonly id = "porkbun" as const;

  async login(input: ProviderAuthInput): Promise<void> {
    const apikey = String(input.apikey || "").trim();
    const secretapikey = String(input.secretapikey || "").trim();

    if (!apikey || !secretapikey) {
      throw new Error(
        "Usage: opendom login --provider porkbun --apikey <APIKEY> --secretapikey <SECRETAPIKEY>",
      );
    }

    const client = new PorkbunClient({ apikey, secretapikey });
    await client.ping();

    setProvider(
      "porkbun",
      {
        env: "prod",
        credentials: { apikey, secretapikey },
      },
      false,
    );
  }

  async logout(): Promise<void> {
    // Stateless auth; local cleanup handled by config layer.
  }

  async balance(): Promise<AccountInfo> {
    const client = buildClient();
    await client.ping();
    return {
      currency: "USD",
      details: {
        note: "Porkbun API does not provide an account balance endpoint in this CLI flow.",
      },
    };
  }

  private async ensureDomainApiAccess(domain: string): Promise<void> {
    const client = buildClient();
    const domains = await client.listAllDomains();
    const lookup = rootDomain(domain);
    if (!domains.map((item) => item.toLowerCase()).includes(lookup)) {
      throw new ProviderConstraintError(
        "porkbun",
        `Domain ${domain} is not accessible via API. Enable API Access for this domain in Porkbun dashboard.`,
      );
    }
  }

  async search(domains: string[], withPrice: boolean): Promise<SearchResponse> {
    assertCapability("porkbun", "search");
    const client = buildClient();
    const response: SearchResponse = { results: {}, prices: {} };

    for (const domain of domains) {
      try {
        const check = await client.checkDomain(domain);
        response.results[domain] = {
          result: check.available ? "available" : "unavailable",
        };
        if (withPrice && typeof check.priceCents === "number") {
          response.prices[domain] = check.priceCents / 100;
        }
      } catch {
        response.results[domain] = { result: "unknown" };
      }
    }

    if (withPrice && Object.keys(response.prices).length === 0) {
      try {
        const pricing = await client.getPricing();
        const createPricing = pricing.create as
          | Record<string, unknown>
          | undefined;
        if (createPricing) {
          for (const domain of domains) {
            const tld = domain.split(".").pop()?.toLowerCase() || "";
            const row = (createPricing[tld] ?? {}) as Record<string, unknown>;
            const price = Number(row.price || row.registration || row.yearly);
            if (!Number.isNaN(price)) response.prices[domain] = price;
          }
        }
      } catch {
        // Pricing errors are non-fatal.
      }
    }

    return response;
  }

  async buy(
    domain: string,
    options: RegisterOptions,
  ): Promise<OperationResult> {
    assertCapability("porkbun", "buy");
    const client = buildClient();
    const check = await client.checkDomain(domain);
    if (!check.available) {
      throw new ProviderConstraintError(
        "porkbun",
        `Domain is not available for registration: ${domain}`,
      );
    }

    const minDuration = check.minDuration || 1;
    if (options.duration !== minDuration) {
      throw new ProviderConstraintError(
        "porkbun",
        `Porkbun API registration requires --duration ${minDuration} for this domain.`,
      );
    }
    if (typeof check.priceCents !== "number") {
      throw new ProviderConstraintError(
        "porkbun",
        "Porkbun check response did not include a registration price. Cannot submit required create cost.",
      );
    }

    const raw = await client.createDomain(domain, {
      cost: check.priceCents,
      agreeToTerms: true,
      nameservers: options.nameservers,
    });
    return toDone(raw);
  }

  async domains(): Promise<DomainSummary[]> {
    assertCapability("porkbun", "domains");
    const client = buildClient();
    const domains = await client.listAllDomains();
    return domains.map((domainName) => ({ domainName }));
  }

  async info(domain: string): Promise<DomainInfo> {
    assertCapability("porkbun", "info");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const details = await client.getDetails(domain);

    const ns = details.ns as string[] | undefined;

    return {
      domainName: domain,
      dateCreate:
        typeof details.createDate === "string" ? details.createDate : undefined,
      dateExpiration:
        typeof details.expireDate === "string" ? details.expireDate : undefined,
      autoRenew: String(details.autoRenew || "").toLowerCase() === "yes",
      nameservers: Array.isArray(ns) ? ns : undefined,
      raw: details,
    };
  }

  async renew(domain: string, duration: number): Promise<OperationResult> {
    void domain;
    void duration;
    throw new CapabilityError(
      "porkbun",
      "renew",
      "Porkbun public API does not expose a documented immediate renew endpoint for this CLI flow.",
    );
  }

  async setPreference(
    domain: string,
    preference: ProviderPreference,
    enabled: boolean,
  ): Promise<OperationResult> {
    assertCapability("porkbun", "set");
    if (preference !== "auto-renew") {
      throw new CapabilityError(
        "porkbun",
        "set",
        "Porkbun `set` supports only `auto-renew` in this CLI flow. Use dashboard for whois-privacy/lock.",
      );
    }

    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const raw = await client.updateAutoRenew(domain, enabled);
    return toDone(raw);
  }

  async dnsList(domain: string): Promise<DnsRecord[]> {
    assertCapability("porkbun", "dns-list");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const records = await client.retrieveDns(domain);
    return records.map((record) => {
      const name = record.name || "@";
      const suffix = `.${domain}`.toLowerCase();
      const lower = name.toLowerCase();
      const subdomain =
        lower === domain.toLowerCase()
          ? "@"
          : lower.endsWith(suffix)
            ? name.slice(0, name.length - suffix.length)
            : name;
      return {
        id: record.id,
        subdomain,
        type: record.type,
        value: record.content,
        ttl: record.ttl ? Number(record.ttl) : undefined,
        priority: record.prio ? Number(record.prio) : undefined,
      };
    });
  }

  async dnsSet(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
    options: DnsSetOptions,
  ): Promise<OperationResult> {
    assertCapability("porkbun", "dns-set");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const raw = await client.createDns(domain, {
      name: normalizeSubdomain(subdomain),
      type,
      content: value,
      ttl: options.ttl,
      prio: options.priority ?? undefined,
    });
    return toDone(raw);
  }

  async dnsRemove(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
  ): Promise<OperationResult> {
    assertCapability("porkbun", "dns-rm");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const records = await this.dnsList(domain);
    const found = records.find(
      (record) =>
        record.type.toUpperCase() === type.toUpperCase() &&
        record.value === value &&
        (record.subdomain || "@") === (subdomain || "@"),
    );

    if (!found?.id) {
      throw new ProviderConstraintError(
        "porkbun",
        `DNS record not found for removal: ${type} ${subdomain || "@"} -> ${value}`,
      );
    }

    await client.deleteDns(domain, found.id);
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
    assertCapability("porkbun", "dns-update");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const records = await this.dnsList(domain);
    const found = records.find(
      (record) =>
        record.type.toUpperCase() === type.toUpperCase() &&
        record.value === oldValue &&
        (record.subdomain || "@") === (subdomain || "@"),
    );

    if (!found?.id) {
      throw new ProviderConstraintError(
        "porkbun",
        `DNS record not found for update: ${type} ${subdomain || "@"} -> ${oldValue}`,
      );
    }

    const raw = await client.editDns(domain, found.id, {
      name: normalizeSubdomain(subdomain),
      type,
      content: newValue,
      ttl,
      prio: found.priority != null ? String(found.priority) : undefined,
    });
    return toDone(raw);
  }

  async dnsNs(domain: string, servers: string[]): Promise<OperationResult> {
    assertCapability("porkbun", "dns-ns");
    await this.ensureDomainApiAccess(domain);
    const client = buildClient();
    const raw = await client.updateNameservers(domain, servers);
    return toDone(raw);
  }
}
