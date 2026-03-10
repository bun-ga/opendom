# Repository Guidelines

## Project Structure & Module Organization
This repository is a Bun workspace managed by Turborepo. Use package boundaries intentionally and keep shared logic in `packages/`.

### Top-Level Layout
- `apps/opendom-cli`: main CLI application (`@bun-ga/opendom`), provider integrations, command wiring, and terminal UX.
- `apps/docs-web`: Vocs-based documentation site.
- `packages/tsconfig`: shared TypeScript preset packages.
- `docs/`: provider notes, testing checklists, and implementation plans.
- `scripts/smoke`: smoke test utilities and preflight checks.

### Source and Build Outputs
- TypeScript source lives under each package’s `src/`.
- Test files live under package-level `tests/` directories.
- Build output is `dist/` per package/app and should not be committed.

### Architecture Notes
- CLI command surface is implemented in `apps/opendom-cli/src/index.ts`.
- Provider implementations are under `apps/opendom-cli/src/providers/<provider>/`.
- Cross-cutting configuration state is centralized in `apps/opendom-cli/src/config/`.

## Build, Test, and Development Commands
Run commands from repository root unless stated otherwise.

### Workspace Commands
- `bun install`: install all workspace dependencies from `bun.lock`.
- `bun run dev`: run package `dev` scripts through Turbo in parallel (where available).
- `bun run build`: build all buildable workspaces (`dist/**` outputs).
- `bun run start`: run the built CLI via Turbo filter (`@bun-ga/opendom`).
- `bun run typecheck`: run TypeScript no-emit checks across workspace.
- `bun run lint`: run Biome checks in all packages that define lint scripts.
- `bun run test`: run package tests (Bun test runner).
- `bun run clean`: remove package build artifacts.

### Targeted Commands
- `bunx turbo run build --filter=@bun-ga/opendom`: build only CLI and dependencies.
- `bunx turbo run test --filter=@bun-ga/opendom`: run tests for the CLI package.
- `bunx turbo run build --affected`: build only changed packages (and dependents) in CI/local workflows.

### Smoke and OT&E Commands
- `bun run test:smoke:preflight`: validates local config and prerequisites.
- `bun run test:smoke:read`: runs non-mutating provider checks.
- `bun run test:smoke:<provider>`: provider-scoped smoke flow (`netim`, `cloudflare`, `porkbun`, `namecheap`).

Use smoke tests only with OT&E/test credentials and disposable domains.

## Coding Style & Naming Conventions
### Language and Runtime
- TypeScript + Node.js ESM in all core packages.
- Keep relative import specifiers explicit with `.js` extension in `.ts` files.
  - Example: `import { createClient } from "./api/netim.js";`

### Formatting and Linting
- Indentation: 2 spaces.
- Use semicolons.
- Use double quotes.
- Run `bun run lint` before opening a PR.
- Prefer small, composable functions over large command handlers.

### Naming
- `camelCase`: variables, functions, parameters.
- `PascalCase`: classes, types, interfaces.
- `kebab-case`: directories and non-type filenames where appropriate.
- Test files must use `*.test.ts`.

### Monorepo Task Conventions
- Define task logic in each package’s `package.json`.
- Register task orchestration in root `turbo.json`.
- Root scripts should delegate to Turbo (`turbo run <task>`), not reimplement package logic inline.

## Testing Guidelines
### Framework and Scope
- Test runner: `bun test`.
- Existing test suites:
  - `apps/opendom-cli/tests`

### Expectations for Changes
- Add or update tests for behavioral changes in command parsing, provider behavior, or shared config logic.
- Keep tests deterministic; do not rely on live provider APIs in the default suite.
- Prefer fetch/network mocking for provider tests.
- For API-contract or integration behavior changes, include manual OT&E evidence in PR notes.

### Local Verification Sequence
Use this baseline before requesting review:
1. `bun run build`
2. `bun run typecheck`
3. `bun run lint`
4. `bun run test`

If a step is intentionally skipped, document why in the PR.

## Commit & Pull Request Guidelines
### Commit Messages
Follow concise typed prefixes used in project history:
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `merge: ...` (only for explicit merge commits)

Examples:
- `fix: handle missing netim owner resolution`
- `docs: update provider capability notes`

Keep each commit focused to one logical unit of change.

### Pull Request Requirements
Each PR should include:
- Short summary of what changed.
- User-facing impact (CLI flags, output, behavior).
- Verification commands run and results.
- Linked issue/task if applicable.
- Sample CLI output when command behavior changes.
- OT&E notes for provider/API changes.

### Review Readiness Checklist
- No generated artifacts (`dist/`, temp files) committed.
- Tests added/updated for changed behavior.
- Docs updated when CLI behavior or flags changed.
- Sensitive data removed from examples and logs.

## Security & Configuration Tips
- Never commit reseller IDs, API keys, secrets, or session tokens.
- Treat `~/.config/opendom/config.json` as sensitive local state.
- Use sandbox/test credentials for smoke and mutating checks.
- Do not run mutating smoke flows against production domains.
- Redact provider identifiers from screenshots, logs, and PR descriptions.

## Turborepo & Workspace Practices
- Keep dependency direction clean: apps can depend on packages; avoid circular dependencies.
- Use `--filter` for fast local iteration and `--affected` for incremental CI.
- Ensure `build` task outputs are declared in `turbo.json` to benefit from caching.
- For new packages, provide at minimum: `build`, `typecheck`, `lint`, `test`, `clean` scripts when applicable.

## Contributor Workflow (Recommended)
1. Sync branch and inspect workspace status.
2. Make focused changes in the smallest relevant package.
3. Run targeted tests first, then full workspace verification.
4. Update docs (`README.md`, `docs/providers/*`, or command help) when behavior changes.
5. Open PR with clear impact statement and verification evidence.

This guide is intended to keep contributions predictable, testable, and safe across the monorepo.
