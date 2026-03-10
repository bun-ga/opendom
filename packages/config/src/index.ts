import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  type SecretStorageAdapter,
  createEncryptedSecretStorage,
} from "./encryption.js";

export type ProviderId = "netim" | "cloudflare" | "porkbun" | "namecheap";

export interface NetimCredentials {
  resellerId: string;
  apiSecret: string;
  defaultNs?: string[];
  defaultOwner?: string;
  defaultAdmin?: string;
  defaultTech?: string;
  defaultBilling?: string;
}

export interface CloudflareCredentials {
  token: string;
  accountId?: string;
}

export interface PorkbunCredentials {
  apikey: string;
  secretapikey: string;
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

export interface NamecheapCredentials {
  apiUser: string;
  username: string;
  apiKey: string;
  clientIp: string;
  sandbox?: boolean;
  addressId?: string;
  contact?: NamecheapContact;
}

export interface ProviderSession {
  token?: string;
  expiry?: number;
}

export type ProviderSecretStorageMode = "encrypted" | "plaintext" | "keychain";

export interface ProviderSecretStorage {
  mode: ProviderSecretStorageMode;
}

export interface ProviderState<TCredentials = Record<string, unknown>> {
  env?: string;
  credentials: Partial<TCredentials> & Record<string, unknown>;
  session?: ProviderSession;
  secretStorage?: ProviderSecretStorage;
}

export interface Config {
  schemaVersion: 2;
  defaults?: {
    provider?: ProviderId;
  };
  providers: {
    netim?: ProviderState<NetimCredentials>;
    cloudflare?: ProviderState<CloudflareCredentials>;
    porkbun?: ProviderState<PorkbunCredentials>;
    namecheap?: ProviderState<NamecheapCredentials>;
  };
}

interface LegacyConfig {
  resellerId: string;
  apiSecret: string;
  ote?: boolean;
  sessionToken?: string;
  sessionExpiry?: number;
  defaultNs?: string[];
  defaultOwner?: string;
  defaultAdmin?: string;
  defaultTech?: string;
  defaultBilling?: string;
}

interface SecretPayload {
  credentials: Record<string, string>;
  sessionToken?: string;
}

const PROVIDERS: ProviderId[] = ["netim", "cloudflare", "porkbun", "namecheap"];

const SECRET_CREDENTIAL_KEYS: Record<ProviderId, readonly string[]> = {
  netim: ["apiSecret"],
  cloudflare: ["token"],
  porkbun: ["apikey", "secretapikey"],
  namecheap: ["apiKey"],
};

const DEFAULT_DIR = join(homedir(), ".config", "opendom");
const DEFAULT_FILE = join(DEFAULT_DIR, "config.json");
const DEFAULT_LEGACY_BACKUP_FILE = join(DEFAULT_DIR, "config.json.bak-v1");

let configDir = DEFAULT_DIR;
let configFile = DEFAULT_FILE;
let legacyBackupFile = DEFAULT_LEGACY_BACKUP_FILE;
let secretStorageAdapter: SecretStorageAdapter | null =
  createDefaultSecretStorageAdapter();

export let configPath = configFile;

function createDefaultSecretStorageAdapter(): SecretStorageAdapter | null {
  return createEncryptedSecretStorage();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseConfig(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function isV2Config(value: unknown): value is Config {
  if (!isObject(value)) return false;
  if (value.schemaVersion !== 2) return false;
  if (!isObject(value.providers)) return false;
  return true;
}

function isLegacyConfig(value: unknown): value is LegacyConfig {
  if (!isObject(value)) return false;
  return (
    typeof value.resellerId === "string" && typeof value.apiSecret === "string"
  );
}

function ensureDir(): void {
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
}

function write(cfg: Config): void {
  ensureDir();
  writeFileSync(configFile, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function migrateLegacy(legacy: LegacyConfig): Config {
  const netimState: ProviderState<NetimCredentials> = {
    env: legacy.ote ? "ote" : "prod",
    credentials: {
      resellerId: legacy.resellerId,
      apiSecret: legacy.apiSecret,
      defaultNs: legacy.defaultNs,
      defaultOwner: legacy.defaultOwner,
      defaultAdmin: legacy.defaultAdmin,
      defaultTech: legacy.defaultTech,
      defaultBilling: legacy.defaultBilling,
    },
    session: {
      token: legacy.sessionToken,
      expiry: legacy.sessionExpiry,
    },
  };

  return {
    schemaVersion: 2,
    defaults: { provider: "netim" },
    providers: {
      netim: netimState,
    },
  };
}

function maybeBackupLegacy(): void {
  if (!existsSync(configFile)) return;
  if (existsSync(legacyBackupFile)) return;
  ensureDir();
  copyFileSync(configFile, legacyBackupFile);
}

function cloneProviderState(state: ProviderState): ProviderState {
  const credentials = isObject(state.credentials)
    ? { ...state.credentials }
    : {};
  const session = state.session ? { ...state.session } : undefined;
  const secretStorage = state.secretStorage
    ? { ...state.secretStorage }
    : undefined;
  return {
    ...state,
    credentials,
    session,
    secretStorage,
  };
}

function secretAccount(provider: ProviderId): string {
  return `provider:${provider}`;
}

function readSecretPayload(provider: ProviderId): SecretPayload | undefined {
  if (!secretStorageAdapter) return undefined;
  const raw = secretStorageAdapter.read(secretAccount(provider));
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return undefined;
    const credentials = isObject(parsed.credentials) ? parsed.credentials : {};
    const secretCredentials: Record<string, string> = {};
    for (const key of SECRET_CREDENTIAL_KEYS[provider]) {
      const value = credentials[key];
      if (typeof value === "string" && value.length > 0) {
        secretCredentials[key] = value;
      }
    }
    const sessionToken =
      typeof parsed.sessionToken === "string" && parsed.sessionToken.length > 0
        ? parsed.sessionToken
        : undefined;
    if (Object.keys(secretCredentials).length === 0 && !sessionToken) {
      return undefined;
    }
    return {
      credentials: secretCredentials,
      sessionToken,
    };
  } catch {
    return undefined;
  }
}

function writeSecretPayload(
  provider: ProviderId,
  payload: SecretPayload,
): boolean {
  if (!secretStorageAdapter) return false;
  const account = secretAccount(provider);
  if (!secretStorageAdapter.write(account, JSON.stringify(payload))) {
    return false;
  }

  // Require round-trip readability to avoid persisting an unreadable secret storage state.
  const roundTrip = readSecretPayload(provider);
  if (!roundTrip) {
    return false;
  }

  if (roundTrip.sessionToken !== payload.sessionToken) {
    return false;
  }
  for (const [key, value] of Object.entries(payload.credentials)) {
    if (roundTrip.credentials[key] !== value) {
      return false;
    }
  }
  return true;
}

function removeSecretPayload(provider: ProviderId): void {
  secretStorageAdapter?.remove(secretAccount(provider));
}

function extractSecretPayload(
  provider: ProviderId,
  state: ProviderState,
): SecretPayload | undefined {
  const source = isObject(state.credentials) ? state.credentials : {};
  const credentials: Record<string, string> = {};
  for (const key of SECRET_CREDENTIAL_KEYS[provider]) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      credentials[key] = value;
    }
  }
  const sessionToken =
    typeof state.session?.token === "string" && state.session.token.length > 0
      ? state.session.token
      : undefined;
  if (Object.keys(credentials).length === 0 && !sessionToken) {
    return undefined;
  }
  return { credentials, sessionToken };
}

function stripSecretsForFile(
  provider: ProviderId,
  state: ProviderState,
): ProviderState {
  const next = cloneProviderState(state);
  const credentials = isObject(next.credentials) ? next.credentials : {};
  for (const key of SECRET_CREDENTIAL_KEYS[provider]) {
    delete credentials[key];
  }
  next.credentials = credentials;

  if (next.session) {
    next.session.token = undefined;
    if (next.session.expiry === undefined) {
      next.session = undefined;
    }
  }
  next.secretStorage = { mode: "encrypted" };
  return next;
}

function markPlaintextStorage(state: ProviderState): ProviderState {
  const next = cloneProviderState(state);
  next.secretStorage = { mode: "plaintext" };
  return next;
}

function hydrateProviderState(
  provider: ProviderId,
  state: ProviderState,
): ProviderState {
  const hydrated = cloneProviderState(state);
  if (hydrated.secretStorage?.mode !== "encrypted") {
    return hydrated;
  }
  const payload = readSecretPayload(provider);
  if (!payload) {
    return hydrated;
  }

  const credentials = isObject(hydrated.credentials)
    ? hydrated.credentials
    : {};
  for (const [key, value] of Object.entries(payload.credentials)) {
    credentials[key] = value;
  }
  hydrated.credentials = credentials;
  if (payload.sessionToken) {
    hydrated.session = {
      ...(hydrated.session ?? {}),
      token: payload.sessionToken,
    };
  }
  return hydrated;
}

function backfillMissingSecrets(
  provider: ProviderId,
  state: ProviderState,
): ProviderState {
  const next = cloneProviderState(state);
  const existing = getProvider(provider);
  if (!existing) return next;

  const currentCredentials = isObject(existing.credentials)
    ? existing.credentials
    : {};
  const nextCredentials = isObject(next.credentials) ? next.credentials : {};

  for (const key of SECRET_CREDENTIAL_KEYS[provider]) {
    const incoming = nextCredentials[key];
    if (typeof incoming === "string" && incoming.length > 0) continue;
    const current = currentCredentials[key];
    if (typeof current === "string" && current.length > 0) {
      nextCredentials[key] = current;
    }
  }

  next.credentials = nextCredentials;

  if (typeof next.session?.token !== "string") {
    const token = existing.session?.token;
    if (typeof token === "string" && token.length > 0) {
      next.session = { ...(next.session ?? {}), token };
    }
  }

  return next;
}

function upgradeConfigSecretStorage(cfg: Config): boolean {
  let changed = false;
  for (const provider of PROVIDERS) {
    const state = cfg.providers[provider] as ProviderState | undefined;
    if (!state) continue;

    if (state.secretStorage?.mode === "keychain") {
      const next = cloneProviderState(state);
      next.secretStorage = { mode: "plaintext" };
      cfg.providers[provider] = next as never;
      changed = true;
      continue;
    }

    if (state.secretStorage?.mode) continue;

    const payload = extractSecretPayload(provider, state);
    if (!payload) continue;

    cfg.providers[provider] = (
      writeSecretPayload(provider, payload)
        ? stripSecretsForFile(provider, state)
        : markPlaintextStorage(state)
    ) as never;
    changed = true;
  }
  return changed;
}

export function load(): Config | null {
  try {
    if (!existsSync(configFile)) return null;
    const raw = readFileSync(configFile, "utf8");
    const parsed = parseConfig(raw);

    if (isV2Config(parsed)) {
      if (upgradeConfigSecretStorage(parsed)) {
        write(parsed);
      }
      return parsed;
    }

    if (isLegacyConfig(parsed)) {
      maybeBackupLegacy();
      const migrated = migrateLegacy(parsed);
      upgradeConfigSecretStorage(migrated);
      write(migrated);
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export function save(cfg: Config): void {
  write(cfg);
}

export function clear(): void {
  if (existsSync(configFile)) unlinkSync(configFile);
}

export function clearAll(): void {
  for (const provider of PROVIDERS) {
    removeSecretPayload(provider);
  }
  clear();
}

export function clearProvider(provider: ProviderId): void {
  const cfg = load();
  if (!cfg) return;

  removeSecretPayload(provider);
  delete cfg.providers[provider];
  if (Object.keys(cfg.providers).length === 0) {
    clear();
    return;
  }
  if (cfg.defaults?.provider === provider) {
    cfg.defaults.provider = undefined;
  }
  save(cfg);
}

export function getProvider(provider: ProviderId): ProviderState | undefined {
  const cfg = load();
  const rawState = cfg?.providers[provider] as ProviderState | undefined;
  if (!rawState) return undefined;
  return hydrateProviderState(provider, rawState);
}

export function requireProvider(provider: ProviderId): ProviderState {
  const state = getProvider(provider);
  if (!state) {
    throw new Error(
      `Provider '${provider}' is not configured. Run: opendom login ${provider}`,
    );
  }
  return state;
}

export function setProvider(
  provider: ProviderId,
  state: ProviderState,
  defaultProvider = false,
): Config {
  const cfg = load() ?? { schemaVersion: 2 as const, providers: {} };
  const completeState = backfillMissingSecrets(provider, state);
  const payload = extractSecretPayload(provider, completeState);

  let stateForFile: ProviderState;
  if (payload && writeSecretPayload(provider, payload)) {
    stateForFile = stripSecretsForFile(provider, completeState);
  } else {
    stateForFile = markPlaintextStorage(completeState);
    if (!payload) {
      removeSecretPayload(provider);
    }
  }

  cfg.providers[provider] = stateForFile as never;
  if (defaultProvider) {
    cfg.defaults = cfg.defaults ?? {};
    cfg.defaults.provider = provider;
  }
  save(cfg);
  return cfg;
}

export function setProviderSession(
  provider: ProviderId,
  session: ProviderSession | undefined,
): void {
  const cfg = load();
  if (!cfg) return;
  const current = cfg.providers[provider] as ProviderState | undefined;
  if (!current) return;

  const next = cloneProviderState(current);
  next.session = session ? { ...session } : undefined;

  if (next.secretStorage?.mode === "encrypted") {
    const payload = readSecretPayload(provider);
    if (payload) {
      if (typeof session?.token === "string" && session.token.length > 0) {
        payload.sessionToken = session.token;
      } else {
        payload.sessionToken = undefined;
      }
      if (writeSecretPayload(provider, payload) && next.session) {
        next.session.token = undefined;
      }
    }
    if (next.session?.token && next.secretStorage?.mode === "encrypted") {
      next.session.token = undefined;
    }
    if (next.session?.token && next.secretStorage?.mode === "encrypted") {
      next.session.token = undefined;
    }
    if (next.session && next.session.expiry === undefined) {
      next.session = undefined;
    }
  } else {
    next.secretStorage = { mode: "plaintext" };
  }

  cfg.providers[provider] = next as never;
  save(cfg);
}

export function setDefaultProvider(provider: ProviderId): void {
  const cfg = load() ?? { schemaVersion: 2 as const, providers: {} };
  cfg.defaults = cfg.defaults ?? {};
  cfg.defaults.provider = provider;
  save(cfg);
}

export function getDefaultProvider(): ProviderId | undefined {
  return load()?.defaults?.provider;
}

export function listConfiguredProviders(): ProviderId[] {
  const cfg = load();
  if (!cfg) return [];
  return (Object.keys(cfg.providers) as ProviderId[]).filter((provider) =>
    Boolean(cfg.providers[provider]),
  );
}

export function getProviderSecretStorageMode(
  provider: ProviderId,
): ProviderSecretStorageMode | undefined {
  const cfg = load();
  const state = cfg?.providers[provider] as ProviderState | undefined;
  return state?.secretStorage?.mode;
}

export function __setSecretStorageAdapterForTests(
  adapter?: SecretStorageAdapter | null,
): void {
  secretStorageAdapter =
    adapter === undefined ? createDefaultSecretStorageAdapter() : adapter;
}

export function __setConfigPathForTests(path?: string): void {
  if (!path) {
    configDir = DEFAULT_DIR;
    configFile = DEFAULT_FILE;
    legacyBackupFile = DEFAULT_LEGACY_BACKUP_FILE;
    configPath = configFile;
    return;
  }
  configFile = path;
  configDir = dirname(path);
  legacyBackupFile = `${path}.bak-v1`;
  configPath = configFile;
}
