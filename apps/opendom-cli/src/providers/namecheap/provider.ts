import {
  type NamecheapContact,
  type NamecheapCredentials,
  getProvider,
  setProvider,
} from "../../config/index.js";
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
import { NamecheapClient } from "./client.js";
import { firstTagText } from "./xml.js";

function buildClient(): NamecheapClient {
  const state = getProvider("namecheap");
  const creds = (state?.credentials ?? {}) as unknown as NamecheapCredentials;
  if (
    !creds.apiKey &&
    state?.secretStorage?.mode === "encrypted" &&
    creds.apiUser &&
    creds.username &&
    creds.clientIp
  ) {
    throw new Error(
      "Namecheap API key is missing from encrypted storage. Re-run: opendom login namecheap",
    );
  }
  if (!creds.apiUser || !creds.apiKey || !creds.username || !creds.clientIp) {
    throw new Error(
      "Namecheap provider is not configured. Run: opendom login namecheap",
    );
  }
  const sandbox = state?.env === "sandbox" || creds.sandbox === true;
  return new NamecheapClient({ ...creds, sandbox });
}

function toDone(raw?: unknown): OperationResult {
  return { status: "DONE", raw };
}

function normalizeHostName(subdomain: string): string {
  if (!subdomain || subdomain === "@") return "@";
  return subdomain;
}

const REQUIRED_NAMECHEAP_CONTACT_FIELDS: Array<keyof NamecheapContact> = [
  "firstName",
  "lastName",
  "address1",
  "city",
  "stateProvince",
  "postalCode",
  "country",
  "phone",
  "emailAddress",
];

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toNamecheapContact(
  profile: NamecheapContact & { defaultYn?: boolean },
): NamecheapContact {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    address1: profile.address1,
    city: profile.city,
    stateProvince: profile.stateProvince,
    postalCode: profile.postalCode,
    country: profile.country,
    phone: profile.phone,
    emailAddress: profile.emailAddress,
    organizationName: profile.organizationName,
  };
}

function listMissingContactFields(contact: NamecheapContact): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_NAMECHEAP_CONTACT_FIELDS) {
    if (!contact[field] || contact[field].trim().length === 0) {
      missing.push(field);
    }
  }
  return missing;
}

export class NamecheapProvider implements ProviderAdapter {
  readonly id = "namecheap" as const;

  async login(input: ProviderAuthInput): Promise<void> {
    const apiUser = String(input["api-user"] || input.apiUser || "").trim();
    const username = String(input.username || "").trim();
    const apiKey = String(input["api-key"] || input.apiKey || "").trim();
    const clientIp = String(input["client-ip"] || input.clientIp || "").trim();
    const sandbox = Boolean(input.sandbox);
    const explicitAddressId =
      readOptionalString(input["address-id"]) ??
      readOptionalString(input.addressId);

    if (!apiUser || !username || !apiKey || !clientIp) {
      throw new Error(
        "Usage: opendom login --provider namecheap --api-user <API_USER> --username <USERNAME> --api-key <API_KEY> --client-ip <IP> [--sandbox]",
      );
    }

    const client = new NamecheapClient({
      apiUser,
      username,
      apiKey,
      clientIp,
      sandbox,
    });
    await client.ping();

    let resolvedAddressId = explicitAddressId;
    if (resolvedAddressId) {
      await client.getAddressInfo(resolvedAddressId);
    } else {
      const addresses = await client.listAddresses();
      for (const address of addresses) {
        const info = await client.getAddressInfo(address.addressId);
        if (info.defaultYn) {
          resolvedAddressId = address.addressId;
          break;
        }
      }
      if (!resolvedAddressId) {
        throw new ProviderConstraintError(
          "namecheap",
          "No default Namecheap address profile found. Re-run: opendom login namecheap and provide an address ID when prompted.",
        );
      }
    }

    setProvider(
      "namecheap",
      {
        env: sandbox ? "sandbox" : "prod",
        credentials: {
          apiUser,
          username,
          apiKey,
          clientIp,
          sandbox,
          addressId: resolvedAddressId,
        },
      },
      false,
    );
  }

  async logout(): Promise<void> {
    // Stateless auth for this client.
  }

  async balance(): Promise<AccountInfo> {
    assertCapability("namecheap", "balance");
    const client = buildClient();
    const balance = await client.getBalances();
    return {
      balance: balance.availableBalance,
      currency: balance.currency,
      details: {
        AvailableBalance: balance.availableBalance,
      },
    };
  }

  async search(domains: string[]): Promise<SearchResponse> {
    assertCapability("namecheap", "search");
    const client = buildClient();
    const checks = await client.checkDomains(domains);
    const out: SearchResponse = { results: {}, prices: {} };
    for (const domain of domains) {
      const found = checks[domain];
      out.results[domain] = {
        result: found
          ? found.available
            ? "available"
            : "unavailable"
          : "unknown",
      };
    }
    return out;
  }

