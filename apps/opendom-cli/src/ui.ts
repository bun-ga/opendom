// ─── ANSI Colors (zero-dependency) ──────────────────────────
const isColorEnabled = process.stdout.isTTY !== false;

const wrap = (code: number, reset: number) => (s: string) =>
  isColorEnabled ? `\x1b[${code}m${s}\x1b[${reset}m` : s;

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
  white: wrap(37, 39),
  bgRed: wrap(41, 49),
  bgGreen: wrap(42, 49),
};

// ─── Symbols ────────────────────────────────────────────────
export const sym = {
  ok: c.green("✓"),
  err: c.red("✗"),
  warn: c.yellow("⚠"),
  info: c.blue("ℹ"),
  avail: c.green("●"),
  taken: c.red("●"),
  premium: c.yellow("●"),
  arrow: c.dim("→"),
  dot: c.dim("·"),
};

// ─── Output helpers ─────────────────────────────────────────
export const log = {
  ok: (msg: string) => console.log(`${sym.ok} ${msg}`),
  err: (msg: string) => console.error(`${sym.err} ${c.red(msg)}`),
  warn: (msg: string) => console.log(`${sym.warn} ${c.yellow(msg)}`),
  info: (msg: string) => console.log(`${sym.info} ${msg}`),
};

export function formatDomain(domain: string): string {
  const idx = domain.lastIndexOf(".");
  if (idx < 0) return c.bold(domain);
  return (
    c.bold(c.white(domain.slice(0, idx))) +
    c.dim(".") +
    c.cyan(domain.slice(idx + 1))
  );
}

export function formatPrice(amount: number, currency = "EUR"): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
  return c.green(`${amount.toFixed(2)}${sym}`);
}

export function formatStatus(s: string): string {
  switch (s.toLowerCase()) {
    case "done":
      return c.green("DONE");
    case "pending":
      return c.yellow("PENDING");
    case "error":
      return c.red("ERROR");
    case "available":
      return c.green("AVAILABLE");
    case "unavailable":
      return c.red("TAKEN");
    case "premium":
      return c.yellow("PREMIUM");
    default:
      return c.dim(s.toUpperCase());
  }
}

export function kv(pairs: [string, string][]): void {
  const max = Math.max(...pairs.map(([k]) => k.length));
  for (const [k, v] of pairs) console.log(`  ${c.dim(k.padEnd(max))}  ${v}`);
}

export interface PromptInput {
  isTTY?: boolean;
  off(event: "data", listener: (chunk: Buffer | string) => void): this;
  on(event: "data", listener: (chunk: Buffer | string) => void): this;
  pause(): void;
  resume(): void;
  setRawMode?(enabled: boolean): void;
  setEncoding(encoding: BufferEncoding): void;
}

export interface PromptOutput {
  isTTY?: boolean;
  write(chunk: string): boolean;
}

export interface PromptIO {
  input: PromptInput;
  output: PromptOutput;
}

export interface PromptOptions {
  required?: boolean;
  secret?: boolean;
}

function defaultPromptIO(): PromptIO {
  return {
    input: process.stdin,
    output: process.stdout,
  };
}

function formatPromptLabel(label: string): string {
  return `  ${c.yellow(label)} `;
}

function isTerminalPromptIO(promptIO: PromptIO): boolean {
  return promptIO.input.isTTY !== false && promptIO.output.isTTY !== false;
}

type BufferedLine = {
  line: string;
  rest: string;
};

const pendingInputBuffers = new WeakMap<PromptInput, string>();

function extractBufferedLine(buffer: string): BufferedLine | undefined {
  for (let index = 0; index < buffer.length; index++) {
    const char = buffer[index];
    if (char !== "\n" && char !== "\r") {
      continue;
    }

    const nextIndex =
      char === "\r" && buffer[index + 1] === "\n" ? index + 2 : index + 1;
    return {
      line: buffer.slice(0, index),
      rest: buffer.slice(nextIndex),
    };
  }
  return undefined;
}

function storePendingBuffer(input: PromptInput, buffer: string): void {
  if (buffer.length > 0) {
    pendingInputBuffers.set(input, buffer);
    return;
  }
  pendingInputBuffers.delete(input);
}

function readLineFromBuffer(input: PromptInput): BufferedLine | undefined {
  return extractBufferedLine(pendingInputBuffers.get(input) ?? "");
}

