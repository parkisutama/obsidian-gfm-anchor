---
applyTo: "esbuild.config.mjs,tsconfig.json,package.json,manifest.json,vitest.config.*"
---

# Build & Config File Instructions

## Build System

- **esbuild** for bundling — configured in `esbuild.config.mjs`
- Output: single `main.js` file at repository root
- No CSS output — this plugin has no custom styles

## Package Manager

- Use **pnpm** exclusively (not npm or yarn)
- Lock file: `pnpm-lock.yaml`

## manifest.json

- `id`: `"gfm-anchor"`
- `minAppVersion`: `"1.4.0"` (CodeMirror 6 stable)
- `isDesktopOnly`: `true`
- Keep `version` in sync with `package.json`

## tsconfig.json

- `strict: true` — never relax
- `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
- `lib: ["ES2022", "DOM"]`
- Include only `src/**/*.ts`, exclude `node_modules` and test files from compilation

## Dependencies

- Zero runtime dependencies — only `obsidian` as dev dependency for types
- Test dependencies: `vitest` only
- Build dependencies: `typescript`, `esbuild`, `@types/node`
