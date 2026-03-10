# Design Doc: 2026-03-11 - Documentation Platform Refresh

## Overview
This design outlines the "Unified Portfolio Hub" refresh for the `opendom` documentation platform. The goal is to highlight the multi-provider abstraction layer as the primary value proposition for human developers while laying the groundwork for AI agent skills.

## Architecture
- **Platform:** [Vocs](https://vocs.dev/) (React + Vite)
- **Location:** `apps/docs-web/`
- **Deployment:** Static site generation

## Landing Page: "Unified Portfolio Hub"
The landing page (`apps/docs-web/docs/pages/index.mdx`) will be redesigned to showcase the multi-provider integration.

### Components
1. **Hero:** 
   - Title: `opendom: One CLI for all your domains`
   - Tagline: `Unified domain management from your terminal. Connect to Netim, Cloudflare, Porkbun, and Namecheap without the upsells.`
2. **Unified Feature Grid:**
   - **Multi-Provider Sync:** Manage domains across four major registrars from a single session.
   - **Identical Command Surface:** Commands like `opendom dns set` work uniformly across providers.
   - **Zero-Friction Operations:** No popups or "special offers," just the domain operations you need.
   - **Predictable Safety:** Built-in `--dry-run` and mandatory `--yes` flags.
3. **Code Preview:** A mockup of the `opendom domains --all` command showing a unified table of domains from multiple registrars.

## New Documentation Structure
The following pages will be added to fulfill the technical requirements of PRDs 03, 04, and 05:

1. **Safety & Reliability (`/safety.mdx`):** 
   - Philosophopy of "Explicit Intent".
   - Detailed explanation of `--dry-run`.
   - List of all CLI exit codes (0-7) for script authors.
2. **Provider Matrix (`/providers/matrix.mdx`):** 
   - A high-level comparison table showing support for `buy`, `renew`, and `dns-ns`.
   - Provider selection criteria (Price vs. Features vs. Reliability).
3. **Command Cheat Sheet (`/reference.mdx`):** 
   - A dense, searchable reference of every command group (Auth, Domains, DNS, Account) and their flags.

## Sidebar & Navigation Changes
`vocs.config.ts` will be updated to include:
- `Reference` group for the Cheat Sheet.
- `Safety` group for the Reliability guide.
- `Providers` group for the Capability Matrix.

## Success Criteria
- Landing page clearly communicates multi-provider support.
- All core commands and exit codes are documented in the reference.
- Provider capabilities are easily discoverable via the matrix.
