# AGENTS.md — obsidian-gfm-anchor

> Agent instructions for GitHub Copilot coding agent and VS Code agent mode.
> This file is automatically read by Copilot when working in this repository.

## Project Identity

**obsidian-gfm-anchor** — An Obsidian plugin that makes GFM (GitHub Flavored Markdown) anchor links work natively in Obsidian without modifying any file contents.

- **Language:** TypeScript (strict mode)
- **Platform:** Obsidian Plugin API (desktop only)
- **Build system:** esbuild via `pnpm`
- **Minimum Obsidian:** 1.4.0
- **Dependencies:** Zero runtime dependencies beyond Obsidian API

## Build & Validation Commands

Always run `pnpm install` before any other command if `node_modules/` is missing.

```bash
pnpm install          # Install dependencies (always run first)
pnpm run build        # Production build → main.js at root
pnpm run dev          # Development build with watch mode
pnpm test             # Run Vitest unit tests
pnpm exec tsc --noEmit  # Type-check without emitting files
```

Build output is a single `main.js` file in the repository root.

## Architecture

```text
src/
├── main.ts           # Plugin entry point — orchestrator
├── slug.ts           # GFM slug algorithm + slug map (PURE, no Obsidian API)
├── reading-mode.ts   # MarkdownPostProcessor for Reading Mode click & hover
├── hover.ts          # Intercept 'hover-link' event for Page Preview
├── live-preview.ts   # CodeMirror 6 ViewPlugin for Live Preview click
└── resolver.ts       # Shared: resolve GFM slug → original heading text
```

**Data flow:**

```text
User click/hover anchor → isGFMSlug(fragment)?
  ├─ Yes → buildSlugMap(headings) → resolveSlug() → navigate to OFM heading
  └─ No  → passthrough to Obsidian default handler
```

**Key config files:**

- `manifest.json` — Obsidian plugin manifest
- `tsconfig.json` — TypeScript config (strict, ES2022, bundler resolution)
- `esbuild.config.mjs` — Build configuration
- `package.json` — Package manifest with scripts
- `vitest.config.ts` — Test configuration (if exists)

## Critical Algorithm — GFM Slug

```typescript
function toGFMSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // Unicode-aware
    .trim()
    .replace(/\s+/g, '-');
}
```

The `u` flag and `\p{L}` are **mandatory** — without them non-ASCII characters (é, ñ, ü) are incorrectly removed.

Duplicate headings use GFM suffix convention: `#section`, `#section-1`, `#section-2`.

## Coding Conventions

### Must Follow

- **Strict TypeScript** — no `any`, use `unknown` + type guards
- **`import type`** for type-only imports from `obsidian`
- **Unicode-aware regex** — always use `u` or `gu` flag
- **kebab-case** filenames, **camelCase** functions, **PascalCase** classes
- **`@ts-expect-error`** instead of `@ts-ignore` when suppressing errors
- **`console.warn('[gfm-anchor]', ...)`** prefix for all debug logging
- Use `this.registerMarkdownPostProcessor()`, `this.registerEvent()`, `this.registerEditorExtension()` for auto-cleanup

### Must NOT Do

- **Never mutate vault files** — all transformations are runtime DOM/event only
- **Never use `innerHTML`** or string concatenation for DOM (XSS risk)
- **Never add settings/UI** — this is a zero-config plugin
- **Never import external libraries** (lodash, etc.)
- **Never show error modals/alerts** — fail silently with console.warn
- **Never use `@ts-ignore`** — use `@ts-expect-error` if needed

### Testing

- **Vitest** for unit tests on `src/slug.ts` (pure logic, no Obsidian API)
- Test files: `src/*.test.ts` or `src/*.spec.ts`
- Manual testing in dev vault with `test-fixture.md`

## Validation Checklist

Before considering any change complete:

1. `pnpm exec tsc --noEmit` passes with zero errors
2. `pnpm test` passes all unit tests
3. `pnpm run build` produces `main.js` without errors
4. No `any` types introduced
5. No file mutation logic added
6. All regex uses `u`/`gu` flag for Unicode support
