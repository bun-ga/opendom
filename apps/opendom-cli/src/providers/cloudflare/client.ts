import { AuthError, ProviderConstraintError } from "../errors.js";
import { requestCore } from "../request-core.js";

export interface CloudflareCredentials {
  token: string;
  accountId?: string;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
  result_info?: {
    page?: number;
    per_page?: number;
    count?: number;
    total_count?: number;
    total_pages?: number;
  };
}

export interface CfZone {
  id: string;
  name: string;
  status?: string;
  name_servers?: string[];
  modified_on?: string;
  created_on?: string;
}

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
}

export interface CfAccount {
  id: string;
}

interface CfMembership {
  account?: { id?: string };
}

export interface CfRegistrarDomain {
  name: string;
  status?: string;
  expires_at?: string;
  auto_renew?: boolean;
  locked?: boolean;
  privacy?: boolean;
  can_register?: boolean;
  [key: string]: unknown;
}

export class CloudflareClient {
  private readonly baseUrl = "https://api.cloudflare.com/client/v4";
  private readonly creds: CloudflareCredentials;
  private readonly zoneCache = new Map<string, CfZone>();
  private accountIdCache: string | undefined;

  constructor(creds: CloudflareCredentials) {
    this.creds = creds;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.creds.token}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await requestCore({
      provider: "cloudflare",
      method,
      url: `${this.baseUrl}${path}`,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      retries: 2,
      timeoutMs: 20_000,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "cloudflare",
        "Cloudflare authentication failed. Verify token scopes.",
      );
    }

    if (response.status >= 400) {
      throw new Error(
        `Cloudflare API error (${response.status}): ${response.text}`,
      );
    }

