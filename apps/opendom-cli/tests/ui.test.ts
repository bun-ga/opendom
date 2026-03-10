import { describe, expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import {
  type PromptIO,
  ensureInteractiveTerminal,
  formatPrice,
  formatStatus,
  promptBoolean,
  promptText,
} from "../src/ui.js";

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
): PromptIO & { output: TestOutput } {
  const input = new PassThrough() as PassThrough & {
    isTTY?: boolean;
    setRawMode?: (enabled: boolean) => void;
  };
  input.isTTY = options?.inputTTY ?? true;
  input.setRawMode = () => {};
  input.end(inputText);

  const output = new TestOutput();
  output.isTTY = options?.outputTTY ?? true;

  return {
    input: input as never,
    output: output as never,
  };
}

describe("ui format helpers", () => {
  test("formats prices with two decimal places", () => {
    const formatted = formatPrice(12.5, "EUR");
    expect(formatted).toContain("12.50");
    expect(formatted).toContain("€");
  });

  test("normalizes known statuses", () => {
    const status = formatStatus("available");
    expect(status).toContain("AVAILABLE");
  });

  test("uppercases unknown statuses", () => {
    const status = formatStatus("queued");
    expect(status).toContain("QUEUED");
  });
});

describe("ui prompts", () => {
  test("promptText returns visible input", async () => {
    const promptIO = createPromptIO("namecheap-user\n");

    await expect(promptText("API user", {}, promptIO)).resolves.toBe(
      "namecheap-user",
    );
    expect(promptIO.output.text()).toContain("API user");
  });

  test("promptText retries until a required value is provided", async () => {
    const promptIO = createPromptIO("\ncloudflare-token\n");

    await expect(
      promptText("API token", { required: true }, promptIO),
    ).resolves.toBe("cloudflare-token");
    expect(promptIO.output.text()).toContain("API token is required.");
  });

  test("promptText masks secret input in output", async () => {
    const promptIO = createPromptIO("secret-value\n");

    await expect(
      promptText("API key", { required: true, secret: true }, promptIO),
    ).resolves.toBe("secret-value");
    expect(promptIO.output.text()).toContain("API key");
    expect(promptIO.output.text()).not.toContain("secret-value");
  });

  test("promptBoolean maps yes answers to true", async () => {
    const promptIO = createPromptIO("yes\n");
    await expect(promptBoolean("Use sandbox", false, promptIO)).resolves.toBe(
      true,
    );
  });

  test("promptBoolean maps blank answers to the default value", async () => {
    const promptIO = createPromptIO("\n");
    await expect(promptBoolean("Use sandbox", false, promptIO)).resolves.toBe(
      false,
    );
  });

  test("ensureInteractiveTerminal rejects missing tty streams", () => {
    const promptIO = createPromptIO("token\n", {
      inputTTY: false,
      outputTTY: false,
    });

    expect(() => ensureInteractiveTerminal(promptIO)).toThrow(
      "Interactive login requires a TTY.",
    );
  });
});
