# Product Requirements Documents (PRDs) Index

## Introduction

**opendom** is a command-line interface (CLI) tool for domain management. It provides a unified interface to search, purchase, renew, and manage domain names across multiple domain registrars — all from your terminal. Built with AI agents in mind, opendom enables programmatic domain operations through a clean, scriptable API without the friction of web dashboards, upsells, or popups.

## Product Vision

> **"Domain management from your terminal. No upsells, no popups. Built for AI Agents."**

opendom is designed to be the definitive CLI for domain operations, prioritizing automation, scriptability, and agent usability over marketing-driven UX.

## Target Users

| Segment | Description |
|---------|-------------|
| **Primary** | AI Agents (e.g., OpenClaw, NanoBot, PicoClaw) that need to programmatically register and manage domains as part of autonomous workflows |
| **Secondary** | Individual developers who prefer terminal-based workflows for domain management |

## Problem Statement

Domain management has become synonymous with web-based dashboards filled with upsells, cross-selling, and distracting popups. For developers and especially AI agents, this creates friction:

- **No CLI-first experience**: Most registrars lack robust command-line interfaces
- **Agent-hostile UX**: CAPTCHAs, session timeouts, and browser detection block automated workflows
- **Provider fragmentation**: Each registrar has its own API, authentication model, and capability set
- **Safety gaps**: Destructive operations (purchases, transfers, deletions) lack proper safeguards for autonomous agents

opendom solves these problems by providing a unified, agent-friendly CLI that abstracts provider complexity while enforcing safety best practices.

## Business Model

**Fully Free & Open Source**

- No paid tiers, no freemium limitations
- MIT Licensed
- Community-driven development
- No vendor lock-in

## Platforms

opendom supports all major desktop and server platforms:

- **Linux** — Ubuntu, Debian, Fedora, Arch, and all major distributions
- **macOS** — Apple Silicon (ARM64) and Intel (x86_64)
- **Windows** — Windows 10/11 via WSL or native support

---

## PRD Documents

| # | PRD | Title | Description |
|---|-----|-------|-------------|
| 01 | [Core CLI Product](./PRD-01-core-cli-product.md) | Core CLI Product | Domain management features: search, buy, renew, DNS, preferences, balance |
| 02 | [AI Agent Integration](./PRD-02-ai-agent-integration.md) | AI Agent Integration | Agent usability: shell execution, structured output, dry-run, idempotency |
| 03 | [Multi-Provider Strategy](./PRD-03-multi-provider-strategy.md) | Multi-Provider Strategy | Provider ecosystem: 4 providers with unified interface, capability matrix |
| 04 | [Safety & Reliability](./PRD-04-safety-reliability.md) | Safety & Reliability | Agent safety: dry-run, explicit confirmation, rate limiting, error handling |
| 05 | [Documentation Platform](./PRD-05-documentation-platform.md) | Documentation Platform | Docs website: getting started, auth guides, command reference |

---

## Development Stage

> **Alpha / Early Beta**

opendom is currently in active development. The core CLI is functional but may undergo breaking changes. Providers are being added incrementally with smoke tests against test credentials.

### What's Ready

- Basic domain search across supported providers
- CLI command structure and argument parsing
- Provider abstraction layer

### In Progress

- Full purchase and renewal flows
- DNS management integration
- Documentation site

### Roadmap

- Complete provider integrations (Netim, Cloudflare, Porkbun, Namecheap)
- Enhanced safety features (dry-run by default, confirmation modes)
- Structured output modes for AI agent consumption

---

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines, coding standards, and pull request procedures.

---

*Last updated: March 2026*
