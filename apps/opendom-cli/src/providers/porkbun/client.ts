import { AuthError, ProviderConstraintError } from "../errors.js";
import { requestCore } from "../request-core.js";

export interface PorkbunCredentials {
  apikey: string;
  secretapikey: string;
}

export interface PorkbunDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl?: string;
  prio?: string;
}

type PorkbunResponse<T = Record<string, unknown>> = {
  status?: string;
  message?: string;
  response?: T;
  [k: string]: unknown;
};

function parseDollarAmountToCents(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/[$,]/g, "");
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) return undefined;
    return Math.round(parsed * 100);
  }

  return undefined;
}

export class PorkbunClient {
  private readonly baseUrl = "https://api.porkbun.com/api/json/v3";
  private readonly creds: PorkbunCredentials;

  constructor(creds: PorkbunCredentials) {
    this.creds = creds;
  }

  private authBody(): Record<string, string> {
    return {
      apikey: this.creds.apikey,
      secretapikey: this.creds.secretapikey,
    };
  }

  private async post<T = Record<string, unknown>>(
    path: string,
    body: Record<string, unknown> = {},
    includeAuth = true,
  ): Promise<PorkbunResponse<T>> {
    const payload = includeAuth ? { ...this.authBody(), ...body } : body;

    const response = await requestCore({
      provider: "porkbun",
      method: "POST",
      url: `${this.baseUrl}${path}`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      retries: 4,
      timeoutMs: 20_000,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "porkbun",
        "Porkbun authentication failed. Verify API key and secret key.",
      );
    }

    if (response.status >= 400) {
      throw new Error(
        `Porkbun API error (${response.status}): ${response.text}`,
      );
    }

    const parsed = JSON.parse(response.text || "{}") as PorkbunResponse<T>;
    if (parsed.status && parsed.status.toUpperCase() !== "SUCCESS") {
      const msg = parsed.message || "Unknown Porkbun API error";
      throw new ProviderConstraintError("porkbun", msg);
    }
    return parsed;
  }

  private unwrapObjectPayload<T extends Record<string, unknown>>(
    result: PorkbunResponse<T>,
  ): Record<string, unknown> {
    const response = result.response;
    if (response && typeof response === "object" && !Array.isArray(response)) {
      return response as Record<string, unknown>;
    }
    return result as unknown as Record<string, unknown>;
  }

  async ping(): Promise<void> {
    await this.post("/ping");
  }

  async listAllDomains(): Promise<string[]> {
    const result = await this.post<{
      domains?: Array<string | { domain?: string }>;
    }>("/domain/listAll");
    const payload = this.unwrapObjectPayload(result);
    const rows =
      (payload.domains as Array<string | { domain?: string }> | undefined) ||
      [];
    return rows
      .map((item) => (typeof item === "string" ? item : item.domain || ""))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async checkDomain(domain: string): Promise<{
    available: boolean;
    priceCents?: number;
    minDuration?: number;
  }> {
    const result = await this.post<Record<string, unknown>>(
      `/domain/checkDomain/${encodeURIComponent(domain)}`,
    );
    const payload = this.unwrapObjectPayload(result);
    const avail = (payload.avail || payload.available || "")
      .toString()
      .toLowerCase();
    const available = avail === "yes" || avail === "true" || avail === "1";
    const minDurationRaw = Number(
      payload.minDuration || payload.min_duration || 1,
    );
    const minDuration =
      Number.isFinite(minDurationRaw) && minDurationRaw > 0
        ? Math.round(minDurationRaw)
        : 1;

    const unitPriceCents =
      parseDollarAmountToCents(payload.price) ??
      parseDollarAmountToCents(payload.registrationPrice) ??
      parseDollarAmountToCents(payload.registration_price) ??
      parseDollarAmountToCents(payload.priceUSD) ??
      parseDollarAmountToCents(payload.price_usd);

    return {
      available,
      minDuration,
      priceCents:
        typeof unitPriceCents === "number"
          ? unitPriceCents * minDuration
          : undefined,
    };
  }

  async getPricing(): Promise<Record<string, unknown>> {
    const result = await this.post<Record<string, unknown>>(
      "/pricing/get",
      {},
      false,
    );
    const payload = this.unwrapObjectPayload(result);
    if (payload.pricing && typeof payload.pricing === "object") {
      return payload.pricing as Record<string, unknown>;
    }
    return payload;
  }

  async getDetails(domain: string): Promise<Record<string, unknown>> {
    const result = await this.post<Record<string, unknown>>(
      `/domain/getDetails/${encodeURIComponent(domain)}`,
    );
    return this.unwrapObjectPayload(result);
  }

  async createDomain(
    domain: string,
    payload: { cost: number; agreeToTerms: boolean; nameservers?: string[] },
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      cost: payload.cost,
      agreeToTerms: payload.agreeToTerms ? "yes" : "no",
    };

    if (Array.isArray(payload.nameservers) && payload.nameservers.length > 0) {
      body.ns = payload.nameservers;
    }

    const result = await this.post<Record<string, unknown>>(
      `/domain/create/${encodeURIComponent(domain)}`,
      body,
    );
    return this.unwrapObjectPayload(result);
  }