    const payload = JSON.parse(response.text || "{}") as CfEnvelope<T>;
    if (!payload.success) {
      const message =
        payload.errors
          ?.map((err) => err.message || "Unknown error")
          .join("; ") || "Unknown Cloudflare API error";
      throw new ProviderConstraintError("cloudflare", message);
    }
    return payload.result;
  }

  async verifyToken(): Promise<void> {
    await this.request<{ id: string }>("/user/tokens/verify");
  }

  private async resolveAccountId(): Promise<string> {
    if (this.creds.accountId) return this.creds.accountId;
    if (this.accountIdCache) return this.accountIdCache;

    try {
      const accounts = await this.request<CfAccount[]>("/accounts?per_page=50");
      const first = accounts.find((account) => Boolean(account.id));
      if (first?.id) {
        this.accountIdCache = first.id;
        return first.id;
      }
    } catch {
      // Some token scopes do not allow listing accounts.
    }

    try {
      const memberships = await this.request<CfMembership[]>("/memberships");
      const memberAccount = memberships.find((membership) =>
        Boolean(membership.account?.id),
      )?.account?.id;
      if (memberAccount) {
        this.accountIdCache = memberAccount;
        return memberAccount;
      }
    } catch {
      // Continue to explicit guidance below.
    }

    throw new ProviderConstraintError(
      "cloudflare",
      "Cloudflare account id could not be resolved from token scope. Re-login with --account-id.",
    );
  }

  async listZones(name?: string): Promise<CfZone[]> {
    const params = new URLSearchParams();
    params.set("per_page", "50");
    if (name) params.set("name", name);
    return this.request<CfZone[]>(`/zones?${params.toString()}`);
  }

  private splitDomainCandidates(domain: string): string[] {
    const labels = domain.toLowerCase().split(".").filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < labels.length - 1; i += 1) {
      out.push(labels.slice(i).join("."));
    }
    return out;
  }

  async resolveZone(domain: string): Promise<CfZone> {
    const candidates = this.splitDomainCandidates(domain);
    for (const candidate of candidates) {
      const cached = this.zoneCache.get(candidate);
      if (cached) return cached;

      const zones = await this.listZones(candidate);
      const exact = zones.find((zone) => zone.name.toLowerCase() === candidate);
      if (exact) {
        this.zoneCache.set(candidate, exact);
        return exact;
      }
    }
    throw new ProviderConstraintError(
      "cloudflare",
      `Zone not found for domain: ${domain}`,
    );
  }

  async getZone(domain: string): Promise<CfZone> {
    const zone = await this.resolveZone(domain);
    return this.request<CfZone>(`/zones/${zone.id}`);
  }

  async listRegistrarDomains(): Promise<CfRegistrarDomain[]> {
    const accountId = await this.resolveAccountId();
    return this.request<CfRegistrarDomain[]>(
      `/accounts/${accountId}/registrar/domains?per_page=500`,
    );
  }

  async getRegistrarDomain(domain: string): Promise<CfRegistrarDomain> {
    const accountId = await this.resolveAccountId();
    return this.request<CfRegistrarDomain>(
      `/accounts/${accountId}/registrar/domains/${encodeURIComponent(domain)}`,
    );
  }

  async updateRegistrarDomain(
    domain: string,
    payload: { auto_renew?: boolean; locked?: boolean; privacy?: boolean },
  ): Promise<CfRegistrarDomain> {
    const accountId = await this.resolveAccountId();
    const body: Record<string, boolean> = {};
    if (typeof payload.auto_renew === "boolean")
      body.auto_renew = payload.auto_renew;
    if (typeof payload.locked === "boolean") body.locked = payload.locked;
    if (typeof payload.privacy === "boolean") body.privacy = payload.privacy;

    if (Object.keys(body).length === 0) {
      throw new ProviderConstraintError(
        "cloudflare",
        "No registrar preference payload supplied.",
      );
    }

    return this.request<CfRegistrarDomain>(
      `/accounts/${accountId}/registrar/domains/${encodeURIComponent(domain)}`,
      "PUT",
      body,
    );
  }

  async listDnsRecords(domain: string): Promise<CfDnsRecord[]> {
    const zone = await this.resolveZone(domain);
    return this.request<CfDnsRecord[]>(
      `/zones/${zone.id}/dns_records?per_page=500`,
    );
  }

  async createDnsRecord(
    domain: string,
    payload: {
      type: string;
      name: string;
      content: string;
      ttl?: number;
      priority?: number | null;
    },
  ): Promise<CfDnsRecord> {
    const zone = await this.resolveZone(domain);
    const body: Record<string, unknown> = {
      type: payload.type,
      name: payload.name,
      content: payload.content,
      ttl: payload.ttl ?? 300,
    };
    if (typeof payload.priority === "number") body.priority = payload.priority;
    return this.request<CfDnsRecord>(
      `/zones/${zone.id}/dns_records`,
      "POST",
      body,
    );
  }

  async updateDnsRecord(
    domain: string,
    recordId: string,
    payload: {
      type: string;
      name: string;
      content: string;
      ttl?: number;
      priority?: number | null;
    },
  ): Promise<CfDnsRecord> {
    const zone = await this.resolveZone(domain);
    const body: Record<string, unknown> = {
      type: payload.type,
      name: payload.name,
      content: payload.content,
      ttl: payload.ttl ?? 300,
    };
    if (typeof payload.priority === "number") body.priority = payload.priority;
    return this.request<CfDnsRecord>(
      `/zones/${zone.id}/dns_records/${recordId}`,
      "PATCH",
      body,
    );
  }

  async deleteDnsRecord(domain: string, recordId: string): Promise<void> {
    const zone = await this.resolveZone(domain);
    await this.request<{ id: string }>(
      `/zones/${zone.id}/dns_records/${recordId}`,
      "DELETE",
    );
  }

  async findDnsRecord(
    domain: string,
    matcher: { type: string; name: string; content?: string },
  ): Promise<CfDnsRecord | null> {
    const records = await this.listDnsRecords(domain);
    return (
      records.find((record) => {
        if (record.type.toUpperCase() !== matcher.type.toUpperCase())
          return false;
        if (record.name.toLowerCase() !== matcher.name.toLowerCase())
          return false;
        if (matcher.content && record.content !== matcher.content) return false;
        return true;
      }) || null
    );
  }
}
