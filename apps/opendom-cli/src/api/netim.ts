const PROD = "https://rest.netim.com/3.0";
const OTE = "http://oterest.netim.com/1.0";

export interface NetimSession {
  token?: string;
  expiry?: number;
}

export interface NetimOptions {
  resellerId: string;
  apiSecret: string;
  ote?: boolean;
  session?: NetimSession;
  onSessionChange?: (session: NetimSession | undefined) => void;
}

export interface CheckResult {
  [domain: string]: { result: string; reason?: string };
}

export interface DomainPrice {
  currency: string;
  priceCreate: number;
  priceRenew: number;
  priceTransfer: number;
  priceRestore: number;
  [k: string]: unknown;
}

export interface DomainInfo {
  domainName: string;
  idOwner: string;
  ns1: string;
  ns2: string;
  ns3?: string;
  dateCreate?: string;
  dateExpiration?: string;
  status?: string;
  whoisPrivacy?: number;
  autoRenew?: number;
  registrarLock?: number;
  [k: string]: unknown;
}

export interface Account {
  BALANCE_AMOUNT: string;
  BALANCE_LOW_LIMIT: string;
  BALANCE_HARD_LIMIT: string;
  DOMAIN_AUTO_RENEW: string;
  [k: string]: unknown;
}

export interface OpResult {
  STATUS: string;
  message?: string;
  operationId?: number;
  [k: string]: unknown;
}

class ApiError extends Error {
  code: number;

  constructor(msg: string, code: number) {
    super(msg);
    this.name = "ApiError";
    this.code = code;
  }
}

export class Netim {
  private readonly url: string;
  private readonly resellerId: string;
  private readonly apiSecret: string;
  private readonly onSessionChange?: (
    session: NetimSession | undefined,
  ) => void;
  private token: string | null = null;

  constructor(opts: NetimOptions) {
    this.url = opts.ote ? OTE : PROD;
    this.resellerId = opts.resellerId;
    this.apiSecret = opts.apiSecret;
    this.onSessionChange = opts.onSessionChange;

    if (
      opts.session?.token &&
      opts.session.expiry &&
      Date.now() < opts.session.expiry
    ) {
      this.token = opts.session.token;
    }
  }