  async retrieveDns(domain: string): Promise<PorkbunDnsRecord[]> {
    const result = await this.post<{ records?: PorkbunDnsRecord[] }>(
      `/dns/retrieve/${encodeURIComponent(domain)}`,
    );
    const payload = this.unwrapObjectPayload(result);
    return (payload.records as PorkbunDnsRecord[] | undefined) || [];
  }

  async createDns(
    domain: string,
    payload: {
      name: string;
      type: string;
      content: string;
      ttl?: number;
      prio?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      name: payload.name,
      type: payload.type,
      content: payload.content,
    };
    if (typeof payload.ttl === "number") body.ttl = payload.ttl;
    if (payload.prio) body.prio = payload.prio;
    const result = await this.post<Record<string, unknown>>(
      `/dns/create/${encodeURIComponent(domain)}`,
      body,
    );
    return this.unwrapObjectPayload(result);
  }

  async editDns(
    domain: string,
    id: string,
    payload: {
      name: string;
      type: string;
      content: string;
      ttl?: number;
      prio?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      name: payload.name,
      type: payload.type,
      content: payload.content,
    };
    if (typeof payload.ttl === "number") body.ttl = payload.ttl;
    if (payload.prio) body.prio = payload.prio;
    const result = await this.post<Record<string, unknown>>(
      `/dns/edit/${encodeURIComponent(domain)}/${id}`,
      body,
    );
    return this.unwrapObjectPayload(result);
  }

  async deleteDns(domain: string, id: string): Promise<void> {
    await this.post(`/dns/delete/${encodeURIComponent(domain)}/${id}`);
  }

  async updateNameservers(
    domain: string,
    servers: string[],
  ): Promise<Record<string, unknown>> {
    const result = await this.post<Record<string, unknown>>(
      `/domain/updateNs/${encodeURIComponent(domain)}`,
      { ns: servers },
    );
    return this.unwrapObjectPayload(result);
  }

  async updateAutoRenew(
    domain: string,
    enabled: boolean,
  ): Promise<Record<string, unknown>> {
    const candidates: Array<Record<string, unknown>> = [
      { status: enabled ? "on" : "off" },
      { autoRenew: enabled ? "on" : "off" },
      { autoRenew: enabled },
      { auto_renew: enabled ? "on" : "off" },
      { value: enabled ? "on" : "off" },
    ];

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const result = await this.post<Record<string, unknown>>(
          `/domain/updateAutoRenew/${encodeURIComponent(domain)}`,
          candidate,
        );
        return this.unwrapObjectPayload(result);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new ProviderConstraintError(
      "porkbun",
      "Failed to update Porkbun auto-renew preference.",
    );
  }
}
