#!/usr/bin/env node
import * as cfg from "@opendom/config";
import {
  collectInteractiveLoginInput,
  normalizeProviderId,
  resolveLoginMode,
} from "./login-flow.js";
import {
  providerFromFlag,
  resolveProviderForCommand,
  setConfiguredDefaultProvider,
} from "./provider-resolution.js";
import { CapabilityError } from "./providers/errors.js";
import { createProvider } from "./providers/factory.js";
import type {
  ProviderAuthInput,
  ProviderId,
  ProviderPreference,
} from "./providers/types.js";
import {
  Spinner,
  c,
  confirm,
  formatDomain,
  formatPrice,
  formatStatus,
  kv,
  log,
  sym,
} from "./ui.js";

const VERSION = "0.2.0";

const HELP = `
${c.bold(c.cyan("opendom"))} ${c.dim(`v${VERSION}`)}
${c.dim("Domain management from your terminal. No upsells, no popups.")}

${c.bold("USAGE")}
  opendom <command> [options]

${c.bold("AUTH")}
  login  <provider>
  login  --provider <provider> [provider-specific auth flags]
  set-default <provider>
  logout [--provider <provider>]
  logout --all

${c.bold("DOMAINS")}
  search  <name> [--tlds com,io,dev] [--provider <provider>] [--price]
  buy     <domain> [--yes] [--duration] [--owner <contactId>] [--provider <provider>]
  domains [--provider <provider>]
  info    <domain> [--provider <provider>]
  renew   <domain> [--yes] [--duration] [--provider <provider>]
  set     <domain> <pref> <on|off> [--provider <provider>]

${c.bold("DNS")}
  dns list   <domain> [--provider <provider>]
  dns set    <domain> <TYPE> <VALUE> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]
  dns rm     <domain> <TYPE> <VALUE> [--subdomain <sub>] [--provider <provider>]
  dns update <domain> <TYPE> <OLD> <NEW> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]
  dns ns     <domain> <ns1> <ns2> [ns3...] [--provider <provider>]

${c.bold("ACCOUNT")}
  balance [--provider <provider>]

${c.bold("PROVIDERS")}
  netim | cloudflare | porkbun | namecheap

${c.bold("LOGIN FLAGS")}
  Netim:      --id --secret [--ote]
  Cloudflare: --token [--account-id]
  Porkbun:    --apikey --secretapikey
  Namecheap:  --api-user --username --api-key --client-ip [--sandbox] [--address-id <ADDRESS_ID>]

${c.bold("GLOBAL OPTIONS")}
  --provider    Override the saved default provider for this command
  --help, -h    Show this help
  --version, -v Show version
`;

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(HELP);
  process.exit(0);
}

if (cmd === "--version" || cmd === "-v") {
  console.log(VERSION);
  process.exit(0);
}

function getArg(index: number, name: string): string {
  const val = args[index];
  if (!val || val.startsWith("-")) {
    log.err(`Missing required argument: <${name}>`);
    process.exit(1);
  }
  return val;
}

function getFlag(names: string[]): string | undefined {
  for (const name of names) {
    const eqMatch = args.find((a) => a.startsWith(`${name}=`));
    if (eqMatch) return eqMatch.split("=").slice(1).join("=");
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("-"))
      return args[idx + 1];
  }
  return undefined;
}

function hasFlag(names: string[]): boolean {
  return names.some((n) => args.includes(n));
}

function canonicalPreference(pref: string): ProviderPreference {
  const key = pref.toLowerCase();
  if (key === "whois-privacy" || key === "privacy") return "whois-privacy";
  if (key === "auto-renew" || key === "autorenew") return "auto-renew";
  if (key === "lock" || key === "registrar-lock") return "lock";
  throw new Error(
    `Unknown preference: ${pref}. Use: whois-privacy, auto-renew, lock`,
  );
}

