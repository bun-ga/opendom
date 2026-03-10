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

const testHome = mkdtempSync(join(tmpdir(), "opendom-netim-provider-"));
const testConfigPath = join(testHome, "config.json");
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.OPENDOM_DISABLE_KEYCHAIN = "1";

type ConfigModule = typeof import("../src/config/index.js");

type RegisterPayload = {
  idOwner?: string;
  idAdmin?: string;
  idTech?: string;
  idBilling?: string;
  nameservers?: Record<string, { name: string }>;
  duration?: number;
};

let cfg: ConfigModule;
let NetimProvider: any;
let originalFetch: typeof fetch;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installNetimFetchMock(accountPayload: Record<string, unknown>) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  let registerPayload: RegisterPayload | undefined;

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method || "GET").toUpperCase();

    let body: unknown = undefined;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    calls.push({ method, url, body });

    if (url.endsWith("/session/") && method === "POST") {
      return jsonResponse({ access_token: "session-token" });
    }

    if (url.endsWith("/account/") && method === "GET") {
      return jsonResponse(accountPayload);
    }

    if (url.includes("/domain/") && url.endsWith("/") && method === "POST") {
      registerPayload = (body ?? {}) as RegisterPayload;
      return jsonResponse({ STATUS: "DONE", operationId: 42 });
    }

    return jsonResponse(
      { message: `Unhandled fetch route: ${method} ${url}` },
      500,
    );
  }) as typeof fetch;

  return {
    calls,
    getRegisterPayload: (): RegisterPayload | undefined => registerPayload,
  };
}

function setNetimCredentials(overrides: Record<string, unknown> = {}): void {
  cfg.setProvider(
    "netim",
    {
      env: "prod",
      credentials: {
        resellerId: "RID-123",
        apiSecret: "SECRET-123",
        ...overrides,
      },
    } as never,
    true,
  );
}

beforeAll(async () => {
  originalFetch = globalThis.fetch;
  ({ NetimProvider } = await import("../src/providers/netim/provider.js"));
  cfg = await import("../src/config/index.js");
  cfg.__setConfigPathForTests(testConfigPath);
  cfg.__setSecretStorageAdapterForTests(null);
});

beforeEach(() => {
  cfg.__setSecretStorageAdapterForTests(null);
  cfg.clearAll();
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  cfg.clearAll();
  cfg.__setSecretStorageAdapterForTests(undefined);
  cfg.__setConfigPathForTests(undefined);
  globalThis.fetch = originalFetch;
  rmSync(testHome, { recursive: true, force: true });
});

describe("NetimProvider buy owner/default resolution", () => {
  test("hydrates missing defaults from account and persists them", async () => {
    setNetimCredentials();

    const fetchMock = installNetimFetchMock({
      DEFAULT_OWNER: "OWNER-100",
      DEFAULT_ADMIN: "ADMIN-100",
      DEFAULT_TECH: "TECH-100",
      DEFAULT_BILLING: "BILL-100",
      DEFAULT_DNS_1: "ns1.example.net",
      DEFAULT_DNS_2: "ns2.example.net",
    });

    const provider = new NetimProvider();
    const result = await provider.buy("hydrated.example", { duration: 1 });
    const registerPayload = fetchMock.getRegisterPayload();

    expect(result.status).toBe("DONE");
    expect(registerPayload).toBeDefined();
    expect(registerPayload?.idOwner).toBe("OWNER-100");
    expect(registerPayload?.idAdmin).toBe("ADMIN-100");
    expect(registerPayload?.idTech).toBe("TECH-100");
    expect(registerPayload?.idBilling).toBe("BILL-100");
    expect(registerPayload?.nameservers).toEqual({
      "1": { name: "ns1.example.net" },
      "2": { name: "ns2.example.net" },
    });
    expect(fetchMock.calls.some((call) => call.url.endsWith("/account/"))).toBe(
      true,
    );

    const state = cfg.getProvider("netim");
    const credentials = state?.credentials as Record<string, unknown>;
    expect(credentials.defaultOwner).toBe("OWNER-100");
    expect(credentials.defaultAdmin).toBe("ADMIN-100");
    expect(credentials.defaultTech).toBe("TECH-100");
    expect(credentials.defaultBilling).toBe("BILL-100");
    expect(credentials.defaultNs).toEqual([
      "ns1.example.net",
      "ns2.example.net",
    ]);
  });

  test("uses explicit owner and local defaults without account lookup", async () => {
    setNetimCredentials({
      defaultAdmin: "ADMIN-LOCAL",
      defaultTech: "TECH-LOCAL",
      defaultBilling: "BILL-LOCAL",
      defaultNs: ["ns1.local.test", "ns2.local.test"],
    });

    const fetchMock = installNetimFetchMock({});

    const provider = new NetimProvider();
    const result = await provider.buy("explicit.example", {
      duration: 2,
      ownerId: "OWNER-EXPLICIT",
    });
    const registerPayload = fetchMock.getRegisterPayload();

    expect(result.status).toBe("DONE");
    expect(registerPayload?.idOwner).toBe("OWNER-EXPLICIT");
    expect(registerPayload?.idAdmin).toBe("ADMIN-LOCAL");
    expect(registerPayload?.idTech).toBe("TECH-LOCAL");
    expect(registerPayload?.idBilling).toBe("BILL-LOCAL");
    expect(registerPayload?.duration).toBe(2);
    expect(registerPayload?.nameservers).toEqual({
      "1": { name: "ns1.local.test" },
      "2": { name: "ns2.local.test" },
    });
    expect(
      fetchMock.calls.some(
        (call) => call.method === "GET" && call.url.endsWith("/account/"),
      ),
    ).toBe(false);
  });

  test("fails with guidance when owner cannot be resolved", async () => {
    setNetimCredentials({
      defaultAdmin: "ADMIN-LOCAL",
      defaultTech: "TECH-LOCAL",
      defaultBilling: "BILL-LOCAL",
      defaultNs: ["ns1.local.test", "ns2.local.test"],
    });

    const fetchMock = installNetimFetchMock({
      DEFAULT_OWNER: "",
    });

    const provider = new NetimProvider();

    await expect(
      provider.buy("missing-owner.example", { duration: 1 }),
    ).rejects.toThrow(
      "Could not resolve Netim Owner contact. Re-run with --owner <CONTACT_ID>.",
    );

    expect(fetchMock.getRegisterPayload()).toBeUndefined();
    expect(fetchMock.calls.some((call) => call.url.endsWith("/account/"))).toBe(
      true,
    );
  });
});
