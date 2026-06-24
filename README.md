# GFM Anchor

An [Obsidian](https://obsidian.md) plugin that makes **GitHub Flavored Markdown (GFM) anchor links** work natively in Obsidian — without modifying any files.

## The Problem

Markdown has two incompatible anchor link formats:

| Format | Algorithm | Example for `## Hello & World` |
| -------- | ----------- | ------------------------------- |
| **GFM** (GitHub, Typora, MkDocs, Hugo) | lowercase → remove non-alphanumeric → spaces to `-` | `#hello--world` |
| **OFM** (Obsidian) | preserve case → URL-encode spaces and specials | `#Hello%20&%20World` |

Documents written in standard GFM (portable to GitHub, MkDocs, etc.) have GFM-style anchor links that **silently fail to navigate** when opened in Obsidian — both click and hover preview (Page Preview) break.

## The Solution

This plugin intercepts anchor link clicks and hovers, detects GFM-style slugs, resolves them to the correct heading, and navigates using Obsidian's native API. Your files are never touched.

## Features

- **Reading Mode** — click navigation on GFM anchor links
- **Reading Mode** — hover preview (Page Preview) on GFM anchor links
- **Live Preview Mode** — click navigation on GFM anchor links
- **Cross-file anchors** — `[text](other-file.md#gfm-slug)` works correctly
- **OFM passthrough** — existing Obsidian-format links are unaffected
- **Duplicate headings** — GFM numeric suffix convention (`#section`, `#section-1`, `#section-2`)
- **Full Unicode support** — non-ASCII letters (é, ñ, ü) are preserved correctly
- **Zero configuration** — works out of the box

## Contoh Penggunaan

Buat catatan Obsidian dengan heading seperti ini:

```markdown
# Dokumentasi Proyek

## Instalasi & Setup

Panduan instalasi aplikasi.

## Fitur Utama

Penjelasan fitur utama.

## Fitur Utama

Heading duplikat kedua.

## Café dan Niño

Heading dengan karakter Unicode.
```

Lalu tulis link menggunakan format anchor GFM seperti yang biasa dipakai di GitHub:

```markdown
## Daftar Isi

- [Instalasi & Setup](#instalasi--setup)
- [Fitur Utama](#fitur-utama)
- [Fitur Utama kedua](#fitur-utama-1)
- [Café dan Niño](#café-dan-niño)
```

Tanpa plugin ini, beberapa link GFM di atas bisa gagal di Obsidian karena Obsidian memakai format anchor internal yang berbeda. Dengan GFM Anchor aktif, klik dan hover preview pada link tersebut akan diarahkan ke heading yang benar tanpa mengubah isi file.

Cross-file anchor juga didukung:

```markdown
[Buka bagian setup](panduan.md#instalasi--setup)
```

Plugin tetap membiarkan link anchor bawaan Obsidian berjalan seperti biasa:

```markdown
[Format Obsidian tetap jalan](#Instalasi%20&%20Setup)
```

## How It Works

```text
User clicks/hovers anchor link
         │
         ▼
  isGFMSlug(fragment)?
    │           │
   Yes          No
    │           │
    ▼           ▼
buildSlugMap  passthrough to
(headings)    Obsidian default
    │
    ▼
resolveSlug(slug, slugMap)
    │              │
  found        not found
    │              │
    ▼              ▼
navigate to    silent fail,
original       passthrough
heading
```

The GFM slug algorithm:

```typescript
function toGFMSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Unicode-aware: keep letters, digits, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-');             // spaces → hyphens
}
```

## Development

### Prerequisites

- Node.js >= 18.x
- [pnpm](https://pnpm.io)

### Setup

```bash
git clone https://github.com/parkisutama/obsidian-gfm-anchor
cd obsidian-gfm-anchor
pnpm install
```

### Commands

```bash
pnpm run dev    # development build (watch mode)
pnpm run build  # production build
pnpm test       # run unit tests
pnpm exec tsc --noEmit  # type check
```

### Dev Vault Setup

```bash
# Symlink build output into your dev vault
VAULT=~/Documents/MyVault
mkdir -p "$VAULT/.obsidian/plugins/gfm-anchor"
ln -s "$(pwd)/main.js" "$VAULT/.obsidian/plugins/gfm-anchor/main.js"
ln -s "$(pwd)/manifest.json" "$VAULT/.obsidian/plugins/gfm-anchor/manifest.json"

# Start watch build — install Hot Reload plugin in vault for auto-reload
pnpm run dev
```

### Project Structure

```text
src/
├── main.ts           # Plugin entry point — registers all handlers
├── slug.ts           # GFM slug algorithm + slug map builder (pure, no Obsidian API)
├── reading-mode.ts   # MarkdownPostProcessor for Reading Mode click & hover
├── hover.ts          # Intercepts 'hover-link' event for Page Preview
├── live-preview.ts   # CodeMirror 6 ViewPlugin for Live Preview click
└── resolver.ts       # Shared: resolve GFM slug → original heading text
```

## Compatibility

- **Obsidian:** 1.4.0+ (requires CodeMirror 6)
- **Platform:** Desktop only
- **Dependencies:** None (Obsidian API only)

## License

MIT