async function main() {
  try {
    switch (cmd) {
      case "login":
        await cmdLogin();
        return;
      case "logout":
        await cmdLogout();
        return;
      case "set-default":
        await cmdSetDefault();
        return;
      case "balance":
        await cmdBalance();
        return;
      case "search":
        await cmdSearch();
        return;
      case "buy":
        await cmdBuy();
        return;
      case "domains":
      case "ls":
        await cmdDomains();
        return;
      case "info":
        await cmdInfo();
        return;
      case "renew":
        await cmdRenew();
        return;
      case "set":
        await cmdSet();
        return;
      case "dns":
        await cmdDns();
        return;
      default:
        log.err(`Unknown command: ${cmd}`);
        console.log(c.dim("Run `opendom --help` for usage."));
        process.exit(1);
    }
  } catch (error: unknown) {
    if (error instanceof CapabilityError) {
      log.err(error.message);
      process.exit(1);
    }

    const message = error instanceof Error ? error.message : String(error);
    log.err(message);
    if (process.env.OPENDOM_DEBUG && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function cmdLogin() {
  const loginProvider = providerFromFlag(args);
  const { provider: providerId, interactive } = resolveLoginMode(
    args,
    loginProvider,
  );
  const provider = createProvider(providerId);

  const input = interactive
    ? await collectInteractiveLoginInput(providerId)
    : readLoginFlags();

  const sp = new Spinner(`Validating ${providerId} credentials...`).start();
  await provider.login(input);
  sp.stop();

  log.ok(`${providerId} authenticated successfully.`);
  log.info(`Config saved to ${c.dim(cfg.configPath)}`);
  if (cfg.getProviderSecretStorageMode(providerId) === "plaintext") {
    log.warn(
      "Encrypted storage is unavailable. Credentials were saved in plaintext config for compatibility.",
    );
  }

  try {
    const account = await provider.balance();
    console.log();
    console.log(c.bold("  Account Overview"));
    console.log(c.dim("  ─────────────────"));
    const rows: [string, string][] = [["Provider", providerId]];
    if (typeof account.balance === "number") {
      rows.push([
        "Balance",
        formatPrice(account.balance, account.currency || "USD"),
      ]);
    }
    if (account.currency) rows.push(["Currency", account.currency]);
    if (account.reportThreshold)
      rows.push(["Report threshold", account.reportThreshold]);
    if (account.blockThreshold)
      rows.push(["Block threshold", account.blockThreshold]);
    if (typeof account.autoRenew === "boolean")
      rows.push(["Auto-renew", account.autoRenew ? "ON" : "OFF"]);
    if (account.details) {
      for (const [k, v] of Object.entries(account.details)) {
        if (v == null) continue;
        rows.push([k, String(v)]);
      }
    }
    kv(rows);
    console.log();
  } catch {
    // Optional balance summary.
  }
}

function readLoginFlags(): ProviderAuthInput {
  return {
    id: getFlag(["--id"]),
    secret: getFlag(["--secret"]),
    ote: hasFlag(["--ote"]),
    token: getFlag(["--token"]),
    "account-id": getFlag(["--account-id"]),
    apikey: getFlag(["--apikey"]),
    secretapikey: getFlag(["--secretapikey"]),
    "api-user": getFlag(["--api-user"]),
    username: getFlag(["--username"]),
    "api-key": getFlag(["--api-key"]),
    "client-ip": getFlag(["--client-ip"]),
    "address-id": getFlag(["--address-id"]),
    sandbox: hasFlag(["--sandbox"]),
  };
}

async function cmdSetDefault() {
  const providerId = normalizeProviderId(getArg(1, "provider"));
  setConfiguredDefaultProvider(providerId);
  log.ok(`Default provider set to ${providerId}.`);
}

async function cmdLogout() {
  if (hasFlag(["--all"])) {
    cfg.clearAll();
    log.ok("All provider credentials cleared.");
    return;
  }

  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);
  await provider.logout();
  cfg.clearProvider(providerId);
  log.ok(`${providerId} credentials cleared.`);
}

async function cmdBalance() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const sp = new Spinner("Fetching account info...").start();
  const account = await provider.balance();
  sp.stop();

  console.log();
  console.log(c.bold("  Account Overview"));
  console.log(c.dim("  ─────────────────"));
  const rows: [string, string][] = [["Provider", providerId]];
  if (typeof account.balance === "number")
    rows.push([
      "Balance",
      formatPrice(account.balance, account.currency || "USD"),
    ]);
  if (account.currency) rows.push(["Currency", account.currency]);
  if (account.reportThreshold)
    rows.push(["Report threshold", account.reportThreshold]);
  if (account.blockThreshold)
    rows.push(["Block threshold", account.blockThreshold]);
  if (typeof account.autoRenew === "boolean")
    rows.push(["Domain auto-renew", account.autoRenew ? "ON" : "OFF"]);
  if (account.details) {
    for (const [k, v] of Object.entries(account.details)) {
      if (v == null) continue;
      rows.push([k, String(v)]);
    }
  }
  if (rows.length === 1)
    rows.push(["Info", "No balance fields exposed by provider API."]);
  kv(rows);
  console.log();
}

async function cmdSearch() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const name = getArg(1, "name");
  const tldsStr = getFlag(["--tlds", "-t"]) || "com,net,org,io,dev,app,co";
  const showPrice = hasFlag(["--price"]);

  const hasTld = name.includes(".");
  const tlds = tldsStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const domains = hasTld ? [name] : tlds.map((t) => `${name}.${t}`);

  const sp = new Spinner("Searching...").start();
  const search = await provider.search(domains, showPrice);
  sp.stop();

  console.log();
  for (const domain of domains) {
    const result = search.results[domain];
    if (!result) continue;
    const status = result.result;
    const icon =
      status === "available"
        ? sym.avail
        : status === "premium"
          ? sym.premium
          : sym.taken;
    const price =
      showPrice && search.prices[domain]
        ? `  ${formatPrice(search.prices[domain])}`
        : "";
    console.log(
      `  ${icon} ${formatDomain(domain)}  ${formatStatus(status)}${price}`,
    );
  }

  console.log();
  const available = Object.values(search.results).filter(
    (entry) => entry.result === "available",
  ).length;
  if (available > 0) {
    console.log(
      c.dim(
        `  ${available} available. Register with: opendom buy <domain> --provider ${providerId}`,
      ),
    );
  } else {
    console.log(c.dim("  No domains available with these TLDs."));
  }
  console.log();
}

