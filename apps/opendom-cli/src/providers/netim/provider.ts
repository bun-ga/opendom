import {
  type NetimCredentials,
  type ProviderSession,
  getProvider,
  setProvider,
  setProviderSession,
} from "@opendom/config";
import { Netim } from "../../api/netim.js";
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

type RawOperation = { STATUS?: string; message?: string; operationId?: number };

function toOperationResult(raw: {
  STATUS?: string;
  message?: string;
  operationId?: number;
  [k: string]: unknown;
}): OperationResult {
  const status = (raw.STATUS || "ERROR").toUpperCase();
  if (status === "DONE" || status === "PENDING") {
    return { status, message: raw.message, operationId: raw.operationId, raw };
  }
  return {
    status: "ERROR",
    message: raw.message || status,
    operationId: raw.operationId,
    raw,
  };
}

function boolToOp(enabled: boolean): string {
  return enabled ? "ON" : "OFF";
}

function normalizeContactId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNetimField(value: unknown): string | undefined {
  return typeof value === "string" ? normalizeContactId(value) : undefined;
}

function persistNetimCredentialDefaults(
  nextDefaults: Partial<NetimCredentials>,
): void {
  const state = getProvider("netim");
  if (!state?.credentials) return;

  const currentCredentials = state.credentials as unknown as NetimCredentials;
  const merged: NetimCredentials = {
    ...currentCredentials,
    ...nextDefaults,
  };

  setProvider(
    "netim",
    {
      ...state,
      credentials: merged as unknown as Record<string, unknown>,
    } as never,
    false,
  );
}

function ensureNetimCredentials(): NetimCredentials {
  const state = getProvider("netim");
  if (!state?.credentials) {
    throw new Error(
      "Netim provider is not configured. Run: opendom login netim",
    );
  }
  return state.credentials as unknown as NetimCredentials;
}

function currentState(): { env: string; session?: ProviderSession } {
  const state = getProvider("netim");
  return {
    env: state?.env || "prod",
    session: state?.session,
  };
}

function buildClient(): Netim {
  const credentials = ensureNetimCredentials();
  const state = currentState();
  return new Netim({
    resellerId: credentials.resellerId,
    apiSecret: credentials.apiSecret,
    ote: state.env === "ote",
    session: {
      token:
        typeof state.session?.token === "string"
          ? state.session.token
          : undefined,
      expiry:
        typeof state.session?.expiry === "number"
          ? state.session.expiry
          : undefined,
    },
    onSessionChange: (session) => {
      setProviderSession("netim", session);
    },
  });
}

export class NetimProvider implements ProviderAdapter {
  readonly id = "netim" as const;

  async login(input: ProviderAuthInput): Promise<void> {
    const resellerId = String(input.id || input.resellerId || "").trim();
    const apiSecret = String(input.secret || input.apiSecret || "").trim();
    const ote = Boolean(input.ote);

    if (!resellerId || !apiSecret) {
      throw new Error(
        "Usage: opendom login --provider netim --id <RESELLER_ID> --secret <API_SECRET> [--ote]",
      );
    }

    const client = new Netim({ resellerId, apiSecret, ote });
    const token = await client.open();

    const existing = getProvider("netim")?.credentials as
      | NetimCredentials
      | undefined;

    setProvider(
      "netim",
      {
        env: ote ? "ote" : "prod",
        credentials: {
          resellerId,
          apiSecret,
          defaultNs: existing?.defaultNs,
          defaultOwner: existing?.defaultOwner,
          defaultAdmin: existing?.defaultAdmin,
          defaultTech: existing?.defaultTech,
          defaultBilling: existing?.defaultBilling,
        },
        session: {
          token,
          expiry: Date.now() + 50 * 60_000,
        },
      },
      true,
    );
  }

  async logout(): Promise<void> {
    const state = getProvider("netim");
    if (!state?.credentials) return;
    try {
      const client = buildClient();
      await client.close();
    } catch {
      // Ignore remote close failures.
    }
  }

