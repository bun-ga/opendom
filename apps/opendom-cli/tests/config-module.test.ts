import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ConfigModule = typeof import("../src/config/index.js");

interface TestSecretStorageAdapter {
  read(account: string): string | undefined;
  write(account: string, value: string): boolean;
  remove(account: string): void;
}

function createMemorySecretStorageAdapter(allowWrite = true): {
  adapter: TestSecretStorageAdapter;
  entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  const adapter: TestSecretStorageAdapter = {
    read(account: string): string | undefined {
      return entries.get(account);
    },
    write(account: string, value: string): boolean {
      if (!allowWrite) return false;
      entries.set(account, value);
      return true;
    },
    remove(account: string): void {
      entries.delete(account);
    },
  };
  return { adapter, entries };
}

function readStoredConfig(configPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(configPath, "utf8")) as Record<
    string,
    unknown
  >;
}

const testDir = mkdtempSync(join(tmpdir(), "opendom-config-tests-"));
const testConfigPath = join(testDir, "config.json");

let cfg: ConfigModule;

beforeAll(async () => {
  cfg = await import("../src/config/index.js");
  cfg.__setConfigPathForTests(testConfigPath);
});

beforeEach(() => {
  cfg.__setSecretStorageAdapterForTests(null);
  cfg.clearAll();
});

afterAll(() => {
  cfg.clearAll();
  cfg.__setSecretStorageAdapterForTests(undefined);
  cfg.__setConfigPathForTests(undefined);
  rmSync(testDir, { recursive: true, force: true });
});

test("configPath can be redirected for isolated tests", () => {
  expect(cfg.configPath).toBe(testConfigPath);
});

test("stores secrets in encrypted storage and keeps config file redacted", () => {
  const { adapter, entries } = createMemorySecretStorageAdapter(true);
  cfg.__setSecretStorageAdapterForTests(adapter as never);

  cfg.setProvider(
    "cloudflare",
    {
      env: "prod",
      credentials: {
        token: "CF_TOKEN_123",
        accountId: "acct-42",
      },
    },
    false,
  );

  const stored = readStoredConfig(testConfigPath) as {
    providers: {
      cloudflare?: {
        credentials?: Record<string, unknown>;
        secretStorage?: { mode?: string };
      };
    };
  };
  expect(stored.providers.cloudflare?.credentials?.token).toBeUndefined();
  expect(stored.providers.cloudflare?.credentials?.accountId).toBe("acct-42");
  expect(stored.providers.cloudflare?.secretStorage?.mode).toBe("encrypted");

  const payload = entries.get("provider:cloudflare");
  expect(payload).toBeDefined();
  const parsedPayload = JSON.parse(payload || "{}") as {
    credentials?: Record<string, unknown>;
  };
  expect(parsedPayload.credentials?.token).toBe("CF_TOKEN_123");

  const state = cfg.getProvider("cloudflare");
  const credentials = state?.credentials as Record<string, unknown> | undefined;
  expect(credentials?.token).toBe("CF_TOKEN_123");
  expect(credentials?.accountId).toBe("acct-42");
});

test("falls back to plaintext when encrypted storage write fails", () => {
  const { adapter } = createMemorySecretStorageAdapter(false);
  cfg.__setSecretStorageAdapterForTests(adapter as never);

  cfg.setProvider(
    "netim",
    {
      env: "prod",
      credentials: {
        resellerId: "RID-1",
        apiSecret: "SECRET-1",
      },
    },
    true,
  );

  const stored = readStoredConfig(testConfigPath) as {
    providers: {
      netim?: {
        credentials?: Record<string, unknown>;
        secretStorage?: { mode?: string };
      };
    };
  };
  expect(stored.providers.netim?.credentials?.apiSecret).toBe("SECRET-1");
  expect(stored.providers.netim?.secretStorage?.mode).toBe("plaintext");
  expect(cfg.getProviderSecretStorageMode("netim")).toBe("plaintext");
});

test("falls back to plaintext when encrypted storage write succeeds but round-trip read fails", () => {
  const adapter: TestSecretStorageAdapter = {
    read(): string | undefined {
      return undefined;
    },
    write(): boolean {
      return true;
    },
    remove(): void {
      // no-op
    },
  };
  cfg.__setSecretStorageAdapterForTests(adapter as never);

  cfg.setProvider(
    "namecheap",
    {
      env: "prod",
      credentials: {
        apiUser: "user-a",
        username: "user-b",
        apiKey: "NC_SECRET",
        clientIp: "203.0.113.10",
      },
    },
    false,
  );

  const stored = readStoredConfig(testConfigPath) as {
    providers: {
      namecheap?: {
        credentials?: Record<string, unknown>;
        secretStorage?: { mode?: string };
      };
    };
  };
  expect(stored.providers.namecheap?.credentials?.apiKey).toBe("NC_SECRET");
  expect(stored.providers.namecheap?.secretStorage?.mode).toBe("plaintext");
});

test("migrates plaintext secrets to encrypted storage on load", () => {
  const { adapter, entries } = createMemorySecretStorageAdapter(true);
  cfg.__setSecretStorageAdapterForTests(adapter as never);

  writeFileSync(
    testConfigPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        providers: {
          porkbun: {
            env: "prod",
            credentials: {
              apikey: "PB_API",
              secretapikey: "PB_SECRET",
            },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const loaded = cfg.load();
  expect(loaded).not.toBeNull();

  const stored = readStoredConfig(testConfigPath) as {
    providers: {
      porkbun?: {
        credentials?: Record<string, unknown>;
        secretStorage?: { mode?: string };
      };
    };
  };
  expect(stored.providers.porkbun?.credentials?.apikey).toBeUndefined();
  expect(stored.providers.porkbun?.credentials?.secretapikey).toBeUndefined();
  expect(stored.providers.porkbun?.secretStorage?.mode).toBe("encrypted");

  const payload = entries.get("provider:porkbun");
  expect(payload).toBeDefined();
});

test("clearProvider removes encrypted secret entry", () => {
  const { adapter, entries } = createMemorySecretStorageAdapter(true);
  cfg.__setSecretStorageAdapterForTests(adapter as never);

  cfg.setProvider(
    "namecheap",
    {
      env: "prod",
      credentials: {
        apiUser: "user-a",
        username: "user-b",
        apiKey: "NC_SECRET",
        clientIp: "203.0.113.10",
      },
    },
    false,
  );

  expect(entries.has("provider:namecheap")).toBe(true);
  cfg.clearProvider("namecheap");
  expect(entries.has("provider:namecheap")).toBe(false);
  expect(cfg.getProvider("namecheap")).toBeUndefined();
});

test("setDefaultProvider persists and clearProvider removes the default", () => {
  cfg.setProvider(
    "cloudflare",
    {
      env: "prod",
      credentials: {
        token: "CF_TOKEN_123",
      },
    },
    false,
  );

  cfg.setDefaultProvider("cloudflare");
  expect(cfg.getDefaultProvider()).toBe("cloudflare");

  cfg.clearProvider("cloudflare");
  expect(cfg.getDefaultProvider()).toBeUndefined();
});
