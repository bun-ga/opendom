import type { ProviderAuthInput, ProviderId } from "./providers/types.js";
import {
  type PromptIO,
  ensureInteractiveTerminal,
  promptBoolean,
  promptText,
} from "./ui.js";

export interface LoginField {
  key: string;
  label: string;
  kind: "text" | "boolean";
  optional?: boolean;
  secret?: boolean;
}

const INTERACTIVE_LOGIN_FIELDS: Record<ProviderId, readonly LoginField[]> = {
  netim: [
    { key: "id", label: "Reseller ID", kind: "text" },
    { key: "secret", label: "API secret", kind: "text", secret: true },
    { key: "ote", label: "Use OTE", kind: "boolean" },
  ],
  cloudflare: [
    { key: "token", label: "API token", kind: "text", secret: true },
    {
      key: "account-id",
      label: "Account ID (optional)",
      kind: "text",
      optional: true,
    },
  ],
  porkbun: [
    { key: "apikey", label: "API key", kind: "text", secret: true },
    {
      key: "secretapikey",
      label: "Secret API key",
      kind: "text",
      secret: true,
    },
  ],
  namecheap: [
    { key: "api-user", label: "API user", kind: "text" },
    { key: "username", label: "Username", kind: "text" },
    { key: "api-key", label: "API key", kind: "text", secret: true },
    { key: "client-ip", label: "Client IP", kind: "text" },
    { key: "sandbox", label: "Use sandbox", kind: "boolean" },
    {
      key: "address-id",
      label: "Address ID (optional)",
      kind: "text",
      optional: true,
    },
  ],
};

export function normalizeProviderId(input: string): ProviderId {
  const value = input.trim().toLowerCase();
  if (
    value === "netim" ||
    value === "cloudflare" ||
    value === "porkbun" ||
    value === "namecheap"
  ) {
    return value;
  }
  throw new Error(
    `Unknown provider: ${input}. Valid providers: netim, cloudflare, porkbun, namecheap`,
  );
}

export function resolveLoginMode(
  commandArgs: string[],
  fallbackProvider?: ProviderId,
): {
  provider: ProviderId;
  interactive: boolean;
} {
  const positionalProvider = commandArgs[1];
  if (positionalProvider && !positionalProvider.startsWith("-")) {
    return {
      provider: normalizeProviderId(positionalProvider),
      interactive: true,
    };
  }

  if (fallbackProvider) {
    return {
      provider: fallbackProvider,
      interactive: false,
    };
  }

  throw new Error(
    "Login requires a provider. Use: opendom login <provider> or opendom login --provider <provider> ...",
  );
}

export function getInteractiveLoginFields(
  provider: ProviderId,
): readonly LoginField[] {
  return INTERACTIVE_LOGIN_FIELDS[provider];
}

export async function collectInteractiveLoginInput(
  provider: ProviderId,
  promptIO?: PromptIO,
): Promise<ProviderAuthInput> {
  try {
    ensureInteractiveTerminal(promptIO);
  } catch {
    throw new Error(
      `Interactive login requires a TTY. Use: opendom login --provider ${provider} ...`,
    );
  }

  const input: ProviderAuthInput = {};
  for (const field of getInteractiveLoginFields(provider)) {
    if (field.kind === "boolean") {
      input[field.key] = await promptBoolean(field.label, false, promptIO);
      continue;
    }

    const value = await promptText(
      field.label,
      {
        required: field.optional !== true,
        secret: field.secret,
      },
      promptIO,
    );
    if (field.optional && value.length === 0) {
      continue;
    }
    input[field.key] = value;
  }

  return input;
}
