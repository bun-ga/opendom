import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
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
} from "../src/encryption.js";
import {
  __setConfigPathForTests,
  __setSecretStorageAdapterForTests,
  clearAll,
  getProvider,
  getProviderSecretStorageMode,
  load,
  setProvider,
  setProviderSession,
} from "../src/index.js";

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
        token: "SESSION_TOKEN_abc123",
        expiry: Date.now() + 3600000,
      });

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;
      const encryptedEntry = secrets["provider:cloudflare"];

      const decrypted = JSON.parse(decrypt(encryptedEntry)) as {
        sessionToken?: string;
      };
      expect(decrypted.sessionToken).toBe("SESSION_TOKEN_abc123");

      const state = getProvider("cloudflare");
      expect(state?.session?.token).toBe("SESSION_TOKEN_abc123");
      expect(state?.session?.expiry).toBeGreaterThan(Date.now());
    });

    it("updates existing session token", () => {
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

      setProviderSession("netim", {
        token: "FIRST_TOKEN",
        expiry: Date.now() + 3600000,
      });

      setProviderSession("netim", {
        token: "SECOND_TOKEN",
        expiry: Date.now() + 7200000,
      });

      const state = getProvider("netim");
      expect(state?.session?.token).toBe("SECOND_TOKEN");
    });
  });

  describe("encryption write failure: fallback to plaintext", () => {
    it("falls back to plaintext when adapter returns false on write", () => {
      const failingAdapter = {
        read(_account: string): string | undefined {
          return undefined;
        },
        write(_account: string, _value: string): boolean {
          return false;
        },
        remove(_account: string): void {},
      };
      __setSecretStorageAdapterForTests(failingAdapter as never);

      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "SECRET_FALLBACK",
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

      expect(stored.providers.netim?.credentials?.apiSecret).toBe(
        "SECRET_FALLBACK",
      );
      expect(stored.providers.netim?.secretStorage?.mode).toBe("plaintext");
      expect(getProviderSecretStorageMode("netim")).toBe("plaintext");

      const state = getProvider("netim");
      expect((state?.credentials as Record<string, unknown>)?.apiSecret).toBe(
        "SECRET_FALLBACK",
      );
    });
  });

  describe("migration: plaintext config → load() → upgrades to encrypted", () => {
    it("migrates plaintext-only config to encrypted storage on load", () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify(
          {
            schemaVersion: 2,
            providers: {
              netim: {
                env: "prod",
                credentials: {
                  resellerId: "MIGRATE_123",
                  apiSecret: "MIGRATE_SECRET",
                },
              },
              cloudflare: {
                env: "prod",
                credentials: {
                  token: "CF_TOKEN_MIGRATE",
                },
              },
            },
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );

      load();

      const stored = readStoredConfig(testConfigPath) as {
        providers: {
          netim?: {
            credentials?: Record<string, unknown>;
            secretStorage?: { mode?: string };
          };
          cloudflare?: {
            credentials?: Record<string, unknown>;
            secretStorage?: { mode?: string };
          };
        };
      };

      expect(stored.providers.netim?.credentials?.apiSecret).toBeUndefined();
      expect(stored.providers.netim?.secretStorage?.mode).toBe("encrypted");

      expect(stored.providers.cloudflare?.credentials?.token).toBeUndefined();
      expect(stored.providers.cloudflare?.secretStorage?.mode).toBe(
        "encrypted",
      );

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;

      expect(secrets["provider:netim"]).toBeDefined();
      expect(secrets["provider:cloudflare"]).toBeDefined();

      const netimState = getProvider("netim");
      expect(
        (netimState?.credentials as Record<string, unknown>)?.apiSecret,
      ).toBe("MIGRATE_SECRET");

      const cfState = getProvider("cloudflare");
      expect((cfState?.credentials as Record<string, unknown>)?.token).toBe(
        "CF_TOKEN_MIGRATE",
      );
    });

    it("preserves non-secret credentials during migration", () => {
      writeFileSync(
        testConfigPath,
        JSON.stringify(
          {
            schemaVersion: 2,
            providers: {
              netim: {
                env: "ote",
                credentials: {
                  resellerId: "PRESERVE_ID",
                  apiSecret: "PRESERVE_SECRET",
                  defaultNs: ["ns1.test.com", "ns2.test.com"],
                  defaultOwner: "admin@test.com",
                },
              },
            },
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );

      load();

      const state = getProvider("netim");
      const credentials = state?.credentials as Record<string, unknown>;
      expect(credentials?.resellerId).toBe("PRESERVE_ID");
      expect(credentials?.apiSecret).toBe("PRESERVE_SECRET");
      expect(credentials?.defaultNs).toEqual(["ns1.test.com", "ns2.test.com"]);
      expect(credentials?.defaultOwner).toBe("admin@test.com");
    });
  });

  describe("ClearProvider: removes encrypted entry from secrets file", () => {
    it("removes provider and its encrypted secret", () => {
      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_TO_CLEAR",
          },
        },
        false,
      );

      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "NETIM_STAYS",
          },
        },
        false,
      );

      const { clearProvider } = require("../src/index.js");
      clearProvider("cloudflare");

      const secretsFile = join(testDir, "secrets.json");
      const secretsContent = readFileSync(secretsFile, "utf8");
      const secrets = JSON.parse(secretsContent) as Record<string, string>;

      expect(secrets["provider:cloudflare"]).toBeUndefined();
      expect(secrets["provider:netim"]).toBeDefined();

      expect(getProvider("cloudflare")).toBeUndefined();
      expect(getProvider("netim")).toBeDefined();
    });
  });

  describe("ClearAll: removes all encrypted entries", () => {
    it("clears config file and all secrets", () => {
      setProvider(
        "cloudflare",
        {
          env: "prod",
          credentials: {
            token: "CF_1",
          },
        },
        false,
      );

      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "NETIM_1",
          },
        },
        false,
      );

      setProvider(
        "porkbun",
        {
          env: "prod",
          credentials: {
            apikey: "PB_1",
            secretapikey: "PB_SECRET",
          },
        },
        false,
      );

      clearAll();

      expect(existsSync(testConfigPath)).toBe(false);

      const secretsFile = join(testDir, "secrets.json");
      if (existsSync(secretsFile)) {
        const secretsContent = readFileSync(secretsFile, "utf8");
        const secrets = JSON.parse(secretsContent) as Record<string, string>;
        expect(Object.keys(secrets).length).toBe(0);
      }

      expect(getProvider("cloudflare")).toBeUndefined();
      expect(getProvider("netim")).toBeUndefined();
      expect(getProvider("porkbun")).toBeUndefined();
    });
  });

  describe("file permissions: 0600", () => {
    it("config file has 0600 permissions", () => {
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

      const stats = statSync(testConfigPath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("secrets file has 0600 permissions", () => {
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

      const secretsFile = join(testDir, "secrets.json");
      expect(existsSync(secretsFile)).toBe(true);

      const stats = statSync(secretsFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("encryption key file has 0600 permissions", () => {
      const keyFile = join(testDir, "encryption.key");
      expect(existsSync(keyFile)).toBe(true);

      const stats = statSync(keyFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe("encrypted data not readable as plain JSON", () => {
    it("secrets file contains base64 encrypted data, not plain JSON", () => {
      setProvider(
        "netim",
        {
          env: "prod",
          credentials: {
            resellerId: "R1",
            apiSecret: "SUPER_SECRET_API_KEY_12345",
          },
        },
        false,
      );

      const secretsFile = join(testDir, "secrets.json");
      const rawContent = readFileSync(secretsFile, "utf8");

      const parsed = JSON.parse(rawContent) as Record<string, string>;
      const encryptedValue = parsed["provider:netim"];

      expect(() => {
        JSON.parse(encryptedValue);
      }).toThrow();

      const decoded = Buffer.from(encryptedValue, "base64");
      expect(decoded.length).toBeGreaterThan(16);

      const decrypted = loadKey();
      const { createDecipheriv } = require("node:crypto");
      const iv = decoded.subarray(0, 12);
      const authTag = decoded.subarray(12, 28);
      const ciphertext = decoded.subarray(28);

      const decipher = createDecipheriv("aes-256-gcm", decrypted, iv);
      decipher.setAuthTag(authTag);

      const plaintext = decipher.update(ciphertext) + decipher.final("utf8");
      const payload = JSON.parse(plaintext) as {
        credentials: Record<string, string>;
      };

      expect(payload.credentials.apiSecret).toBe("SUPER_SECRET_API_KEY_12345");
    });
  });

  describe("namecheap provider integration", () => {
    it("handles namecheap credentials with all secret fields", () => {
      setProvider(
        "namecheap",
        {
          env: "prod",
          credentials: {
            apiUser: "api_user",
            username: "user_name",
            apiKey: "NC_API_KEY_SECRET",
            clientIp: "203.0.113.50",
            sandbox: false,
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

      expect(stored.providers.namecheap?.credentials?.apiKey).toBeUndefined();
      expect(stored.providers.namecheap?.credentials?.apiUser).toBe("api_user");
      expect(stored.providers.namecheap?.credentials?.username).toBe(
        "user_name",
      );
      expect(stored.providers.namecheap?.credentials?.clientIp).toBe(
        "203.0.113.50",
      );
      expect(stored.providers.namecheap?.secretStorage?.mode).toBe("encrypted");

      const state = getProvider("namecheap");
      const credentials = state?.credentials as Record<string, unknown>;
      expect(credentials?.apiKey).toBe("NC_API_KEY_SECRET");
      expect(credentials?.apiUser).toBe("api_user");
    });
  });
});
