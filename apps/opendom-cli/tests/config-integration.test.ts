import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  __clearTestPaths,
  __setTestPaths,
  decrypt,
  generateKey,
  loadKey,
} from "../src/config/encryption.js";
import {
  __setConfigPathForTests,
  __setSecretStorageAdapterForTests,
  clearAll,
  getProvider,
  getProviderSecretStorageMode,
  load,
  setProvider,
  setProviderSession,
} from "../src/config/index.js";

function readStoredConfig(configPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(configPath, "utf8")) as Record<
    string,
    unknown
  >;
}

describe("config-encryption-integration", () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "opendom-integration-"));
    testConfigPath = join(testDir, "config.json");
    __setConfigPathForTests(testConfigPath);
    __setTestPaths(testDir, join(testDir, "secrets.json"));
    generateKey();
    __setSecretStorageAdapterForTests(undefined);
    clearAll();
  });

  afterEach(() => {
    __setSecretStorageAdapterForTests(null);
    clearAll();
    __setSecretStorageAdapterForTests(undefined);
    __setConfigPathForTests(undefined);
    __clearTestPaths();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("full flow: setProvider → verify config redaction → verify secrets → getProvider", () => {
    it("stores encrypted credentials and retrieves them correctly", () => {
      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_TOKEN_abc123",
            accountId: "acct-42",
          },
        },
        true,
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
      expect(stored.providers.cloudflare?.credentials?.accountId).toBe(
        "acct-42",
      );
      expect(stored.providers.cloudflare?.secretStorage?.mode).toBe(
        "encrypted",
      );

      const secretsFile = join(testDir, "secrets.json");
      expect(existsSync(secretsFile)).toBe(true);
      const secretsContent = readFileSync(secretsFile, "utf8");
      expect(secretsContent.length).toBeGreaterThan(0);

      const secrets = JSON.parse(secretsContent) as Record<string, string>;
      const encryptedEntry = secrets["provider:cloudflare"];
      expect(encryptedEntry).toBeDefined();

      const decryptedSecret = Buffer.from(encryptedEntry, "base64").toString(
        "utf8",
      );
      expect(decryptedSecret).not.toContain("CF_TOKEN_abc123");
      expect(decryptedSecret).not.toMatch(/^[{\[]/);

      const state = getProvider("cloudflare");
      const credentials = state?.credentials as
        | Record<string, unknown>
        | undefined;
      expect(credentials?.token).toBe("CF_TOKEN_abc123");
      expect(credentials?.accountId).toBe("acct-42");
    });

    it("netim provider full flow with all secret fields", () => {
      setProvider(
        "netim",
        {
          env: "ote",
          credentials: {
            resellerId: "RESELLER_123",
            apiSecret: "NETIM_SECRET_KEY_xyz",
            defaultNs: ["ns1.example.com", "ns2.example.com"],
            defaultOwner: "owner@example.com",
          },
        },
        false,
      );

      const stored = readStoredConfig(testConfigPath) as {
        providers: {
          netim?: {
            credentials?: Record<string, unknown>;
            secretStorage?: { mode?: string };
          };
        };
      };

      expect(stored.providers.netim?.credentials?.resellerId).toBe(
        "RESELLER_123",
      );
      expect(stored.providers.netim?.credentials?.apiSecret).toBeUndefined();
      expect(stored.providers.netim?.credentials?.defaultNs).toEqual([
        "ns1.example.com",
        "ns2.example.com",
      ]);
      expect(stored.providers.netim?.secretStorage?.mode).toBe("encrypted");

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;
      const encryptedEntry = secrets["provider:netim"];
      expect(encryptedEntry).toBeDefined();

      const state = getProvider("netim");
      const credentials = state?.credentials as
        | Record<string, unknown>
        | undefined;
      expect(credentials?.resellerId).toBe("RESELLER_123");
      expect(credentials?.apiSecret).toBe("NETIM_SECRET_KEY_xyz");
      expect(credentials?.defaultNs).toEqual([
        "ns1.example.com",
        "ns2.example.com",
      ]);
    });
  });

  describe("multiple providers: separate encrypted entries", () => {
    it("stores each provider with separate encrypted entry", () => {
      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "NETIM_SECRET",
          },
        },
        false,
      );

      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_TOKEN",
            accountId: "acct",
          },
        },
        false,
      );

      setProvider(
        "porkbun",
        {
          env: "prod",
          credentials: {
            apikey: "PB_KEY",
            secretapikey: "PB_SECRET",
          },
        },
        false,
      );

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;

      expect(secrets["provider:netim"]).toBeDefined();
      expect(secrets["provider:cloudflare"]).toBeDefined();
      expect(secrets["provider:porkbun"]).toBeDefined();

      const netimEntry = JSON.parse(decrypt(secrets["provider:netim"])) as {
        credentials: Record<string, string>;
      };
      expect(netimEntry.credentials.apiSecret).toBe("NETIM_SECRET");

      const cfEntry = JSON.parse(decrypt(secrets["provider:cloudflare"])) as {
        credentials: Record<string, string>;
      };
      expect(cfEntry.credentials.token).toBe("CF_TOKEN");

      const pbEntry = JSON.parse(decrypt(secrets["provider:porkbun"])) as {
        credentials: Record<string, string>;
      };
      expect(pbEntry.credentials.secretapikey).toBe("PB_SECRET");

      const netimState = getProvider("netim");
      expect(
        (netimState?.credentials as Record<string, unknown>)?.apiSecret,
      ).toBe("NETIM_SECRET");

      const cfState = getProvider("cloudflare");
      expect((cfState?.credentials as Record<string, unknown>)?.token).toBe(
        "CF_TOKEN",
      );

      const pbState = getProvider("porkbun");
      expect(
        (pbState?.credentials as Record<string, unknown>)?.secretapikey,
      ).toBe("PB_SECRET");
    });
  });

  describe("session token: setProviderSession stores encrypted token", () => {
    it("stores and retrieves session token in encrypted storage", () => {
      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_TOKEN",
            accountId: "acct",
          },
        },
        false,
      );

      setProviderSession("cloudflare", {
        token: "SESSION_123",
        expiry: 1234567890,
      });

      const stored = readStoredConfig(testConfigPath) as {
        providers: {
          cloudflare?: {
            session?: { token?: string; expiry?: number };
            secretStorage?: { mode?: string };
          };
        };
      };

      expect(stored.providers.cloudflare?.session?.token).toBeUndefined();
      expect(stored.providers.cloudflare?.session?.expiry).toBe(1234567890);
      expect(stored.providers.cloudflare?.secretStorage?.mode).toBe(
        "encrypted",
      );

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;
      const encryptedEntry = secrets["provider:cloudflare"];
      expect(encryptedEntry).toBeDefined();

      const decryptedPayload = JSON.parse(
        decrypt(encryptedEntry),
      ) as Record<string, unknown>;
      expect(decryptedPayload.sessionToken).toBe("SESSION_123");

      const state = getProvider("cloudflare");
      expect(state?.session?.token).toBe("SESSION_123");
      expect(state?.session?.expiry).toBe(1234567890);
    });

    it("removes session token when setting undefined session", () => {
      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_TOKEN",
          },
        },
        false,
      );
      setProviderSession("cloudflare", {
        token: "SESSION_123",
        expiry: 1234567890,
      });

      setProviderSession("cloudflare", undefined);

      const state = getProvider("cloudflare");
      expect(state?.session).toBeUndefined();
    });
  });

  describe("fallback to plaintext when encryption fails", () => {
    it("stores plaintext if key file is invalid", () => {
      writeFileSync(join(testDir, "encryption.key"), Buffer.alloc(16), {
        mode: 0o600,
      });

      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "SECRET",
          },
        },
        false,
      );

      const stored = readStoredConfig(testConfigPath) as {
        providers: {
          netim?: {
            credentials?: Record<string, unknown>;
            secretStorage?: { mode?: string };
          };
        };
      };
      expect(stored.providers.netim?.credentials?.apiSecret).toBe("SECRET");
      expect(stored.providers.netim?.secretStorage?.mode).toBe("plaintext");
      expect(getProviderSecretStorageMode("netim")).toBe("plaintext");
    });
  });

  describe("key persistence", () => {
    it("reuses the same key across multiple operations", () => {
      const key1 = loadKey();
      const key2 = loadKey();
      expect(key1.equals(key2)).toBe(true);
    });
  });
});
