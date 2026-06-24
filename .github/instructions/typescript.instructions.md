---
applyTo: "src/**/*.ts"
---

# TypeScript Source Instructions

## Strict TypeScript

- `strict: true` is enabled — never bypass with `any`
- Use `unknown` + type guards instead of `any`
- Use `import type { ... } from 'obsidian'` for type-only imports
- Target: ES2022, module: ESNext, moduleResolution: bundler

## Regex Requirements

All regular expressions MUST use `u` or `gu` flag for Unicode-aware matching.
Use `\p{L}` for Unicode letters and `\p{N}` for Unicode numbers.

```typescript
// CORRECT
/[^\p{L}\p{N}\s-]/gu
// WRONG — will break non-ASCII characters
/[^a-zA-Z0-9\s-]/g
```

## DOM Safety

- Never use `innerHTML` — use `document.createElement()`, `el.textContent`, `el.appendChild()`, etc.
- Never concatenate strings into HTML — this is an XSS vector

## Error Handling

- Never show modal/alert to user — fail silently
- Use `console.warn('[gfm-anchor]', ...)` for debug messages
- Graceful degradation: disable component if hook unavailable, don't crash

## Obsidian API Patterns

- Use `this.registerMarkdownPostProcessor()` for post-processors (auto-cleanup)
- Use `this.registerEvent()` for event handlers (auto-cleanup)
- Use `this.registerEditorExtension()` for CM6 plugins (auto-cleanup)
- `'hover-link'` event is not in TypeScript types — use `@ts-expect-error`
- NEVER mutate file content — all transformations are runtime DOM/event only

## File Naming

- Source files: `kebab-case.ts`
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` (only for true compile-time constants)
- Interfaces: `PascalCase` (no `I` prefix)