  async open(): Promise<string> {
    const auth = Buffer.from(`${this.resellerId}:${this.apiSecret}`).toString(
      "base64",
    );
    const res = await fetch(`${this.url}/session/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Accept-Language": "EN",
      },
      body: JSON.stringify({ preferences: { lang: "EN", sync: 1, notif: 0 } }),
    });

    if (!res.ok) {
      throw new ApiError(
        `Auth failed (${res.status}): ${await res.text()}`,
        res.status,
      );
    }

    const data = (await res.json()) as { access_token: string };
    this.token = data.access_token;
    this.onSessionChange?.({
      token: this.token,
      expiry: Date.now() + 50 * 60_000,
    });
    return this.token;
  }

  async close(): Promise<void> {
    if (!this.token) return;
    try {
      await this.req("DELETE", "/session/");
    } catch {
      // Ignore remote close failures during logout cleanup.
    }
    this.token = null;
    this.onSessionChange?.(undefined);
  }

  private async ensure(): Promise<void> {
    if (this.token) return;
    await this.open();
  }

  private async req<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensure();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body) {
      init.body = JSON.stringify(body);
    }

    let res = await fetch(`${this.url}${path}`, init);

    if (res.status === 401) {
      this.token = null;
      await this.ensure();
      headers.Authorization = `Bearer ${this.token}`;
      res = await fetch(`${this.url}${path}`, { ...init, headers });
    }

    if (!res.ok) {
      throw new ApiError(`(${res.status}) ${await res.text()}`, res.status);
    }

    const txt = await res.text();
    if (!txt) return {} as T;
    try {
      return JSON.parse(txt) as T;
    } catch {
      return txt as unknown as T;
    }
  }

  async check(domains: string | string[]): Promise<CheckResult> {
    const q = Array.isArray(domains) ? domains.join(";") : domains;
    const raw = await this.req<
      Array<{ domain: string; result: string; reason?: string }>
    >("GET", `/domain/${encodeURIComponent(q)}/check/`);
    const map: CheckResult = {};
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        map[entry.domain] = { result: entry.result, reason: entry.reason };
      }
    }
    return map;
  }

  price(domain: string): Promise<DomainPrice> {
    return this.req("GET", `/domain/${encodeURIComponent(domain)}/price/`);
  }

  register(
    domain: string,
    o: {
      idOwner: string;
      idAdmin?: string;
      idTech?: string;
      idBilling?: string;
      ns1?: string;
      ns2?: string;
      duration?: number;
    },
  ): Promise<OpResult> {
    const ns1 = o.ns1 || "ns1.netim.net";
    const ns2 = o.ns2 || "ns2.netim.net";
    return this.req("POST", `/domain/${encodeURIComponent(domain)}/`, {
      idOwner: o.idOwner,
      idAdmin: o.idAdmin || o.idOwner,
      idTech: o.idTech || o.idOwner,
      idBilling: o.idBilling || o.idOwner,
      nameservers: { "1": { name: ns1 }, "2": { name: ns2 } },
      duration: o.duration || 1,
    });
  }

  info(domain: string): Promise<DomainInfo> {
    return this.req("GET", `/domain/${encodeURIComponent(domain)}/info/`);
  }

  list(filter = "*"): Promise<unknown> {
    return this.req("GET", `/domains/${encodeURIComponent(filter)}`);
  }

  renew(domain: string, duration = 1): Promise<OpResult> {
    return this.req("PATCH", `/domain/${encodeURIComponent(domain)}/renew/`, {
      duration,
    });
  }

  zone(domain: string): Promise<unknown> {
    return this.req("GET", `/domain/${encodeURIComponent(domain)}/zone/`);
  }

  zoneAdd(
    domain: string,
    subdomain: string,
    type: string,
    value: string,
    opts?: { ttl?: number; priority?: string | null },
  ): Promise<OpResult> {
    return this.req("POST", `/domain/${encodeURIComponent(domain)}/zone/`, {
      subdomain,
      type,
      value,
      options: {
        service: null,
        protocol: null,
        ttl: opts?.ttl ?? 3600,
        ttlUnit: "S",
        priority: opts?.priority ?? null,
        weight: null,
        port: null,
      },
    });
  }

  async zoneUpdate(
    domain: string,
    subdomain: string,
    type: string,
    oldVal: string,
    newVal: string,
    ttl = 3600,
  ): Promise<OpResult> {
    await this.zoneDel(domain, subdomain, type, oldVal);
    return this.zoneAdd(domain, subdomain, type, newVal, { ttl });
  }

  zoneDel(
    domain: string,
    subdomain: string,
    type: string,
    value: string,
  ): Promise<OpResult> {
    return this.req("DELETE", `/domain/${encodeURIComponent(domain)}/zone/`, {
      subdomain,
      type,
      value,
    });
  }

  changeDns(domain: string, servers: string[]): Promise<OpResult> {
    const ns: Record<string, { name: string }> = {};
    servers.forEach((s, i) => {
      ns[String(i + 1)] = { name: s };
    });
    return this.req("PUT", `/domain/${encodeURIComponent(domain)}/dns/`, {
      nameservers: ns,
    });
  }

  setPrivacy(domain: string, on: boolean): Promise<OpResult> {
    return this.req(
      "PATCH",
      `/domain/${encodeURIComponent(domain)}/preference/`,
      {
        codePref: "whois_privacy",
        value: on ? "1" : "0",
      },
    );
  }

  setAutoRenew(domain: string, on: boolean): Promise<OpResult> {
    return this.req(
      "PATCH",
      `/domain/${encodeURIComponent(domain)}/preference/`,
      {
        codePref: "auto_renew",
        value: on ? "1" : "0",
      },
    );
  }

  setLock(domain: string, on: boolean): Promise<OpResult> {
    return this.req(
      "PATCH",
      `/domain/${encodeURIComponent(domain)}/preference/`,
      {
        codePref: "registrar_lock",
        value: on ? "1" : "0",
      },
    );
  }

  account(): Promise<Account> {
    return this.req("GET", "/account/");
  }
}
