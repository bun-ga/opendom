import { AuthError, ProviderConstraintError } from "../errors.js";
import { requestCore } from "../request-core.js";
import {
  findSelfClosingTags,
  firstTagText,
  getApiStatus,
  getErrors,
} from "./xml.js";

export interface NamecheapCredentials {
  apiUser: string;
  username: string;
  apiKey: string;
  clientIp: string;
  sandbox?: boolean;
}

export interface NamecheapContact {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  phone: string;
  emailAddress: string;
  organizationName?: string;
}

export interface NamecheapHostRecord {
  Name: string;
  Type: string;
  Address: string;
  TTL?: string;
  MXPref?: string;
}

export class NamecheapClient {
  private readonly baseUrl: string;
  private readonly creds: NamecheapCredentials;

  constructor(creds: NamecheapCredentials) {
    this.creds = creds;
    this.baseUrl = creds.sandbox
      ? "https://api.sandbox.namecheap.com/xml.response"
      : "https://api.namecheap.com/xml.response";
  }

  private async call(
    command: string,
    params: Record<string, string> = {},
  ): Promise<string> {
    const query = new URLSearchParams({
      ApiUser: this.creds.apiUser,
      ApiKey: this.creds.apiKey,
      UserName: this.creds.username,
      ClientIp: this.creds.clientIp,
      Command: command,
      ...params,
    });

    const response = await requestCore({
      provider: "namecheap",
      method: "GET",
      url: `${this.baseUrl}?${query.toString()}`,
      retries: 2,
      timeoutMs: 25_000,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthError("namecheap", "Namecheap authentication failed.");
    }

    if (response.status >= 400) {
      throw new Error(
        `Namecheap API error (${response.status}): ${response.text}`,
      );
    }

    const xml = response.text;
    const status = getApiStatus(xml);
    if (status !== "OK") {
      const errors = getErrors(xml);
      const msg =
        errors
          .map((error) => `[${error.code || "-"}] ${error.message}`)
          .join("; ") || "Namecheap API returned error";
      const firstCode = errors[0]?.code;
      if (firstCode === "2011166") {
        throw new AuthError(
          "namecheap",
          "Client IP is not whitelisted for Namecheap API access.",
          firstCode,
        );
      }
      throw new ProviderConstraintError("namecheap", msg);
    }

    return xml;
  }

  async ping(): Promise<void> {
    await this.call("namecheap.users.getBalances");
  }

  async getBalances(): Promise<{
    availableBalance?: number;
    currency?: string;
  }> {
    const xml = await this.call("namecheap.users.getBalances");
    const amount = firstTagText(xml, "AvailableBalance");
    const availableBalance = amount ? Number(amount) : undefined;
    const currency = firstTagText(xml, "Currency");
    return {
      availableBalance:
        availableBalance != null && !Number.isNaN(availableBalance)
          ? availableBalance
          : undefined,
      currency,
    };
  }

  async listAddresses(): Promise<
    Array<{ addressId: string; addressName?: string }>
  > {
    const xml = await this.call("namecheap.users.address.getList");
    const rows = findSelfClosingTags(xml, "List");
    const out: Array<{ addressId: string; addressName?: string }> = [];

    for (const row of rows) {
      const addressId = (row.attrs.AddressId || "").trim();
      if (!addressId) continue;
      const addressName = row.attrs.AddressName;
      if (addressName !== undefined) {
        out.push({ addressId, addressName });
      } else {
        out.push({ addressId });
      }
    }

    return out;
  }

  async getAddressInfo(
    addressId: string,
  ): Promise<NamecheapContact & { defaultYn?: boolean }> {
    const xml = await this.call("namecheap.users.address.getInfo", {
      AddressId: addressId,
    });

    const defaultRaw = firstTagText(xml, "Default_YN");

    return {
      firstName: firstTagText(xml, "FirstName") ?? "",
      lastName: firstTagText(xml, "LastName") ?? "",
      address1: firstTagText(xml, "Address1") ?? "",
      city: firstTagText(xml, "City") ?? "",
      stateProvince: firstTagText(xml, "StateProvince") ?? "",
      postalCode:
        firstTagText(xml, "Zip") ?? firstTagText(xml, "PostalCode") ?? "",
      country: firstTagText(xml, "Country") ?? "",
      phone: firstTagText(xml, "Phone") ?? "",
      emailAddress: firstTagText(xml, "EmailAddress") ?? "",
      organizationName:
        firstTagText(xml, "Organization") ??
        firstTagText(xml, "OrganizationName"),
      defaultYn:
        defaultRaw == null
          ? undefined
          : /^(true|yes|1)$/i.test(defaultRaw.trim()),
    };
  }

  async listDomains(): Promise<
    Array<{
      name: string;
      expires?: string;
      autoRenew?: boolean;
      status?: string;
    }>
  > {
    const xml = await this.call("namecheap.domains.getList");
    const rows = findSelfClosingTags(xml, "Domain");
    return rows.map((row) => ({
      name: row.attrs.Name || "",
      expires: row.attrs.Expires,
      autoRenew: (row.attrs.AutoRenew || "").toLowerCase() === "true",
      status: row.attrs.IsExpired === "true" ? "expired" : undefined,
    }));
  }

  async getDomainInfo(domain: string): Promise<string> {
    return this.call("namecheap.domains.getInfo", { DomainName: domain });
  }

  async checkDomains(
    domains: string[],
  ): Promise<Record<string, { available: boolean }>> {
    const xml = await this.call("namecheap.domains.check", {
      DomainList: domains.join(","),
    });
    const rows = findSelfClosingTags(xml, "DomainCheckResult");
    const out: Record<string, { available: boolean }> = {};
    for (const row of rows) {
      const domain = row.attrs.Domain || "";
      out[domain] = {
        available: (row.attrs.Available || "").toLowerCase() === "true",
      };
    }
    return out;
  }

  async renewDomain(domain: string, years: number): Promise<void> {
    await this.call("namecheap.domains.renew", {
      DomainName: domain,
      Years: String(years),
    });
  }

  async createDomain(
    domain: string,
    years: number,
    contact: NamecheapContact,
  ): Promise<void> {
    const params: Record<string, string> = {
      DomainName: domain,
      Years: String(years),
    };
    const groups = ["Registrant", "Tech", "Admin", "AuxBilling"] as const;
    for (const group of groups) {
      params[`${group}FirstName`] = contact.firstName;
      params[`${group}LastName`] = contact.lastName;
      params[`${group}Address1`] = contact.address1;
      params[`${group}City`] = contact.city;
      params[`${group}StateProvince`] = contact.stateProvince;
      params[`${group}PostalCode`] = contact.postalCode;
      params[`${group}Country`] = contact.country;
      params[`${group}Phone`] = contact.phone;
      params[`${group}EmailAddress`] = contact.emailAddress;
      if (contact.organizationName) {
        params[`${group}OrganizationName`] = contact.organizationName;
      }
    }
    await this.call("namecheap.domains.create", params);
  }

  async getHosts(domain: string): Promise<NamecheapHostRecord[]> {
    const xml = await this.call("namecheap.domains.dns.getHosts", {
      SLD: this.sld(domain),
      TLD: this.tld(domain),
    });
    const rows = findSelfClosingTags(xml, "host");
    return rows.map((row) => ({
      Name: row.attrs.Name || "@",
      Type: row.attrs.Type || "A",
      Address: row.attrs.Address || "",
      TTL: row.attrs.TTL,
      MXPref: row.attrs.MXPref,
    }));
  }

  async setHosts(domain: string, hosts: NamecheapHostRecord[]): Promise<void> {
    const params: Record<string, string> = {
      SLD: this.sld(domain),
      TLD: this.tld(domain),
    };
    hosts.forEach((host, index) => {
      const n = index + 1;
      params[`HostName${n}`] = host.Name;
      params[`RecordType${n}`] = host.Type;
      params[`Address${n}`] = host.Address;
      if (host.MXPref) params[`MXPref${n}`] = host.MXPref;
      if (host.TTL) params[`TTL${n}`] = host.TTL;
    });
    await this.call("namecheap.domains.dns.setHosts", params);
  }

  async setCustomNameservers(
    domain: string,
    nameservers: string[],
  ): Promise<void> {
    await this.call("namecheap.domains.dns.setCustom", {
      SLD: this.sld(domain),
      TLD: this.tld(domain),
      Nameservers: nameservers.join(","),
    });
  }

  async setRegistrarLock(domain: string, enabled: boolean): Promise<void> {
    await this.call("namecheap.domains.setRegistrarLock", {
      DomainName: domain,
      LockAction: enabled ? "LOCK" : "UNLOCK",
    });
  }

  async setWhoisGuard(domain: string, enabled: boolean): Promise<void> {
    await this.call(
      enabled ? "namecheap.whoisguard.enable" : "namecheap.whoisguard.disable",
      {
        DomainName: domain,
      },
    );
  }

  private sld(domain: string): string {
    const parts = domain.toLowerCase().split(".").filter(Boolean);
    if (parts.length < 2) throw new Error(`Invalid domain: ${domain}`);
    return parts[0];
  }

  private tld(domain: string): string {
    const parts = domain.toLowerCase().split(".").filter(Boolean);
    if (parts.length < 2) throw new Error(`Invalid domain: ${domain}`);
    return parts.slice(1).join(".");
  }
}
