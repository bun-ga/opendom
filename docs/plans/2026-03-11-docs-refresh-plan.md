# Docs Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the docs landing page and add missing technical guides (Safety, Provider Matrix, Reference).

**Architecture:** Vocs-based static site updates in `apps/docs-web/`. Content authored in MDX.

**Tech Stack:** React, Vocs, TypeScript, Markdown/MDX.

---

### Task 1: Update Sidebar & Navigation
**Files:**
- Modify: `apps/docs-web/vocs.config.ts`

**Step 1: Expand Sidebar Configuration**
Add the new sections for `Providers`, `Safety`, and `Reference` to the sidebar array.

**Step 2: Commit**
`git add apps/docs-web/vocs.config.ts && git commit -m "docs: expand sidebar navigation"`

---

### Task 2: Redesign Landing Page
**Files:**
- Modify: `apps/docs-web/docs/pages/index.mdx`

**Step 1: Implement "Unified Hub" Hero & Features**
Update `index.mdx` to use the "One CLI for all your domains" title and the "Unified Hub" tagline. Add the feature descriptions.

**Step 2: Add Unified Command Preview**
Insert a code block demonstrating the `opendom domains --all` mockup from the design doc.

**Step 3: Commit**
`git add apps/docs-web/docs/pages/index.mdx && git commit -m "docs: redesign landing page to Unified Hub approach"`

---

### Task 3: Create Safety & Reliability Page
**Files:**
- Create: `apps/docs-web/docs/pages/safety.mdx`

**Step 1: Write Safety Content**
Draft the content based on PRD 04, covering the Philosophy of Explicit Intent, `--dry-run` usage, and the exit code table.

**Step 2: Commit**
`git add apps/docs-web/docs/pages/safety.mdx && git commit -m "docs: add safety and reliability guide"`

---

### Task 4: Create Provider Matrix Page
**Files:**
- Create: `apps/docs-web/docs/pages/providers-matrix.mdx`

**Step 1: Build Capability Matrix Table**
Create a table comparing Netim, Cloudflare, Porkbun, and Namecheap across core operations (`buy`, `renew`, `dns-ns`, etc.).

**Step 2: Commit**
`git add apps/docs-web/docs/pages/providers-matrix.mdx && git commit -m "docs: add provider capability matrix"`

---

### Task 5: Create Command Reference Page
**Files:**
- Create: `apps/docs-web/docs/pages/reference.mdx`

**Step 1: Write Comprehensive Cheat Sheet**
List all commands (Auth, Domains, DNS, Account) with syntax examples and flag descriptions.

**Step 2: Commit**
`git add apps/docs-web/docs/pages/reference.mdx && git commit -m "docs: add searchable command reference"`

---

### Task 6: Final Review & Verification
**Step 1: Build Docs Locally**
Run `bun run docs:build` in the root (or `bunx turbo run build --filter=docs-web`).

**Step 2: Fix Broken Links**
Ensure all internal links (especially the new sidebar entries) resolve correctly.

**Step 3: Commit**
`git commit -m "docs: final documentation refresh cleanup"`
