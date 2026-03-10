export type ProviderId = "netim" | "cloudflare" | "porkbun" | "namecheap";

export type ProviderPreference = "whois-privacy" | "auto-renew" | "lock";

export type DomainStatus = "available" | "unavailable" | "premium" | "unknown";

export interface DomainCheck {
  result: DomainStatus;
  reason?: string;
}

export type DomainCheckMap = Record<string, DomainCheck>;

export interface SearchResponse {
  results: DomainCheckMap;
  prices: Record<string, number>;
}

export interface OperationResult {
  status: "DONE" | "PENDING" | "ERROR";
  message?: string;
  operationId?: number | string;
  raw?: unknown;
}

export interface DomainSummary {
  domainName: string;
  dateExpiration?: string;
  autoRenew?: boolean;
  status?: string;
}

export interface DomainInfo {
  domainName: string;
  status?: string;
  dateCreate?: string;
  dateExpiration?: string;
  nameservers?: string[];
  ownerId?: string;
  whoisPrivacy?: boolean;
  autoRenew?: boolean;
  registrarLock?: boolean;
  raw?: unknown;
}

export interface DnsRecord {
  id?: string;
  subdomain: string;
  type: string;
  value: string;
  ttl?: number;
  priority?: number | string | null;
}

export interface AccountInfo {
  balance?: number;
  currency?: string;
  reportThreshold?: string;
  blockThreshold?: string;
  autoRenew?: boolean;
  details?: Record<string, string | number | boolean | null | undefined>;
}

export interface RegisterOptions {
  duration: number;
  ownerId?: string;
  addressId?: string;
  nameservers?: string[];
}

export interface DnsSetOptions {
  ttl?: number;
  priority?: string | null;
}

export interface ProviderAuthInput {
  [key: string]: string | boolean | undefined;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  login(input: ProviderAuthInput): Promise<void>;
  logout(): Promise<void>;
  balance(): Promise<AccountInfo>;
  search(domains: string[], withPrice: boolean): Promise<SearchResponse>;
  buy(domain: string, options: RegisterOptions): Promise<OperationResult>;
  domains(): Promise<DomainSummary[]>;
  info(domain: string): Promise<DomainInfo>;
  renew(domain: string, duration: number): Promise<OperationResult>;
  setPreference(
    domain: string,
    preference: ProviderPreference,
    enabled: boolean,
  ): Promise<OperationResult>;
  dnsList(domain: string): Promise<DnsRecord[]>;
  dnsSet(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
    options: DnsSetOptions,
  ): Promise<OperationResult>;
  dnsRemove(
    domain: string,
    type: string,
    value: string,
    subdomain: string,
  ): Promise<OperationResult>;
  dnsUpdate(
    domain: string,
    type: string,
    oldValue: string,
    newValue: string,
    subdomain: string,
    ttl: number,
  ): Promise<OperationResult>;
  dnsNs(domain: string, servers: string[]): Promise<OperationResult>;
}