async function cmdBuy() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const domain = getArg(1, "domain");
  const yes = hasFlag(["--yes", "-y"]);
  const duration = Number.parseInt(getFlag(["--duration", "-d"]) || "1", 10);
  const ns1 = getFlag(["--ns1"]);
  const ns2 = getFlag(["--ns2"]);
  const owner = getFlag(["--owner"]);
  const addressId = getFlag(["--address-id"]);

  try {
    const check = await provider.search([domain], false);
    const status = check.results[domain]?.result;
    if (status && status !== "available") {
      log.err(`${domain} is ${formatStatus(status)}. Cannot register.`);
      process.exit(1);
    }
  } catch {
    // Some providers intentionally do not expose search.
  }

  console.log();
  console.log(c.bold("  Registration Summary"));
  console.log(c.dim("  ────────────────────"));
  const summary: [string, string][] = [
    ["Provider", providerId],
    ["Domain", formatDomain(domain)],
    ["Duration", `${duration} year(s)`],
  ];
  if (owner) summary.push(["Owner contact", owner]);
  if (ns1 || ns2)
    summary.push([
      "Nameservers",
      `${ns1 || "(provider default)"}, ${ns2 || "(provider default)"}`,
    ]);
  kv(summary);
  console.log();

  if (!yes) {
    const ok = await confirm("Confirm registration?");
    if (!ok) {
      log.info("Cancelled.");
      process.exit(0);
    }
  }

  const sp = new Spinner("Registering domain...").start();
  const result = await provider.buy(domain, {
    duration,
    ownerId: owner || undefined,
    addressId,
    nameservers: ns1 ? [ns1, ...(ns2 ? [ns2] : [])] : undefined,
  });
  sp.stop();

  if (result.status === "DONE") {
    log.ok(`${domain} is now registered on ${providerId}.`);
    return;
  }
  if (result.status === "PENDING") {
    log.warn(
      `Registration is ${formatStatus("pending")}. Op: ${String(result.operationId || "N/A")}`,
    );
    return;
  }
  log.err(result.message || "Registration failed");
  process.exit(1);
}

async function cmdDomains() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const sp = new Spinner("Fetching domains...").start();
  const domains = await provider.domains();
  sp.stop();

  console.log();
  if (domains.length > 0) {
    console.log(c.bold(`  Your Domains (${domains.length})`));
    console.log(c.dim("  ──────────────────────────"));
    for (const domain of domains) {
      const expiration = domain.dateExpiration
        ? c.dim(` expires ${domain.dateExpiration}`)
        : "";
      const ar = domain.autoRenew ? c.green(" [auto-renew]") : "";
      console.log(
        `  ${sym.dot} ${formatDomain(domain.domainName)}${expiration}${ar}`,
      );
    }
  } else {
    console.log(c.dim("  No domains found."));
  }
  console.log();
}

