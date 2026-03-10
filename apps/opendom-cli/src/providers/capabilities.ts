import { CapabilityError } from "./errors.js";
import type { ProviderId } from "./types.js";

export type CapabilityKey =
  | "search"
  | "buy"
  | "domains"
  | "info"
  | "renew"
  | "set"
  | "dns-list"
  | "dns-set"
  | "dns-rm"
  | "dns-update"
  | "dns-ns"
  | "balance";

export type ProviderCapability = Record<CapabilityKey, boolean>;

export const CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  netim: {
    search: true,
    buy: true,
    domains: true,
    info: true,
    renew: true,
    set: true,
    "dns-list": true,
    "dns-set": true,
    "dns-rm": true,
    "dns-update": true,
    "dns-ns": true,
    balance: true,
  },
  cloudflare: {
    search: true,
    buy: false,
    domains: true,
    info: true,
    renew: false,
    set: true,
    "dns-list": true,
    "dns-set": true,
    "dns-rm": true,
    "dns-update": true,
    "dns-ns": false,
    balance: true,
  },
  porkbun: {
    search: true,
    buy: true,
    domains: true,
    info: true,
    renew: false,
    set: true,
    "dns-list": true,
    "dns-set": true,
    "dns-rm": true,
    "dns-update": true,
    "dns-ns": true,
    balance: true,
  },
  namecheap: {
    search: true,
    buy: true,
    domains: true,
    info: true,
    renew: true,
    set: true,
    "dns-list": true,
    "dns-set": true,
    "dns-rm": true,
    "dns-update": true,
    "dns-ns": true,
    balance: true,
  },
};

const COMMAND_HINTS: Record<CapabilityKey, string> = {
  search: "`search` is not available for this provider.",
  buy: "`buy` is not available for this provider. Use provider dashboard.",
  domains: "`domains` is not available for this provider.",
  info: "`info` is not available for this provider.",
  renew: "`renew` is not available for this provider. Use provider dashboard.",
  set: "`set` preferences are not available for this provider.",
  "dns-list": "DNS list is not available for this provider.",
  "dns-set": "DNS set is not available for this provider.",
  "dns-rm": "DNS remove is not available for this provider.",
  "dns-update": "DNS update is not available for this provider.",
  "dns-ns": "Nameserver update is not available for this provider.",
  balance: "Balance endpoint is not available for this provider/account.",
};

export function assertCapability(
  provider: ProviderId,
  capability: CapabilityKey,
): void {
  if (CAPABILITIES[provider][capability]) return;
  throw new CapabilityError(provider, capability, COMMAND_HINTS[capability]);
}
