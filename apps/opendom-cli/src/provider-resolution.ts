import * as cfg from "./config/index.js";
import { normalizeProviderId } from "./login-flow.js";
import type { ProviderId } from "./providers/types.js";

function getFlag(commandArgs: string[], names: string[]): string | undefined {
  for (const name of names) {
    const eqMatch = commandArgs.find((arg) => arg.startsWith(`${name}=`));
    if (eqMatch) {
      return eqMatch.split("=").slice(1).join("=");
    }

    const index = commandArgs.indexOf(name);
    if (
      index !== -1 &&
      commandArgs[index + 1] &&
      !commandArgs[index + 1].startsWith("-")
    ) {
      return commandArgs[index + 1];
    }
  }

  return undefined;
}

export function providerFromFlag(
  commandArgs: string[],
): ProviderId | undefined {
  const raw = getFlag(commandArgs, ["--provider"]);
  if (!raw) {
    return undefined;
  }
  return normalizeProviderId(raw);
}

export function setConfiguredDefaultProvider(provider: ProviderId): void {
  if (!cfg.getProvider(provider)) {
    throw new Error(
      `Provider '${provider}' is not configured. Run: opendom login ${provider}`,
    );
  }

  cfg.setDefaultProvider(provider);
}

export function resolveProviderForCommand(commandArgs: string[]): ProviderId {
  const explicit = providerFromFlag(commandArgs);
  if (explicit) {
    return explicit;
  }

  const configuredProviders = cfg.listConfiguredProviders();
  const savedDefault = cfg.getDefaultProvider();
  if (savedDefault && configuredProviders.includes(savedDefault)) {
    return savedDefault;
  }

  if (configuredProviders.length === 1) {
    return configuredProviders[0];
  }

  if (configuredProviders.length === 0) {
    throw new Error(
      "No provider is configured. Run: opendom login <provider> first.",
    );
  }

  throw new Error(
    "No default provider selected. Run: opendom set-default <provider> or pass --provider <provider>.",
  );
}