  async balance(): Promise<AccountInfo> {
    const client = buildClient();
    const account = await client.account();
    const balance = Number.parseFloat(account.BALANCE_AMOUNT);
    return {
      balance: Number.isNaN(balance) ? undefined : balance,
      currency: "EUR",
      reportThreshold: String(account.BALANCE_LOW_LIMIT),
      blockThreshold: String(account.BALANCE_HARD_LIMIT),
      autoRenew: account.DOMAIN_AUTO_RENEW === "1",
      details: {
        BALANCE_AMOUNT: account.BALANCE_AMOUNT,
        BALANCE_LOW_LIMIT: account.BALANCE_LOW_LIMIT,
        BALANCE_HARD_LIMIT: account.BALANCE_HARD_LIMIT,
      },
    };
  }

  async search(domains: string[], withPrice: boolean): Promise<SearchResponse> {
    const client = buildClient();
    const results: SearchResponse = { results: {}, prices: {} };

    for (const domain of domains) {
      try {
        const check = await client.check(domain);
        const item = check[domain];
        if (item) {
          const normalized = (item.result || "unknown").toLowerCase();
          results.results[domain] = {
            result:
              normalized === "available"
                ? "available"
                : normalized === "premium"
                  ? "premium"
                  : normalized === "unavailable"
                    ? "unavailable"
                    : "unknown",
            reason: item.reason,
          };
        }
      } catch {
        // Continue best-effort search behavior.
      }
    }

    if (withPrice) {
      for (const domain of domains) {
        try {
          const price = await client.price(domain);
          results.prices[domain] = price.priceCreate;
        } catch {
          // Price endpoint failures are non-fatal.
        }
      }
    }

    return results;
  }

  async buy(
    domain: string,
    options: RegisterOptions,
  ): Promise<OperationResult> {
    const credentials = ensureNetimCredentials();
    const client = buildClient();
    let ownerId =
      normalizeContactId(options.ownerId) ||
      normalizeContactId(credentials.defaultOwner);
    let adminId = normalizeContactId(credentials.defaultAdmin);
    let techId = normalizeContactId(credentials.defaultTech);
    let billingId = normalizeContactId(credentials.defaultBilling);
    let ns1 = options.nameservers?.[0] || credentials.defaultNs?.[0];
    let ns2 = options.nameservers?.[1] || credentials.defaultNs?.[1];

    if (!ownerId || !adminId || !techId || !billingId || !ns1 || !ns2) {
      try {
        const account = await client.account();
        const accountOwner = normalizeNetimField(account.DEFAULT_OWNER);
        const accountAdmin = normalizeNetimField(account.DEFAULT_ADMIN);
        const accountTech = normalizeNetimField(account.DEFAULT_TECH);
        const accountBilling = normalizeNetimField(account.DEFAULT_BILLING);
        const accountNs1 = normalizeNetimField(account.DEFAULT_DNS_1);
        const accountNs2 = normalizeNetimField(account.DEFAULT_DNS_2);

        ownerId = ownerId || accountOwner;
        adminId = adminId || accountAdmin;
        techId = techId || accountTech;
        billingId = billingId || accountBilling;
        ns1 = ns1 || accountNs1;
        ns2 = ns2 || accountNs2;

        const nextDefaults: Partial<NetimCredentials> = {};
        if (!credentials.defaultOwner && accountOwner)
          nextDefaults.defaultOwner = accountOwner;
        if (!credentials.defaultAdmin && accountAdmin)
          nextDefaults.defaultAdmin = accountAdmin;
        if (!credentials.defaultTech && accountTech)
          nextDefaults.defaultTech = accountTech;
        if (!credentials.defaultBilling && accountBilling)
          nextDefaults.defaultBilling = accountBilling;
        if (!credentials.defaultNs?.[0] && accountNs1) {
          nextDefaults.defaultNs = [accountNs1, accountNs2 || "ns2.netim.net"];
        }
        if (Object.keys(nextDefaults).length > 0) {
          persistNetimCredentialDefaults(nextDefaults);
        }
      } catch {
        // Keep best-effort behavior and rely on explicit values below.
      }
    }

    if (!ownerId) {
      throw new Error(
        "Could not resolve Netim Owner contact. Re-run with --owner <CONTACT_ID>.",
      );
    }

    adminId = adminId || ownerId;
    techId = techId || ownerId;
    billingId = billingId || ownerId;

    const raw = await client.register(domain, {
      idOwner: ownerId,
      idAdmin: adminId,
      idTech: techId,
      idBilling: billingId,
      ns1,
      ns2,
      duration: options.duration,
    });

    return toOperationResult(raw);
  }

