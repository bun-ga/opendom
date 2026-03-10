# opendom: Project Overview & Developer Guide

## Project Overview
`opendom` is a unified, terminal-first domain management platform. It provides a consistent CLI interface for managing domains across multiple registrars (Netim, Cloudflare, Porkbun, Namecheap), eliminating the friction of web-based dashboards, upsells, and popups.

### Architecture
This project is a **Bun monorepo** managed by **Turborepo**.
- **`apps/opendom-cli`**: The core TypeScript CLI application.
- **`apps/docs-web`**: A [Vocs](https://vocs.dev/) powered documentation site.
- **`packages/config`**: Shared utilities for handling configuration, credentials, and session state.
- **`packages/tsconfig`**: Centralized TypeScript configuration presets.

### Key Technologies
- **Runtime:** Bun
- **Language:** TypeScript (ESM)
- **Orchestration:** Turborepo
- **Linting/Formatting:** Biome
- **Docs Engine:** Vocs

---

## Building and Running

### Workspace Commands
Run these from the repository root:
- **Install Dependencies:** `bun install`
- **Build All:** `bun run build`
- **Typecheck All:** `bun run typecheck`
- **Lint All:** `bun run lint`
- **Test All:** `bun run test` (uses Bun's native test runner)
- **Clean Artifacts:** `bun run clean`

### Target-Specific Commands
- **Run CLI in Dev Mode:** `bun run start` (or `bunx turbo run dev --filter=@opendom/cli`)
- **Run Docs in Dev Mode:** `bunx turbo run dev --filter=docs-web`
- **Build CLI Only:** `bunx turbo run build --filter=@opendom/cli`

### Smoke Testing (OT&E)
- **Generic Preflight:** `bun run test:smoke:preflight`
- **Provider-Scoped Smoke:** `bun run test:smoke:<provider>` (e.g., `netim`, `cloudflare`)

---

## Development Conventions

### Coding Style
- **Formatting:** 2-space indentation, double quotes, mandatory semicolons (managed by Biome).
- **ESM Imports:** You MUST include the `.js` extension in relative imports within `.ts` files (e.g., `import { foo } from "./utils.js";`).
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/classes, `kebab-case` for directories and file names.

### Provider Integration
- All registrars must implement the `ProviderAdapter` interface in `apps/opendom-cli/src/providers/types.ts`.
- Capabilities (what each provider supports) are defined in `apps/opendom-cli/src/providers/capabilities.ts`.

### Security Guardrails
- **Credential Storage:** Never commit `~/.config/opendom/config.json`.
- **Explicit Intent:** Destructive operations (buy, renew, dns rm) MUST require the `--yes` or `-y` flag.
- **Safety Mode:** All mutating commands should support a `--dry-run` flag for previewing impacts.

### Testing Practices
- **Unit Tests:** Located in `tests/` directories within each package.
- **Determinism:** Mock all network/provider API calls in standard tests.
- **Smoke Tests:** Use only for OT&E with test credentials; do not run against production domains.

---

## Success Criteria for Contributions
1. **Verification:** `bun run build && bun run typecheck && bun run lint && bun run test` must pass.
2. **Docs:** Update the "Provider Matrix" or "Command Reference" in `apps/docs-web` if behavior changes.
3. **Safety:** Ensure all new mutating commands implement confirmation logic and dry-run support.
