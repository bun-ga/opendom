import { CloudflareProvider } from "./cloudflare/provider.js";
import { NamecheapProvider } from "./namecheap/provider.js";
import { NetimProvider } from "./netim/provider.js";
import { PorkbunProvider } from "./porkbun/provider.js";
import type { ProviderAdapter, ProviderId } from "./types.js";

export function createProvider(provider: ProviderId): ProviderAdapter {
  switch (provider) {
    case "netim":
      return new NetimProvider();
    case "cloudflare":
      return new CloudflareProvider();
    case "porkbun":
      return new PorkbunProvider();
    case "namecheap":
      return new NamecheapProvider();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