async function readVisibleInput(promptIO: PromptIO): Promise<string> {
  const bufferedLine = readLineFromBuffer(promptIO.input);
  if (bufferedLine) {
    storePendingBuffer(promptIO.input, bufferedLine.rest);
    return bufferedLine.line;
  }

  return new Promise((resolve) => {
    let buffer = pendingInputBuffers.get(promptIO.input) ?? "";
    const handleData = (chunk: Buffer | string) => {
      buffer += String(chunk);
      const line = extractBufferedLine(buffer);
      if (!line) {
        return;
      }
      promptIO.input.off("data", handleData);
      promptIO.input.pause();
      storePendingBuffer(promptIO.input, line.rest);
      resolve(line.line);
    };

    promptIO.input.setEncoding("utf-8");
    promptIO.input.on("data", handleData);
    promptIO.input.resume();
  });
}

async function readSecretInput(promptIO: PromptIO): Promise<string> {
  const bufferedLine = readLineFromBuffer(promptIO.input);
  if (bufferedLine) {
    storePendingBuffer(promptIO.input, bufferedLine.rest);
    promptIO.output.write("\n");
    return bufferedLine.line;
  }

  return new Promise((resolve, reject) => {
    let value = pendingInputBuffers.get(promptIO.input) ?? "";
    pendingInputBuffers.delete(promptIO.input);

    const finish = (result: string, remainder = "") => {
      promptIO.input.off("data", handleData);
      promptIO.input.setRawMode?.(false);
      promptIO.input.pause();
      storePendingBuffer(promptIO.input, remainder);
      promptIO.output.write("\n");
      resolve(result);
    };

    const fail = (error: Error) => {
      promptIO.input.off("data", handleData);
      promptIO.input.setRawMode?.(false);
      promptIO.input.pause();
      reject(error);
    };

    const handleData = (chunk: Buffer | string) => {
      const text = String(chunk);
      for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === "\u0003") {
          fail(new Error("Prompt cancelled."));
          return;
        }
        if (char === "\b" || char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        if (char === "\n" || char === "\r") {
          const remainder =
            char === "\r" && text[index + 1] === "\n"
              ? text.slice(index + 2)
              : text.slice(index + 1);
          finish(value, remainder);
          return;
        }
        value += char;
      }
    };

    promptIO.input.setEncoding("utf-8");
    promptIO.input.setRawMode?.(true);
    promptIO.input.on("data", handleData);
    promptIO.input.resume();
  });
}

async function readPromptLine(
  label: string,
  options: PromptOptions = {},
  promptIO = defaultPromptIO(),
): Promise<string> {
  ensureInteractiveTerminal(promptIO);

  while (true) {
    promptIO.output.write(formatPromptLabel(label));
    const answer = options.secret
      ? await readSecretInput(promptIO)
      : await readVisibleInput(promptIO);
    const trimmedAnswer = answer.trim();

    if (!options.required || trimmedAnswer.length > 0) {
      return trimmedAnswer;
    }

    promptIO.output.write(`  ${c.yellow(`${label} is required.`)}\n`);
  }
}

// ─── Simple Spinner ─────────────────────────────────────────
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private i = 0;
  private msg: string;

  constructor(msg: string) {
    this.msg = msg;
  }

  start(): this {
    if (!process.stdout.isTTY) {
      console.log(this.msg);
      return this;
    }
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r${c.cyan(frames[this.i++ % frames.length])} ${this.msg}`,
      );
    }, 80);
    return this;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write("\r\x1b[K"); // Clear line
    }
  }
}

// ─── Confirmation prompt ────────────────────────────────────
export function ensureInteractiveTerminal(promptIO = defaultPromptIO()): void {
  if (isTerminalPromptIO(promptIO)) {
    return;
  }
  throw new Error("Interactive login requires a TTY.");
}

export async function promptText(
  label: string,
  options: PromptOptions = {},
  promptIO = defaultPromptIO(),
): Promise<string> {
  return readPromptLine(label, options, promptIO);
}

export async function promptBoolean(
  label: string,
  defaultValue = false,
  promptIO = defaultPromptIO(),
): Promise<boolean> {
  ensureInteractiveTerminal(promptIO);

  const suffix = defaultValue ? "[Y/n]" : "[y/N]";
  while (true) {
    const answer = await readPromptLine(`${label} ${suffix}`, {}, promptIO);
    const parsed = parseBooleanPromptAnswer(answer, defaultValue);
    if (parsed !== undefined) {
      return parsed;
    }
    promptIO.output.write(`  ${c.yellow("Please answer yes or no.")}\n`);
  }
}

export function parseBooleanPromptAnswer(
  answer: string,
  defaultValue: boolean,
): boolean | undefined {
  const normalized = answer.trim().toLowerCase();
  if (normalized.length === 0) {
    return defaultValue;
  }
  if (normalized === "y" || normalized === "yes") {
    return true;
  }
  if (normalized === "n" || normalized === "no") {
    return false;
  }
  return undefined;
}

export async function confirm(msg: string): Promise<boolean> {
  return promptBoolean(msg, false);
}
