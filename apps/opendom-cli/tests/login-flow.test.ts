import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import {
  collectInteractiveLoginInput,
  getInteractiveLoginFields,
  resolveLoginMode,
} from "../src/login-flow.js";
import type { PromptIO } from "../src/ui.js";

class TestOutput extends Writable {
  isTTY = true;
  columns = 80;
  rows = 24;
  private chunks: string[] = [];

  override _write(
    chunk: string | Uint8Array,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(String(chunk));
    callback();
  }

  text(): string {
    return this.chunks.join("");
  }
}

function createPromptIO(
  inputText: string,
  options?: { inputTTY?: boolean; outputTTY?: boolean },
): PromptIO {
  const input = new PassThrough() as PassThrough & {
    isTTY?: boolean;
    setRawMode?: (enabled: boolean) => void;
  };
  input.isTTY = options?.inputTTY ?? true;
  input.setRawMode = () => {};
  input.end(inputText);

  const output = new TestOutput() as TestOutput & { isTTY?: boolean };
  output.isTTY = options?.outputTTY ?? true;

  return {
    input: input as never,
    output: output as never,
  };
}

describe("login flow", () => {
  test("resolveLoginMode treats positional provider as interactive", () => {
    expect(resolveLoginMode(["login", "namecheap"], "netim")).toEqual({
      provider: "namecheap",
      interactive: true,
    });
  });

  test("resolveLoginMode treats --provider form as non-interactive", () => {
    expect(
      resolveLoginMode(["login", "--provider", "namecheap"], "namecheap"),
    ).toEqual({
      provider: "namecheap",
      interactive: false,
    });
  });

  test("namecheap interactive schema includes all fields in order", () => {
    expect(
      getInteractiveLoginFields("namecheap").map((field) => field.key),
    ).toEqual([
      "api-user",
      "username",
      "api-key",
      "client-ip",
      "sandbox",
      "address-id",
    ]);
  });

  test("cloudflare account id stays optional in interactive schema", () => {
    const accountIdField = getInteractiveLoginFields("cloudflare").find(
      (field) => field.key === "account-id",
    );
    expect(accountIdField?.optional).toBe(true);
  });

  test("secret fields are marked as masked in interactive schema", () => {
    const netimSecretField = getInteractiveLoginFields("netim").find(
      (field) => field.key === "secret",
    );
    const namecheapApiKeyField = getInteractiveLoginFields("namecheap").find(
      (field) => field.key === "api-key",
    );

    expect(netimSecretField?.secret).toBe(true);
    expect(namecheapApiKeyField?.secret).toBe(true);
  });

  test("collectInteractiveLoginInput omits blank optional fields", async () => {
    const promptIO = createPromptIO("token-123\n\n");

    await expect(
      collectInteractiveLoginInput("cloudflare", promptIO),
    ).resolves.toEqual({
      token: "token-123",
    });
  });

  test("collectInteractiveLoginInput maps boolean answers", async () => {
    const promptIO = createPromptIO(
      [
        "api-user-1",
        "username-1",
        "api-key-1",
        "203.0.113.10",
        "y",
        "",
        "",
      ].join("\n"),
    );

    await expect(
      collectInteractiveLoginInput("namecheap", promptIO),
    ).resolves.toEqual({
      "api-user": "api-user-1",
      username: "username-1",
      "api-key": "api-key-1",
      "client-ip": "203.0.113.10",
      sandbox: true,
    });
  });

  test("collectInteractiveLoginInput rejects non-interactive terminals", async () => {
    const promptIO = createPromptIO("token-123\n", {
      inputTTY: false,
      outputTTY: false,
    });

    await expect(
      collectInteractiveLoginInput("cloudflare", promptIO),
    ).rejects.toThrow(
      "Interactive login requires a TTY. Use: opendom login --provider cloudflare ...",
    );
  });
});