  async domains(): Promise<DomainSummary[]> {
    const client = buildClient();
    const result = (await client.list()) as unknown;
    if (!Array.isArray(result)) return [];
    return result.map((item: unknown) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        domainName: String(value.domainName || value.domain || ""),
        dateExpiration: value.dateExpiration
          ? String(value.dateExpiration)
          : undefined,
        autoRenew: value.autoRenew === 1 || value.autoRenew === true,
        status: value.status ? String(value.status) : undefined,
      };
    });
  }

  async info(domain: string): Promise<DomainInfo> {
    const client = buildClient();
    const data = await client.info(domain);
    const nameservers = [data.ns1, data.ns2, data.ns3].filter(
      (ns): ns is string => Boolean(ns),
    );
    return {
      domainName: data.domainName || domain,
      status: data.status,
      dateCreate: data.dateCreate,
      dateExpiration: data.dateExpiration,
      nameservers,
      ownerId: data.idOwner,
      whoisPrivacy: Boolean(data.whoisPrivacy),
      autoRenew: Boolean(data.autoRenew),
      registrarLock: Boolean(data.registrarLock),
      raw: data,
    };
  }

  async renew(domain: string, duration: number): Promise<OperationResult> {
    const client = buildClient();
    const raw = await client.renew(domain, duration);
    return toOperationResult(raw);
  }

  async setPreference(
    domain: string,
    preference: ProviderPreference,
    enabled: boolean,
  ): Promise<OperationResult> {
    const client = buildClient();
    let raw: RawOperation;
    switch (preference) {
      case "whois-privacy":
        raw = await client.setPrivacy(domain, enabled);
        break;
      case "auto-renew":
        raw = await client.setAutoRenew(domain, enabled);
        break;
      case "lock":
        raw = await client.setLock(domain, enabled);
        break;
      default:
        raw = {
          STATUS: "ERROR",
          message: `Unsupported preference ${preference}=${boolToOp(enabled)}`,
        };
        break;
    }
    return toOperationResult(raw);
  }

  async dnsList(domain: string): Promise<DnsRecord[]> {
    const client = buildClient();
    const zone = await client.zone(domain);
    if (!Array.isArray(zone)) return [];

    return zone.map((record: unknown) => {
      const value = (record ?? {}) as Record<string, unknown>;
      const options = (value.options ?? {}) as Record<string, unknown>;
      return {
        id: value.id ? String(value.id) : undefined,
        subdomain: String(value.subdomain || "@"),
        type: String(value.type || "").toUpperCase(),
        value: String(value.value || ""),
        ttl: typeof options.ttl === "number" ? options.ttl : undefined,
        priority:
          typeof options.priority === "number" ||
          typeof options.priority === "string"
            ? options.priority
            : null,
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
    const client = buildClient();
    const raw = await client.zoneAdd(domain, subdomain, type, value, {
      ttl: options.ttl,
      priority: options.priority ?? null,
    });
    return toOperationResult(raw);
  }

  async dnsRemove(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
  ): Promise<OperationResult> {
    const client = buildClient();
    const raw = await client.zoneDel(domain, subdomain, type, value);
    return toOperationResult(raw);
  }

  async dnsUpdate(
    domain: string,
    type: string,
    oldValue: string,
    newValue: string,
    subdomain: string,
    ttl: number,
  ): Promise<OperationResult> {
    const client = buildClient();
    const raw = await client.zoneUpdate(
      domain,
      subdomain,
      type,
      oldValue,
      newValue,
      ttl,
    );
    return toOperationResult(raw);
  }

  async dnsNs(domain: string, servers: string[]): Promise<OperationResult> {
    const client = buildClient();
    const raw = await client.changeDns(domain, servers);
    return toOperationResult(raw);
  }
}
