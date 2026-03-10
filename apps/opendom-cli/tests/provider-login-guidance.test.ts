import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testHome = mkdtempSync(join(tmpdir(), "opendom-provider-guidance-"));
const testConfigPath = join(testHome, "config.json");
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.OPENDOM_DISABLE_KEYCHAIN = "1";

type ConfigModule = typeof import("../src/config/index.js");
type ProviderCtor = new () => { balance(): Promise<unknown> };

let cfg: ConfigModule;
let CloudflareProvider: ProviderCtor;
let NamecheapProvider: ProviderCtor;
let NetimProvider: ProviderCtor;
let PorkbunProvider: ProviderCtor;

beforeAll(async () => {
  cfg = await import("../src/config/index.js");
  cfg.__setConfigPathForTests(testConfigPath);
  cfg.__setSecretStorageAdapterForTests(null);
  ({ CloudflareProvider } = await import(
    "../src/providers/cloudflare/provider.js"
  ));
  ({ NamecheapProvider } = await import(
    "../src/providers/namecheap/provider.js"
  ));
  ({ NetimProvider } = await import("../src/providers/netim/provider.js"));
  ({ PorkbunProvider } = await import("../src/providers/porkbun/provider.js"));
});

beforeEach(() => {
  cfg.__setSecretStorageAdapterForTests(null);
  cfg.clearAll();
});

afterAll(() => {
  cfg.clearAll();
  cfg.__setSecretStorageAdapterForTests(undefined);
  cfg.__setConfigPathForTests(undefined);
  rmSync(testHome, { recursive: true, force: true });
});

describe("provider login guidance", () => {
  test("netim points to positional login when credentials are missing", async () => {
    await expect(new NetimProvider().balance()).rejects.toThrow(
      "Netim provider is not configured. Run: opendom login netim",
    );
  });

  test("cloudflare points to positional login when credentials are missing", async () => {
    await expect(new CloudflareProvider().balance()).rejects.toThrow(
      "Cloudflare provider is not configured. Run: opendom login cloudflare",
    );
  });

  test("porkbun points to positional login when credentials are missing", async () => {
    await expect(new PorkbunProvider().balance()).rejects.toThrow(
      "Porkbun provider is not configured. Run: opendom login porkbun",
    );
  });

  test("namecheap points to positional login when credentials are missing", async () => {
    await expect(new NamecheapProvider().balance()).rejects.toThrow(
      "Namecheap provider is not configured. Run: opendom login namecheap",
    );
  });
});
