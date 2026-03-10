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

const testHome = mkdtempSync(join(tmpdir(), "opendom-default-provider-"));
const testConfigPath = join(testHome, "config.json");
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.OPENDOM_DISABLE_KEYCHAIN = "1";

type ConfigModule = typeof import("@opendom/config");
type ProviderResolutionModule = typeof import("../src/provider-resolution.js");

let cfg: ConfigModule;
let providerResolution: ProviderResolutionModule;

function setConfiguredProvider(
  provider: "netim" | "cloudflare" | "namecheap",
): void {
  if (provider === "netim") {
    cfg.setProvider(
      "netim",
      {
        env: "prod",
        credentials: {
          resellerId: "RID-1",
          apiSecret: "SECRET-1",
        },
      } as never,
      false,
    );
    return;
  }

  if (provider === "cloudflare") {
    cfg.setProvider(
      "cloudflare",
      {
        env: "prod",
        credentials: {
          token: "CF_TOKEN_1",
        },
      } as never,
      false,
    );
    return;
  }

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
    } as never,
    false,
  );
}

beforeAll(async () => {
  cfg = await import("@opendom/config");
  providerResolution = await import("../src/provider-resolution.js");
  cfg.__setConfigPathForTests(testConfigPath);
  cfg.__setSecretStorageAdapterForTests(null);
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

describe("default provider resolution", () => {
  test("setConfiguredDefaultProvider rejects unconfigured providers", () => {
    expect(() =>
      providerResolution.setConfiguredDefaultProvider("namecheap"),
    ).toThrow(
      "Provider 'namecheap' is not configured. Run: opendom login namecheap",
    );
  });

  test("setConfiguredDefaultProvider saves the default provider", () => {
    setConfiguredProvider("namecheap");

    providerResolution.setConfiguredDefaultProvider("namecheap");

    expect(cfg.getDefaultProvider()).toBe("namecheap");
  });

  test("saved default provider is used when no flag is passed", () => {
    setConfiguredProvider("cloudflare");
    setConfiguredProvider("namecheap");
    cfg.setDefaultProvider("namecheap");

    expect(
      providerResolution.resolveProviderForCommand(["search", "example.com"]),
    ).toBe("namecheap");
  });

  test("provider flag overrides the saved default", () => {
    setConfiguredProvider("cloudflare");
    setConfiguredProvider("namecheap");
    cfg.setDefaultProvider("cloudflare");

    expect(
      providerResolution.resolveProviderForCommand([
        "search",
        "example.com",
        "--provider",
        "namecheap",
      ]),
    ).toBe("namecheap");
  });

  test("single configured provider is used when no default exists", () => {
    setConfiguredProvider("cloudflare");

    expect(providerResolution.resolveProviderForCommand(["domains"])).toBe(
      "cloudflare",
    );
  });

  test("fails when multiple providers exist and no default is set", () => {
    setConfiguredProvider("cloudflare");
    setConfiguredProvider("namecheap");

    expect(() =>
      providerResolution.resolveProviderForCommand(["domains"]),
    ).toThrow(
      "No default provider selected. Run: opendom set-default <provider> or pass --provider <provider>.",
    );
  });

  test("fails when no providers are configured", () => {
    expect(() =>
      providerResolution.resolveProviderForCommand(["domains"]),
    ).toThrow(
      "No provider is configured. Run: opendom login <provider> first.",
    );
  });
});
