import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ConfigModule = typeof import("../src/config/index.js");

const testDir = mkdtempSync(join(tmpdir(), "opendom-cli-config-tests-"));
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

test("stores secret fields outside the config file when local config module is used", () => {
  const entries = new Map<string, string>();
  cfg.__setSecretStorageAdapterForTests({
    read(account: string): string | undefined {
      return entries.get(account);
    },
    write(account: string, value: string): boolean {
      entries.set(account, value);
      return true;
    },
    remove(account: string): void {
      entries.delete(account);
    },
  });

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

  const stored = JSON.parse(readFileSync(testConfigPath, "utf8")) as {
    providers: {
      cloudflare?: {
        credentials?: Record<string, unknown>;
      };
    };
  };

  expect(stored.providers.cloudflare?.credentials?.token).toBeUndefined();
  expect(stored.providers.cloudflare?.credentials?.accountId).toBe("acct-42");
  expect(entries.has("provider:cloudflare")).toBe(true);
});