async function cmdInfo() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const domain = getArg(1, "domain");
  const sp = new Spinner(`Fetching info for ${domain}...`).start();
  const info = await provider.info(domain);
  sp.stop();

  console.log();
  console.log(c.bold(`  ${formatDomain(domain)}`));
  console.log(c.dim("  ──────────────────────────"));

  const rows: [string, string][] = [["Provider", providerId]];
  if (info.status) rows.push(["Status", formatStatus(info.status)]);
  if (info.dateCreate) rows.push(["Created", info.dateCreate]);
  if (info.dateExpiration) rows.push(["Expires", info.dateExpiration]);
  if (info.nameservers) {
    info.nameservers.forEach((ns, index) => rows.push([`NS${index + 1}`, ns]));
  }
  if (info.ownerId) rows.push(["Owner", info.ownerId]);
  if (typeof info.whoisPrivacy === "boolean")
    rows.push([
      "Whois Privacy",
      info.whoisPrivacy ? c.green("ON") : c.red("OFF"),
    ]);
  if (typeof info.autoRenew === "boolean")
    rows.push(["Auto-Renew", info.autoRenew ? c.green("ON") : c.red("OFF")]);
  if (typeof info.registrarLock === "boolean")
    rows.push([
      "Registrar Lock",
      info.registrarLock ? c.green("ON") : c.red("OFF"),
    ]);
  kv(rows);
  console.log();
}

async function cmdRenew() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const domain = getArg(1, "domain");
  const yes = hasFlag(["--yes", "-y"]);
  const duration = Number.parseInt(getFlag(["--duration", "-d"]) || "1", 10);

  if (!yes) {
    const ok = await confirm(
      `Renew ${formatDomain(domain)} for ${duration} year(s)?`,
    );
    if (!ok) {
      console.log(c.dim("  Cancelled."));
      process.exit(0);
    }
  }

  const sp = new Spinner(`Renewing ${domain}...`).start();
  const result = await provider.renew(domain, duration);
  sp.stop();

  if (result.status === "DONE") {
    log.ok(`${formatDomain(domain)} renewed for ${duration} year(s)!`);
    return;
  }
  if (result.status === "PENDING") {
    log.warn(`Renewal is ${formatStatus("pending")}`);
    return;
  }
  log.err(result.message || "Renewal failed");
  process.exit(1);
}

async function cmdSet() {
  const providerId = resolveProviderForCommand(args);
  const provider = createProvider(providerId);

  const domain = getArg(1, "domain");
  const preference = canonicalPreference(getArg(2, "preference"));
  const val = getArg(3, "value");
  const enabled = ["on", "1", "true", "yes"].includes(val.toLowerCase());

  const sp = new Spinner(
    `Setting ${preference} to ${enabled ? "ON" : "OFF"}...`,
  ).start();
  const result = await provider.setPreference(domain, preference, enabled);
  sp.stop();

  if (result.status === "DONE") {
    log.ok(
      `${preference} is now ${enabled ? c.green("ON") : c.red("OFF")} for ${formatDomain(domain)}`,
    );
    return;
  }
  if (result.status === "PENDING") {
    log.warn(
      `${formatStatus("pending")}: ${result.message || "Operation pending"}`,
    );
    return;
  }
  log.err(result.message || "Preference update failed");
  process.exit(1);
}

