# Port Plan: GFM Anchor into MD Writer

## Goal

Consolidate the runtime GFM anchor compatibility behavior from
`obsidian-gfm-anchor` into `parkisutama/obsidian-md-writer` while preserving the
standalone plugin as a small compatibility reference until the MD Writer port is
validated.

The port must keep the same user-facing contract:

- GFM anchor links navigate correctly in Reading Mode and Live Preview.
- Page Preview hover works for same-file and cross-file anchors.
- Duplicate headings follow the GFM suffix convention.
- Unicode letters are preserved by the slug algorithm.
- Vault files are never modified.

## Recommended Integration Shape

Add the feature as an internal MD Writer module, not as a runtime dependency on
the standalone plugin.

Proposed MD Writer paths:

```text
src/gfm-anchor/
├── hover.ts
├── live-preview.ts
├── navigation.ts
├── reading-mode.ts
├── resolver.ts
├── slug.ts
└── slug.test.ts
```

Register the module from `TypewriterModeLib.load()` in MD Writer's `src/lib.ts`.
The Live Preview CodeMirror extension should be appended to MD Writer's existing
`editorExtensions` array.

## Port Stages

### 1. Copy Pure Logic First

Move these files first:

- `src/slug.ts`
- `src/resolver.ts`
- `src/slug.test.ts`

Adjust formatting/imports to MD Writer conventions:

- Double quotes.
- Path aliases only where they improve local consistency.
- No `any`.
- Keep Unicode-aware regex flags.

Validation:

```bash
pnpm run typecheck
pnpm test
```

### 2. Add Runtime Registration Module

Create `src/gfm-anchor/index.ts` with a single public registration function:

```typescript
export function registerGFMAnchorCompatibility(plugin: Plugin): void;
```

That function should register:

- Reading Mode post processor.
- Live Preview editor extension.
- Hover event rewrite.
- Click or mousedown navigation handlers.
- Cleanup handlers for every monkey patch or DOM listener.

This keeps MD Writer's `lib.ts` small and makes the feature removable if product
scope changes later.

### 3. Port Reading Mode and Hover

Move:

- `src/reading-mode.ts`
- `src/hover.ts`

The current standalone implementation patches `workspace.trigger` so Page
Preview can see the rewritten link before Obsidian's own listeners run. Preserve
that behavior, but isolate it in one helper with an explicit restore callback.

Validation:

- Same-file hover preview for `#instalasi--setup`.
- Cross-file hover preview for `other-file.md#instalasi--setup`.
- OFM links such as `#Instalasi%20&%20Setup` still pass through.

### 4. Port Live Preview Integration

Move:

- `src/live-preview.ts`

Append `createLivePreviewPlugin(plugin.app)` to MD Writer's existing
`editorExtensions` list. Do not merge the logic into MD Writer's typewriter CM6
plugin; GFM anchor handling is link compatibility, not visual writing state.

Validation:

- Live Preview rendered links get rewritten for Page Preview.
- Live Preview clicks navigate without opening the yellow highlighted subpath
state.
- Source Mode is ignored.

### 5. Port Navigation Without Highlight

Extract the navigation helpers currently in `src/main.ts` into
`src/gfm-anchor/navigation.ts`:

- `navigateWithoutHighlight`
- `scrollMarkdownViewToTarget`
- `scrollPreviewToHeading`
- target-file resolution
- document click and mousedown capture handlers

Keep the same duplicate-heading handling via `headingOccurrence`.

Validation:

- Reading Mode same-file click scrolls to the correct heading occurrence.
- Live Preview same-file click scrolls to the correct heading occurrence.
- Ctrl/Cmd-click opens a new leaf.
- Cross-file click opens the target file.

### 6. Decide Product Exposure

Recommended default: enable the feature by default in MD Writer with a setting
toggle under a compatibility section.

Suggested setting:

```typescript
compatibility: {
  isGFMAnchorCompatibilityEnabled: true;
}
```

Reasoning: GFM anchor compatibility changes link handling globally. A toggle
makes the behavior reversible if a vault or another plugin already owns this
behavior.

### 7. Update Docs

Update MD Writer docs and README with a short compatibility section:

- Explain that MD Writer supports GitHub-style heading anchors.
- Include one copy-paste example with duplicate heading and Unicode cases.
- State that files are not modified.

Keep the standalone `obsidian-gfm-anchor` README as the detailed reference until
the MD Writer implementation has shipped.

## Risks and Controls

### Monkey Patching Workspace APIs

Risk: `workspace.openLinkText` and `workspace.trigger` are shared Obsidian APIs.

Controls:

- Patch once during plugin load.
- Restore the original function on unload.
- Keep patch bodies narrow: only rewrite when a GFM slug resolves.
- Pass through every unresolved or OFM link unchanged.

### Plugin Interaction

Risk: Another plugin may also patch link navigation or hover events.

Controls:

- Avoid throwing from event handlers.
- Avoid persistent global state.
- Preserve original arguments and return values.
- Prefer capture handlers only where they are needed to beat Obsidian's default
  link handler.

### Scope Creep

Risk: MD Writer becomes a general Markdown compatibility plugin.

Controls:

- Keep the feature isolated under `src/gfm-anchor/`.
- Keep formatter and file mutation ideas out of this port.
- Do not add external dependencies.

## Final Validation Checklist

Run in `obsidian-md-writer`:

```bash
pnpm run typecheck
pnpm run lint
pnpm run lint:obsidian
pnpm test
pnpm run build
pnpm run verify:artifacts
```

Manual vault fixture:

```markdown
# Dokumentasi Proyek

## Instalasi & Setup

## Fitur Utama

## Fitur Utama

## Café dan Niño

- [Instalasi & Setup](#instalasi--setup)
- [Fitur Utama](#fitur-utama)
- [Fitur Utama kedua](#fitur-utama-1)
- [Café dan Niño](#café-dan-niño)
```

Expected result: every link click and hover resolves to the intended heading in
Reading Mode and Live Preview without changing the Markdown source.
