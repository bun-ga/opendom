import type { ProviderId } from "./types.js";

export class CapabilityError extends Error {
  readonly provider: ProviderId;
  readonly capability: string;

  constructor(provider: ProviderId, capability: string, message: string) {
    super(message);
    this.name = "CapabilityError";
    this.provider = provider;
    this.capability = capability;
  }
}

export class AuthError extends Error {
  readonly provider: ProviderId;
  readonly code?: string;

  constructor(provider: ProviderId, message: string, code?: string) {
    super(message);
    this.name = "AuthError";
    this.provider = provider;
    this.code = code;
  }
}

export class RateLimitError extends Error {
  readonly provider: ProviderId;
  readonly retryAfterMs?: number;

  constructor(provider: ProviderId, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderConstraintError extends Error {
  readonly provider: ProviderId;

  constructor(provider: ProviderId, message: string) {
    super(message);
    this.name = "ProviderConstraintError";
    this.provider = provider;
  }
}
