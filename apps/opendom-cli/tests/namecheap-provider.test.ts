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

const testHome = mkdtempSync(join(tmpdir(), "opendom-namecheap-provider-"));
const testConfigPath = join(testHome, "config.json");
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.OPENDOM_DISABLE_KEYCHAIN = "1";

type ConfigModule = typeof import("@opendom/config");

type NamecheapCall = {
  method: string;
  url: string;
  command: string;
  params: Record<string, string>;
};

type AddressProfile = {
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
  defaultYn?: boolean;
};

let cfg: ConfigModule;
let NamecheapProvider: any;
let originalFetch: typeof fetch;

function xmlResponse(payload: string, status = 200): Response {
  return new Response(payload, {
    status,
    headers: { "Content-Type": "application/xml; charset=UTF-8" },
  });
}

function okEnvelope(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ApiResponse Status="OK">${inner}</ApiResponse>`;
}

function errorEnvelope(message: string, code = "50000"): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ApiResponse Status="ERROR"><Errors><Error Number="${code}">${message}</Error></Errors></ApiResponse>`;
}

function toAddressInfoXml(profile: AddressProfile): string {
  return [
    `<FirstName>${profile.firstName}</FirstName>`,
    `<LastName>${profile.lastName}</LastName>`,
    `<Address1>${profile.address1}</Address1>`,
    `<City>${profile.city}</City>`,
    `<StateProvince>${profile.stateProvince}</StateProvince>`,
    `<PostalCode>${profile.postalCode}</PostalCode>`,
    `<Country>${profile.country}</Country>`,
    `<Phone>${profile.phone}</Phone>`,
    `<EmailAddress>${profile.emailAddress}</EmailAddress>`,
    profile.organizationName
      ? `<OrganizationName>${profile.organizationName}</OrganizationName>`
      : "",
    `<Default_YN>${profile.defaultYn ? "true" : "false"}</Default_YN>`,
  ].join("");
}

function makeAddressProfile(
  overrides: Partial<AddressProfile> = {},
): AddressProfile {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    address1: "10 Main St",
    city: "London",
    stateProvince: "London",
    postalCode: "EC1A1AA",
    country: "GB",
    phone: "+1.5551112233",
    emailAddress: "ada@example.test",
    organizationName: "Analytical Engines",
    defaultYn: false,
    ...overrides,
  };
}

function setNamecheapCredentials(
  overrides: Record<string, unknown> = {},
): void {
  cfg.setProvider(
    "namecheap",
    {
      env: "prod",
      credentials: {
        apiUser: "api-user-1",
        username: "username-1",
        apiKey: "api-key-1",
        clientIp: "198.51.100.10",
        sandbox: false,
        ...overrides,
      },
    } as never,
    true,
  );
}

function installNamecheapFetchMock(
  options: {
    listAddressIds?: string[];
    addressProfiles?: Record<string, AddressProfile>;
  } = {},
): {
  calls: NamecheapCall[];
  getCreateParams: () => Record<string, string> | undefined;
} {
  const calls: NamecheapCall[] = [];
  let createParams: Record<string, string> | undefined;

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
    const parsed = new URL(url);
    const params = Object.fromEntries(parsed.searchParams.entries());
    const command = params.Command || "";

    calls.push({ method, url, command, params });

    if (command === "namecheap.users.getBalances") {
      return xmlResponse(
        okEnvelope(
          "<CommandResponse><UserGetBalancesResult><AvailableBalance>42.00</AvailableBalance><Currency>USD</Currency></UserGetBalancesResult></CommandResponse>",
        ),
      );
    }

    if (command === "namecheap.users.address.getList") {
      const ids =
        options.listAddressIds ?? Object.keys(options.addressProfiles ?? {});
      const rows = ids
        .map(
          (addressId, index) =>
            `<List AddressId="${addressId}" AddressName="Address ${index + 1}" />`,
        )
        .join("");
      return xmlResponse(
        okEnvelope(
          `<CommandResponse><UserAddressGetListResult>${rows}</UserAddressGetListResult></CommandResponse>`,
        ),
      );
    }

    if (command === "namecheap.users.address.getInfo") {
      const addressId = params.AddressId || "";
      const profile = options.addressProfiles?.[addressId];
      if (!profile) {
        return xmlResponse(
          errorEnvelope(`Address not found: ${addressId}`, "2019166"),
        );
      }
      return xmlResponse(
        okEnvelope(
          `<CommandResponse><UserAddressGetInfoResult>${toAddressInfoXml(profile)}</UserAddressGetInfoResult></CommandResponse>`,
        ),
      );
    }

    if (command === "namecheap.domains.create") {
      createParams = params;
      return xmlResponse(
        okEnvelope(
          '<CommandResponse><DomainCreateResult Registered="true" ChargedAmount="8.88" /></CommandResponse>',
        ),
      );
    }

    return xmlResponse(
      errorEnvelope(`Unhandled fetch route: ${method} ${url}`),
      500,
    );
  }) as typeof fetch;

  return {
    calls,
    getCreateParams: () => createParams,
  };
}

