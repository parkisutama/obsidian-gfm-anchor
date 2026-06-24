# CLAUDE.md — obsidian-gfm-anchor

> Instruksi untuk Claude Code (Anthropic). File ini dibaca otomatis saat Claude Code bekerja di repo ini.

## Identitas Proyek

**obsidian-gfm-anchor** — Plugin Obsidian yang membuat GFM (GitHub Flavored Markdown) anchor links berfungsi secara native di Obsidian tanpa mengubah konten file apapun.

- **Bahasa:** TypeScript (strict mode)
- **Platform:** Obsidian Plugin API (desktop only)
- **Build:** esbuild via `pnpm`
- **Min Obsidian:** 1.4.0 (CodeMirror 6 stable)
- **Zero dependencies** selain Obsidian API

## Perintah Build & Test

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm run dev

# Production build
pnpm run build

# Run unit tests
pnpm test

# Type check tanpa emit
pnpm exec tsc --noEmit
```

## Arsitektur & Struktur File

```text
src/
├── main.ts           # Plugin entry point — orchestrator, register semua handler
├── slug.ts           # GFM slug algorithm + slug map builder (PURE, no Obsidian API)
├── reading-mode.ts   # MarkdownPostProcessor untuk Reading Mode klik & hover
├── hover.ts          # Intercept 'hover-link' event untuk Page Preview
├── live-preview.ts   # CodeMirror 6 ViewPlugin untuk Live Preview klik
└── resolver.ts       # Shared: resolve GFM slug → heading text asli
```

### Data Flow

```text
User klik/hover anchor → isGFMSlug(fragment)?
  ├─ Ya  → buildSlugMap(headings) → resolveSlug() → navigate ke heading OFM
  └─ Tidak → passthrough ke Obsidian default handler
```

## Algoritma GFM Slug (KRITIS)

```typescript
function toGFMSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // Unicode-aware: pertahankan huruf, angka, spasi, hyphen
    .trim()
    .replace(/\s+/g, '-');               // spasi → hyphen
}
```

Flag `u` dan `\p{L}` **WAJIB** — tanpa ini karakter non-ASCII (é, ñ, ü) akan salah dihapus.

## Konvensi Kode

### TypeScript

- **Strict mode** (`strict: true` di tsconfig)
- Target **ES2022**, module **ESNext**, moduleResolution **bundler**
- Gunakan `import type` untuk type-only imports dari `obsidian`
- Regex harus menggunakan flag `u` atau `gu` untuk Unicode-aware matching
- Tidak ada runtime dependency selain Obsidian API

### Naming

- File: `kebab-case.ts`
- Function: `camelCase`
- Class: `PascalCase`
- Constant: `UPPER_SNAKE_CASE` (hanya untuk true constants)
- Interface: `PascalCase` (tanpa prefix `I`)

### Error Handling

- **Tidak ada modal/alert** ke user saat slug tidak match — fail secara silent
- `console.warn` dengan prefix `[gfm-anchor]` untuk debug logging
- Graceful degradation: jika hook tidak tersedia, disable komponen, jangan crash

### Obsidian API Patterns

- Gunakan `this.registerMarkdownPostProcessor()` (auto-cleanup di unload)
- Gunakan `this.registerEvent()` (auto-cleanup di unload)
- Gunakan `this.registerEditorExtension()` untuk CM6 plugin
- Event `'hover-link'` tidak ada di TypeScript types — gunakan `@ts-expect-error`
- JANGAN mutasi file — semua transformasi hanya di runtime DOM/event

### Testing

- **Vitest** untuk unit test modul `slug.ts` (pure logic)
- Test file: `src/*.test.ts` atau `src/*.spec.ts`
- Manual testing di dev vault dengan `test-fixture.md`

## Batasan Penting

1. **Zero File Mutation** — Plugin TIDAK BOLEH menulis/mengubah file vault dalam kondisi apapun
2. **No Settings** — Bekerja out-of-the-box tanpa konfigurasi (v1)
3. **OFM Passthrough** — Link OFM (uppercase atau %XX encoded) HARUS tetap berfungsi normal
4. **Performance** — Post-processor < 5ms per render, slug map di-cache per file
5. **Desktop Only** — Mobile out of scope untuk fase pertama

## Duplicate Heading Convention

GFM menangani heading duplikat dengan suffix: `#section`, `#section-1`, `#section-2`.
Plugin WAJIB mengimplementasikan counter yang sama.

## Jangan Lakukan

- Jangan tambahkan settings/UI — ini plugin zero-config
- Jangan import library eksternal (lodash, etc.)
- Jangan gunakan `innerHTML` atau string concatenation untuk DOM — rawan XSS
- Jangan gunakan `any` type — gunakan proper typing atau `unknown` + type guard
- Jangan modify file content — semua perubahan hanya di DOM runtime
- Jangan suppress TypeScript errors dengan `@ts-ignore` — gunakan `@ts-expect-error` jika harus