  async buy(
    domain: string,
    options: RegisterOptions,
  ): Promise<OperationResult> {
    assertCapability("namecheap", "buy");
    const state = getProvider("namecheap");
    const creds = (state?.credentials ?? {}) as unknown as NamecheapCredentials;
    const credsWithAddressId = creds as NamecheapCredentials & {
      addressId?: string;
    };
    const effectiveAddressId =
      readOptionalString(options.addressId) ??
      readOptionalString(credsWithAddressId.addressId);
    if (!effectiveAddressId) {
      throw new ProviderConstraintError(
        "namecheap",
        "Namecheap address profile is missing. Re-run: opendom login namecheap and provide an address ID when prompted.",
      );
    }

    const client = buildClient();
    const profile = await client.getAddressInfo(effectiveAddressId);
    const contact = toNamecheapContact(profile);
    const missingFields = listMissingContactFields(contact);
    if (missingFields.length > 0) {
      throw new ProviderConstraintError(
        "namecheap",
        `Namecheap address profile is missing required fields: ${missingFields.join(", ")}`,
      );
    }

    await client.createDomain(domain, options.duration, contact);
    return toDone();
  }

  async domains(): Promise<DomainSummary[]> {
    assertCapability("namecheap", "domains");
    const client = buildClient();
    const rows = await client.listDomains();
    return rows.map((row) => ({
      domainName: row.name,
      dateExpiration: row.expires,
      autoRenew: row.autoRenew,
      status: row.status,
    }));
  }

  async info(domain: string): Promise<DomainInfo> {
    assertCapability("namecheap", "info");
    const client = buildClient();
    const xml = await client.getDomainInfo(domain);

    const nameserverTag = firstTagText(xml, "Nameservers");
    const nameservers = nameserverTag
      ? nameserverTag
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;
    const statusTag = firstTagText(xml, "Status");
    const created = firstTagText(xml, "CreatedDate");
    const expires =
      firstTagText(xml, "ExpiredDate") || firstTagText(xml, "Expires");

    return {
      domainName: domain,
      status: statusTag,
      dateCreate: created,
      dateExpiration: expires,
      nameservers,
      raw: xml,
    };
  }

  async renew(domain: string, duration: number): Promise<OperationResult> {
    assertCapability("namecheap", "renew");
    const client = buildClient();
    await client.renewDomain(domain, duration);
    return toDone();
  }

  async setPreference(
    domain: string,
    preference: ProviderPreference,
    enabled: boolean,
  ): Promise<OperationResult> {
    assertCapability("namecheap", "set");
    const client = buildClient();

    switch (preference) {
      case "lock":
        await client.setRegistrarLock(domain, enabled);
        return toDone();
      case "whois-privacy":
        await client.setWhoisGuard(domain, enabled);
        return toDone();
      case "auto-renew":
        throw new CapabilityError(
          "namecheap",
          "set",
          "Namecheap auto-renew toggle is not exposed in this CLI flow yet.",
        );
      default:
        throw new CapabilityError(
          "namecheap",
          "set",
          `Unsupported preference: ${preference}`,
        );
    }
  }

  async dnsList(domain: string): Promise<DnsRecord[]> {
    assertCapability("namecheap", "dns-list");
    const client = buildClient();
    const hosts = await client.getHosts(domain);
    return hosts.map((host) => ({
      subdomain: host.Name || "@",
      type: host.Type,
      value: host.Address,
      ttl: host.TTL ? Number(host.TTL) : undefined,
      priority: host.MXPref ? Number(host.MXPref) : undefined,
    }));
  }

  async dnsSet(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
    options: DnsSetOptions,
  ): Promise<OperationResult> {
    assertCapability("namecheap", "dns-set");
    const client = buildClient();
    const hosts = await client.getHosts(domain);
    hosts.push({
      Name: normalizeHostName(subdomain),
      Type: type,
      Address: value,
      TTL: options.ttl ? String(options.ttl) : undefined,
      MXPref: options.priority || undefined,
    });
    await client.setHosts(domain, hosts);
    return toDone();
  }

  async dnsRemove(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
  ): Promise<OperationResult> {
    assertCapability("namecheap", "dns-rm");
    const client = buildClient();
    const hosts = await client.getHosts(domain);
    const targetName = normalizeHostName(subdomain);
    const filtered = hosts.filter(
      (host) =>
        !(
          host.Name === targetName &&
          host.Type.toUpperCase() === type.toUpperCase() &&
          host.Address === value
        ),
    );
    if (filtered.length === hosts.length) {
      throw new ProviderConstraintError(
        "namecheap",
        `DNS record not found for removal: ${type} ${targetName} -> ${value}`,
      );
    }
    await client.setHosts(domain, filtered);
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
    assertCapability("namecheap", "dns-update");
    const client = buildClient();
    const hosts = await client.getHosts(domain);
    const targetName = normalizeHostName(subdomain);
    const updated = hosts.map((host) => {
      if (host.Name !== targetName) return host;
      if (host.Type.toUpperCase() !== type.toUpperCase()) return host;
      if (host.Address !== oldValue) return host;
      return {
        ...host,
        Address: newValue,
        TTL: String(ttl),
      };
    });

    const changed = updated.some(
      (host, index) => host.Address !== hosts[index].Address,
    );
    if (!changed) {
      throw new ProviderConstraintError(
        "namecheap",
        `DNS record not found for update: ${type} ${targetName} -> ${oldValue}`,
      );
    }

    await client.setHosts(domain, updated);
    return toDone();
  }

  async dnsNs(domain: string, servers: string[]): Promise<OperationResult> {
    assertCapability("namecheap", "dns-ns");
    const client = buildClient();
    await client.setCustomNameservers(domain, servers);
    return toDone();
  }
}