async function cmdDns() {
  const provider = createProvider(resolveProviderForCommand(args));

  const sub = args[1];
  if (!sub || sub === "--help" || sub === "-h") {
    console.log(`
${c.bold("DNS Commands")}
  opendom dns list   <domain> [--provider <provider>]
  opendom dns set    <domain> <TYPE> <VALUE> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]
  opendom dns rm     <domain> <TYPE> <VALUE> [--subdomain <sub>] [--provider <provider>]
  opendom dns update <domain> <TYPE> <OLD> <NEW> [--subdomain <sub>] [--ttl <sec>] [--provider <provider>]
  opendom dns ns     <domain> <ns1> <ns2> [ns3...] [--provider <provider>]
`);
    return;
  }

  switch (sub) {
    case "list":
    case "ls": {
      const domain = args[2];
      if (!domain || domain.startsWith("-")) {
        log.err("Usage: opendom dns list <domain>");
        process.exit(1);
      }

      const sp = new Spinner(`Fetching DNS for ${domain}...`).start();
      const records = await provider.dnsList(domain);
      sp.stop();

      console.log();
      console.log(c.bold(`  DNS Records for ${formatDomain(domain)}`));
      console.log(c.dim("  ──────────────────────────────────"));

      if (records.length === 0) {
        console.log(c.dim("  No records found."));
      } else {
        for (const rec of records) {
          const subdomain = rec.subdomain || "@";
          const type = c.cyan((rec.type || "").toUpperCase().padEnd(6));
          const ttl = rec.ttl ? c.dim(`(${rec.ttl}s)`) : "";
          console.log(
            `  ${type} ${c.bold(subdomain.padEnd(20))} ${sym.arrow} ${rec.value} ${ttl}`,
          );
        }
      }
      console.log();
      break;
    }

    case "set":
    case "add": {
      const domain = args[2];
      const type = (args[3] || "").toUpperCase();
      const value = args[4];
      if (
        !domain ||
        domain.startsWith("-") ||
        !type ||
        !value ||
        value.startsWith("-")
      ) {
        log.err("Usage: opendom dns set <domain> <TYPE> <VALUE>");
        process.exit(1);
      }

      const subdomain = getFlag(["--subdomain", "-s"]) || "@";
      const ttl = Number.parseInt(getFlag(["--ttl"]) || "3600", 10);
      const priority = getFlag(["--priority"]) || null;

      const sp = new Spinner(`Adding ${type} record to ${domain}...`).start();
      const result = await provider.dnsSet(domain, type, value, subdomain, {
        ttl,
        priority,
      });
      sp.stop();

      if (result.status === "DONE") {
        log.ok(
          `${type} record added: ${subdomain}.${domain} ${sym.arrow} ${value}`,
        );
      } else if (result.status === "PENDING") {
        log.ok(`DNS change is ${formatStatus("pending")}`);
      } else {
        log.err(result.message || "DNS set failed");
        process.exit(1);
      }
      break;
    }

    case "rm":
    case "delete": {
      const domain = args[2];
      const type = (args[3] || "").toUpperCase();
      const value = args[4];
      if (
        !domain ||
        domain.startsWith("-") ||
        !type ||
        !value ||
        value.startsWith("-")
      ) {
        log.err("Usage: opendom dns rm <domain> <TYPE> <VALUE>");
        process.exit(1);
      }

      const subdomain = getFlag(["--subdomain", "-s"]) || "@";
      const sp = new Spinner(`Removing ${type} record...`).start();
      const result = await provider.dnsRemove(domain, type, value, subdomain);
      sp.stop();

      if (result.status === "DONE") {
        log.ok(`Record removed: ${type} ${value}`);
      } else {
        log.err(result.message || "DNS remove failed");
        process.exit(1);
      }
      break;
    }

    case "update": {
      const domain = args[2];
      const type = (args[3] || "").toUpperCase();
      const oldValue = args[4];
      const newValue = args[5];
      if (
        !domain ||
        domain.startsWith("-") ||
        !type ||
        !oldValue ||
        !newValue ||
        oldValue.startsWith("-") ||
        newValue.startsWith("-")
      ) {
        log.err("Usage: opendom dns update <domain> <TYPE> <OLD> <NEW>");
        process.exit(1);
      }

      const subdomain = getFlag(["--subdomain", "-s"]) || "@";
      const ttl = Number.parseInt(getFlag(["--ttl"]) || "3600", 10);

      const sp = new Spinner("Updating DNS record...").start();
      const result = await provider.dnsUpdate(
        domain,
        type,
        oldValue,
        newValue,
        subdomain,
        ttl,
      );
      sp.stop();

      if (result.status === "DONE") {
        log.ok(`Updated: ${oldValue} ${sym.arrow} ${newValue}`);
      } else {
        log.err(result.message || "DNS update failed");
        process.exit(1);
      }
      break;
    }

    case "ns": {
      const domain = args[2];
      const servers = args.slice(3).filter((a) => !a.startsWith("-"));
      if (!domain || domain.startsWith("-") || servers.length < 2) {
        log.err("Usage: opendom dns ns <domain> <ns1> <ns2> [ns3...]");
        process.exit(1);
      }

      const sp = new Spinner(`Updating nameservers for ${domain}...`).start();
      const result = await provider.dnsNs(domain, servers);
      sp.stop();

      if (result.status === "DONE") {
        log.ok("Nameservers updated:");
        servers.forEach((server, index) =>
          console.log(`  ${c.dim(`NS${index + 1}`)} ${server}`),
        );
      } else if (result.status === "PENDING") {
        log.ok(`Nameserver change is ${formatStatus("pending")}`);
      } else {
        log.err(result.message || "Nameserver update failed");
        process.exit(1);
      }
      break;
    }

    default:
      log.err(`Unknown DNS command: ${sub}`);
      console.log(c.dim("Run `opendom dns --help` for usage."));
      process.exit(1);
  }
}

main();