beforeAll(async () => {
  originalFetch = globalThis.fetch;
  ({ NamecheapProvider } = await import(
    "../src/providers/namecheap/provider.js"
  ));
  cfg = await import("@opendom/config");
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

describe("NamecheapProvider address-id resolution", () => {
  test("login auto-selects default address id (Default_YN=true via getInfo)", async () => {
    const fetchMock = installNamecheapFetchMock({
      listAddressIds: ["ADDR-10", "ADDR-20"],
      addressProfiles: {
        "ADDR-10": makeAddressProfile({ defaultYn: false, firstName: "Nope" }),
        "ADDR-20": makeAddressProfile({
          defaultYn: true,
          firstName: "Default",
        }),
      },
    });

    const provider = new NamecheapProvider();
    await provider.login({
      "api-user": "api-user-1",
      username: "username-1",
      "api-key": "api-key-1",
      "client-ip": "198.51.100.10",
    });

    const state = cfg.getProvider("namecheap");
    const credentials = state?.credentials as Record<string, unknown>;

    expect(credentials.addressId).toBe("ADDR-20");
    expect(
      fetchMock.calls.some(
        (call) => call.command === "namecheap.users.address.getList",
      ),
    ).toBe(true);

    const getInfoAddressIds = fetchMock.calls
      .filter((call) => call.command === "namecheap.users.address.getInfo")
      .map((call) => call.params.AddressId);
    expect(getInfoAddressIds).toEqual(
      expect.arrayContaining(["ADDR-10", "ADDR-20"]),
    );
  });

  test("login accepts explicit --address-id", async () => {
    const fetchMock = installNamecheapFetchMock({
      addressProfiles: {
        "ADDR-777": makeAddressProfile({
          defaultYn: false,
          firstName: "Explicit",
        }),
      },
    });

    const provider = new NamecheapProvider();
    await provider.login({
      "api-user": "api-user-1",
      username: "username-1",
      "api-key": "api-key-1",
      "client-ip": "198.51.100.10",
      "address-id": "ADDR-777",
    });

    const state = cfg.getProvider("namecheap");
    const credentials = state?.credentials as Record<string, unknown>;

    expect(credentials.addressId).toBe("ADDR-777");
    expect(
      fetchMock.calls.some(
        (call) =>
          call.command === "namecheap.users.address.getInfo" &&
          call.params.AddressId === "ADDR-777",
      ),
    ).toBe(true);
    expect(
      fetchMock.calls.some(
        (call) => call.command === "namecheap.users.address.getList",
      ),
    ).toBe(false);
  });

  test("buy resolves contact using stored address id", async () => {
    setNamecheapCredentials({ addressId: "ADDR-STORED" });
    const fetchMock = installNamecheapFetchMock({
      addressProfiles: {
        "ADDR-STORED": makeAddressProfile({
          defaultYn: true,
          firstName: "Stored",
          lastName: "Contact",
          emailAddress: "stored@example.test",
        }),
      },
    });

    const provider = new NamecheapProvider();
    const result = await provider.buy("stored-contact.example", {
      duration: 1,
    });
    const createParams = fetchMock.getCreateParams();

    expect(result.status).toBe("DONE");
    expect(
      fetchMock.calls.some(
        (call) =>
          call.command === "namecheap.users.address.getInfo" &&
          call.params.AddressId === "ADDR-STORED",
      ),
    ).toBe(true);
    expect(createParams).toBeDefined();
    expect(createParams?.RegistrantFirstName).toBe("Stored");
    expect(createParams?.RegistrantLastName).toBe("Contact");
    expect(createParams?.AdminEmailAddress).toBe("stored@example.test");
  });

  test("buy allows addressId override per buy options", async () => {
    setNamecheapCredentials({ addressId: "ADDR-STORED" });
    const fetchMock = installNamecheapFetchMock({
      addressProfiles: {
        "ADDR-STORED": makeAddressProfile({ firstName: "Stored" }),
        "ADDR-OVERRIDE": makeAddressProfile({
          defaultYn: true,
          firstName: "Override",
          emailAddress: "override@example.test",
        }),
      },
    });

    const provider = new NamecheapProvider();
    const result = await provider.buy("override-contact.example", {
      duration: 2,
      addressId: "ADDR-OVERRIDE",
    } as never);
    const createParams = fetchMock.getCreateParams();

    expect(result.status).toBe("DONE");
    expect(
      fetchMock.calls.some(
        (call) =>
          call.command === "namecheap.users.address.getInfo" &&
          call.params.AddressId === "ADDR-OVERRIDE",
      ),
    ).toBe(true);
    expect(
      fetchMock.calls.some(
        (call) =>
          call.command === "namecheap.users.address.getInfo" &&
          call.params.AddressId === "ADDR-STORED",
      ),
    ).toBe(false);
    expect(createParams?.RegistrantFirstName).toBe("Override");
    expect(createParams?.RegistrantEmailAddress).toBe("override@example.test");
    expect(createParams?.Years).toBe("2");
  });

  test("buy fails when no effective address id with re-login guidance", async () => {
    setNamecheapCredentials();
    const fetchMock = installNamecheapFetchMock();

    const provider = new NamecheapProvider();
    await expect(
      provider.buy("missing-address-id.example", { duration: 1 }),
    ).rejects.toThrow(
      "Namecheap address profile is missing. Re-run: opendom login namecheap and provide an address ID when prompted.",
    );

    expect(
      fetchMock.calls.some(
        (call) => call.command === "namecheap.users.address.getInfo",
      ),
    ).toBe(false);
    expect(
      fetchMock.calls.some(
        (call) => call.command === "namecheap.domains.create",
      ),
    ).toBe(false);
  });
});
