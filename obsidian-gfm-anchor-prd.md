---
title: PRD — obsidian-gfm-anchor Plugin
created: 2026-03-16T10:00
modified: 2026-03-16T10:00
tags:
  - prd
  - obsidian
  - plugin
  - gfm
  - markdown
---

# PRD obsidian-gfm-anchor Plugin

---

## Daftar Isi

- [Latar Belakang dan Masalah](#latar-belakang-dan-masalah)
- [Tujuan Plugin](#tujuan-plugin)
- [Ruang Lingkup](#ruang-lingkup)
- [Spesifikasi Teknis Inti](#spesifikasi-teknis-inti)
- [Functional Requirements](#functional-requirements)
- [Non-Functional Requirements](#non-functional-requirements)
- [Arsitektur Plugin](#arsitektur-plugin)
- [Setup Repository dari Nol](#setup-repository-dari-nol)
- [Panduan Implementasi](#panduan-implementasi)
- [Testing Strategy](#testing-strategy)
- [Debugging Guide](#debugging-guide)
- [Batasan dan Keputusan Desain](#batasan-dan-keputusan-desain)
- [Referensi](#referensi)

---

## Latar Belakang dan Masalah

### Konteks

Markdown memiliki dua ekosistem anchor link yang tidak kompatibel satu sama lain:

**GFM (GitHub Flavored Markdown) — de facto standard:**
Digunakan oleh GitHub, Typora, MkDocs, Hugo, Quartz, dan Pandoc.
Algoritma: lowercase semua karakter → spasi menjadi `-` → hapus semua karakter
non-alphanumeric kecuali `-`.

**Obsidian Flavored Markdown (OFM):**
Digunakan hanya oleh Obsidian.
Algoritma: preserve case → spasi menjadi `%20` → karakter spesial di-URL-encode.

**Contoh konkret** untuk heading `## Glosarium & Kode Sistem`:

| Format | Anchor |
| --- | --- |
| GFM | `#glosarium--kode-sistem` |
| OFM | `#Glosarium%20&%20Kode%20Sistem` |

### Dampak

Dokumen markdown yang ditulis mengikuti standar GFM (portabel ke GitHub,
Typora, MkDocs, dll.) memiliki anchor link dalam format GFM.
Ketika dibuka di Obsidian, semua anchor link tersebut **gagal dinavigasi** —
baik klik maupun hover preview (Page Preview) tidak bekerja.

Ini memblokir workflow di mana Obsidian digunakan sebagai editor utama
untuk dokumen yang juga di-publish ke platform lain.

---

## Tujuan Plugin

Plugin ini membuat Obsidian mampu **membaca dan menavigasi GFM anchor links**
tanpa mengubah konten file yang ada.
Plugin berjalan secara transparan — user tidak perlu mengubah format link
yang sudah ditulis dalam standar GFM.

**Satu kalimat:** GFM anchor links berfungsi di Obsidian seperti di GitHub.

---

## Ruang Lingkup

### Dalam Scope

- Navigasi klik pada GFM anchor links di **Reading Mode**
- **Hover preview** (Page Preview) pada GFM anchor links di Reading Mode
- Navigasi klik pada GFM anchor links di **Live Preview Mode**
- Support untuk anchor links dalam satu file (same-file fragment navigation)
- Support untuk anchor links lintas file: `[text](other-file.md#gfm-slug)`

### Luar Scope

- Mengubah cara Obsidian *menghasilkan* anchor links (Obsidian tetap menulis
  format OFM saat user membuat link via UI)
- Mendukung format anchor selain GFM dan OFM (Pandoc Extended,
  GitLab-specific, dll.)
- Mobile Obsidian (fase pertama; bisa ditambahkan kemudian)
- Modifikasi konten file apapun

---

## Spesifikasi Teknis Inti

### GFM Slug Algorithm

Implementasi referensi: <https://github.com/jch/html-pipeline/blob/master/lib/html/pipeline/toc_filter.rb>

Algoritma lengkap dalam urutan:

1. Lowercase seluruh string
2. Hapus semua karakter yang bukan: huruf Unicode, angka, spasi, hyphen
3. Ganti semua spasi dan karakter whitespace dengan satu hyphen
4. Hapus leading dan trailing hyphens

```typescript
function toGFMSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Unicode-aware: hapus non-word kecuali spasi & hyphen
    .trim()
    .replace(/\s+/g, '-');             // spasi → hyphen (tidak perlu collapse karena spasi
                                        // sudah di-normalize ke single hyphen)
}
```

> **Catatan penting tentang Unicode:**
> GFM menggunakan Unicode-aware matching — huruf non-ASCII (é, ñ, ü, dll.)
> dipertahankan, bukan dihapus. Flag `u` dan `\p{L}` wajib digunakan.
> Tanpa flag ini, karakter seperti `ä` akan salah dihapus.

### Duplicate Heading Handling

GFM menangani heading duplikat dengan menambahkan suffix numerik:
`#section`, `#section-1`, `#section-2`, dst.

Plugin **wajib** mengimplementasikan counter yang sama:

```typescript
function buildSlugMap(headings: HeadingCache[]): Map<string, string> {
  const map = new Map<string, string>();  // slug → heading text asli
  const counter = new Map<string, number>();

  for (const h of headings) {
    const base = toGFMSlug(h.heading);
    const count = counter.get(base) ?? 0;
    const slug = count === 0 ? base : `${base}-${count}`;

    counter.set(base, count + 1);
    map.set(slug, h.heading);
  }

  return map;
}
```

### OFM-to-GFM Detection

Plugin harus membedakan anchor link yang sudah dalam format GFM vs OFM
agar tidak double-process:

```typescript
function isGFMSlug(fragment: string): boolean {
  // OFM mengandung uppercase atau %XX encoding
  // GFM hanya lowercase, alphanumeric, dan hyphen
  return /^[a-z0-9\p{Ll}-]+$/u.test(fragment);
}
```

---

## Functional Requirements

### FR-01: Reading Mode — Klik Navigasi

**Deskripsi:** Ketika user mengklik anchor link dengan format GFM di Reading Mode,
Obsidian menggulir ke heading yang tepat.

**Acceptance Criteria:**

- Link `[text](#gfm-slug)` ketika diklik menggulir ke heading yang benar
- Tidak ada visual glitch atau loading artifact
- Jika slug tidak cocok dengan heading manapun, link gagal secara senyap
  (tidak ada error modal)
- Heading yang dituju ter-highlight sesuai perilaku Obsidian default

### FR-02: Reading Mode — Hover Preview

**Deskripsi:** Ketika user menghover anchor link GFM (dengan Page Preview plugin
aktif), popup preview muncul dengan konten di sekitar heading yang dituju.

**Acceptance Criteria:**

- Hover pada `[text](#gfm-slug)` memunculkan preview popup
- Preview menampilkan konten yang benar (heading yang tepat dan beberapa baris
  di bawahnya)
- Delay dan animasi popup identik dengan perilaku Obsidian default

### FR-03: Live Preview Mode — Klik Navigasi

**Deskripsi:** Ketika user mengklik anchor link GFM di Live Preview Mode
(rendered state, bukan saat cursor di dalam link), navigasi berfungsi.

**Acceptance Criteria:**

- Identik dengan FR-01 tapi dalam konteks editor Live Preview

### FR-04: Cross-file Anchor

**Deskripsi:** Anchor link dalam format `[text](other-file.md#gfm-slug)` bekerja
untuk navigasi ke file lain.

**Acceptance Criteria:**

- File tujuan dibuka dan di-scroll ke heading yang benar
- Jika file tujuan tidak ditemukan, perilaku fallback ke default Obsidian

### FR-05: Graceful Passthrough

**Deskripsi:** Plugin tidak mengganggu anchor links yang sudah dalam format OFM.

**Acceptance Criteria:**

- Link dalam format OFM (`#Heading%20Text`) tetap berfungsi normal
- Plugin tidak double-process link yang sudah benar

---

## Non-Functional Requirements

### NFR-01: Zero File Mutation

Plugin tidak boleh mengubah konten file apapun dalam vault, dalam kondisi
apapun. Semua transformasi bersifat runtime-only.

### NFR-02: Performance

- Post-processor harus selesai dalam < 5ms per note render
- Slug map di-build sekali per file load, di-cache selama file tidak berubah
- Tidak ada blocking operation di main thread

### NFR-03: Graceful Degradation

Jika Obsidian API berubah dan hook tertentu tidak tersedia, plugin log warning
ke console dan disable hanya komponen yang bermasalah — tidak crash vault.

### NFR-04: Kompatibilitas

- Minimum Obsidian version: **1.4.0** (rilis CodeMirror 6 stable)
- Tidak ada runtime dependency selain Obsidian API

### NFR-05: No Settings Required

Plugin bekerja out-of-the-box tanpa konfigurasi apapun.
Settings page opsional bisa ditambahkan di versi berikutnya.

---

## Arsitektur Plugin

```text
obsidian-gfm-anchor/
│
├── src/
│   ├── main.ts              ← Plugin entry point, orchestrator
│   ├── slug.ts              ← GFM slug algorithm + slug map builder
│   ├── reading-mode.ts      ← Post-processor untuk Reading Mode
│   ├── hover.ts             ← Hover preview intercept
│   ├── live-preview.ts      ← CodeMirror 6 ViewPlugin untuk Live Preview
│   └── resolver.ts          ← Shared: resolve slug → heading text
│
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── .github/
    └── workflows/
        └── release.yml
```

### Data Flow

```text
User klik/hover anchor link
         │
         ▼
  isGFMSlug(fragment)?
    │           │
   Ya          Tidak
    │           │
    ▼           ▼
buildSlugMap  passthrough ke
(dari cache   Obsidian default
atau fresh)
    │
    ▼
resolveSlug(slug, slugMap)
    │              │
 ketemu        tidak ketemu
    │              │
    ▼              ▼
navigate ke    log warning,
heading asli   passthrough
```

---

## Setup Repository dari Nol

### Prasyarat

- Node.js >= 18.x
- `pnpm` (direkomendasikan) atau `npm`
- Git

### Langkah 1 — Clone Template Resmi

```bash
git clone https://github.com/obsidianmd/obsidian-sample-plugin.git obsidian-gfm-anchor
cd obsidian-gfm-anchor
rm -rf .git
git init
git branch -M main
```

### Langkah 2 — Bersihkan Template

Hapus file yang tidak diperlukan dari template:

```bash
rm styles.css          # plugin ini tidak butuh custom CSS
```

Hapus konten contoh dari `main.ts` (simpan hanya skeleton class Plugin).

### Langkah 3 — Install Dependencies

```bash
pnpm install
```

Package yang sudah termasuk di template (tidak perlu install manual):

- `obsidian` — type definitions dan API
- `@types/node`
- `typescript`
- `esbuild`

### Langkah 4 — Konfigurasi `manifest.json`

```json
{
  "id": "gfm-anchor",
  "name": "GFM Anchor Compatibility",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Makes GFM-style anchor links work natively in Obsidian, enabling full compatibility with GitHub, Typora, MkDocs, and other GFM-compatible renderers.",
  "author": "Your Name",
  "authorUrl": "https://github.com/your-username",
  "fundingUrl": "",
  "isDesktopOnly": true
}
```

### Langkah 5 — Konfigurasi `tsconfig.json`

Ganti isi default dengan konfigurasi yang strict dan benar:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2022",
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "strict": true,
    "lib": ["ES2022", "DOM"],
    "paths": {
      "obsidian": ["node_modules/obsidian/obsidian.d.ts"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "**/*.spec.ts"]
}
```

### Langkah 6 — Setup Dev Vault

Buat symlink dari folder build ke vault untuk hot-reload selama development:

```bash
# Asumsikan vault ada di ~/Documents/MyVault
mkdir -p ~/Documents/MyVault/.obsidian/plugins/gfm-anchor
ln -s $(pwd)/main.js ~/Documents/MyVault/.obsidian/plugins/gfm-anchor/main.js
ln -s $(pwd)/manifest.json ~/Documents/MyVault/.obsidian/plugins/gfm-anchor/manifest.json
```

Alternatif: gunakan environment variable di `esbuild.config.mjs` untuk
output langsung ke vault.

### Langkah 7 — Setup Hot Reload

Install plugin **Hot Reload** (phodal/obsidian-hotreload) di dev vault.
Plugin ini me-reload plugin otomatis ketika `main.js` berubah.

```bash
# Build sekali untuk setup awal
pnpm run build

# Mode watch selama development
pnpm run dev
```

### Langkah 8 — Struktur Folder Final

```bash
mkdir -p src
touch src/main.ts src/slug.ts src/reading-mode.ts \
      src/hover.ts src/live-preview.ts src/resolver.ts
```

---

## Panduan Implementasi

### Modul 1 — `src/slug.ts`

Implementasi algoritma GFM dan builder slug map.
Ini pure logic, tidak ada Obsidian API dependency.

```typescript
import type { HeadingCache } from 'obsidian';

/**
 * Mengkonversi heading text ke GFM anchor slug.
 * Ref: https://github.com/jch/html-pipeline — TocFilter
 */
export function toGFMSlug(heading: string): string {
  return heading
    .toLowerCase()
    // Unicode-aware: pertahankan huruf (termasuk non-ASCII), angka, spasi, hyphen
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Mendeteksi apakah sebuah fragment sudah dalam format GFM.
 * OFM mengandung %XX encoding atau uppercase — GFM tidak.
 */
export function isGFMSlug(fragment: string): boolean {
  // Jika ada %XX atau uppercase, ini OFM atau format lain
  if (/%[0-9A-F]{2}/i.test(fragment)) return false;
  if (/[A-Z]/.test(fragment)) return false;
  return true;
}

/**
 * Membangun mapping dari GFM slug ke heading text asli.
 * Menangani duplicate headings dengan suffix numerik (GFM convention).
 */
export function buildSlugMap(headings: HeadingCache[]): Map<string, string> {
  const map = new Map<string, string>();
  const counter = new Map<string, number>();

  for (const h of headings) {
    const base = toGFMSlug(h.heading);
    const count = counter.get(base) ?? 0;
    const slug = count === 0 ? base : `${base}-${count}`;

    counter.set(base, count + 1);

    // Jangan overwrite — first occurrence wins (GFM behavior)
    if (!map.has(slug)) {
      map.set(slug, h.heading);
    }
  }

  return map;
}
```

### Modul 2 — `src/resolver.ts`

Cache management dan resolusi slug ke heading.

```typescript
import type { App, TFile } from 'obsidian';
import { buildSlugMap, isGFMSlug } from './slug';

/**
 * Menyelesaikan GFM slug ke heading text asli dari sebuah file.
 * Mengembalikan null jika slug tidak cocok dengan heading manapun,
 * atau jika fragment bukan format GFM.
 */
export function resolveSlug(
  slug: string,
  file: TFile,
  app: App
): string | null {
  if (!isGFMSlug(slug)) return null;

  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.headings?.length) return null;

  const slugMap = buildSlugMap(cache.headings);
  return slugMap.get(slug) ?? null;
}

/**
 * Mem-parse anchor fragment dari href attribute.
 * Mengembalikan null jika bukan fragment link.
 *
 * Input:  "#gfm-slug" atau "#Obsidian%20Style"
 * Output: "gfm-slug" atau "Obsidian Style" (decoded)
 */
export function parseFragment(href: string): string | null {
  if (!href.startsWith('#')) return null;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    // URIDecodeError pada malformed encoding
    return href.slice(1);
  }
}
```

### Modul 3 — `src/reading-mode.ts`

Post-processor untuk intercept klik di Reading Mode.

```typescript
import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

export function registerReadingModePostProcessor(app: App): (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
) => void {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const anchors = el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      const fragment = parseFragment(href);
      if (!fragment) return;

      // Tambahkan custom click handler
      // Gunakan capture phase agar jalan sebelum Obsidian default handler
      anchor.addEventListener(
        'click',
        (e: MouseEvent) => {
          const file = app.workspace.getActiveFile();
          if (!file) return;

          const heading = resolveSlug(fragment, file, app);
          if (!heading) return; // passthrough ke default jika tidak ada match

          e.preventDefault();
          e.stopPropagation();

          // openLinkText dengan format OFM yang Obsidian mengerti
          app.workspace.openLinkText(
            `${file.basename}#${heading}`,
            file.path,
            false
          );
        },
        true // capture phase
      );

      // Update href ke format OFM untuk membantu hover preview (FR-02)
      // Ini dilakukan hanya di DOM, bukan di file
      const file = app.workspace.getActiveFile();
      if (file) {
        const heading = resolveSlug(fragment, file, app);
        if (heading) {
          // Simpan GFM slug asli sebagai data attribute untuk reference
          anchor.dataset.gfmSlug = fragment;
          // Update href ke format yang Obsidian mengerti
          anchor.setAttribute('href', `#${heading}`);
        }
      }
    });
  };
}
```

### Modul 4 — `src/hover.ts`

Intercept hover-link event untuk Page Preview compatibility.

```typescript
import type { App } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

/**
 * Interface internal Obsidian untuk hover-link event.
 * Tidak ada di type definitions resmi — perlu type assertion.
 */
interface HoverLinkEvent {
  event: MouseEvent;
  source: string;
  hoverParent: Element;
  targetEl: Element | null;
  linktext: string;
  sourcePath: string;
}

export function registerHoverHandler(app: App): (event: unknown) => void {
  return (rawEvent: unknown) => {
    const event = rawEvent as HoverLinkEvent;

    // Hanya proses fragment links (dimulai dengan #)
    const linktext = event.linktext ?? '';
    if (!linktext.startsWith('#')) return;

    const fragment = parseFragment(linktext);
    if (!fragment) return;

    // Tentukan file konteks dari sourcePath
    const file = app.vault.getFileByPath(event.sourcePath);
    if (!file) return;

    const heading = resolveSlug(fragment, file, app);
    if (!heading) return;

    // Mutasi event.linktext ke format OFM
    // Obsidian membaca property ini saat merender preview popup
    (event as HoverLinkEvent).linktext = `#${heading}`;
  };
}
```

> **Warning untuk implementor:**
> `hover-link` event shape tidak terdokumentasi secara resmi.
> Property `linktext` berhasil di-mutasi di Obsidian 1.4.x–1.7.x berdasarkan
> pengujian komunitas. Jika Obsidian update mengubah event shape ini,
> tambahkan guard: `if (!('linktext' in event)) return;`

### Modul 5 — `src/live-preview.ts`

CodeMirror 6 ViewPlugin untuk Live Preview Mode.
Ini bagian paling kompleks — CM6 merender DOM secara incremental.

```typescript
import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import type { App } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

/**
 * CM6 ViewPlugin yang menangani klik pada anchor links di Live Preview.
 * ViewPlugin lebih tepat dari DecorationSet karena kita tidak mengubah
 * tampilan — hanya menambah event handler.
 */
function createLivePreviewPlugin(app: App) {
  return ViewPlugin.fromClass(
    class {
      private clickHandler: ((e: MouseEvent) => void) | null = null;

      constructor(private view: EditorView) {
        this.clickHandler = this.handleClick.bind(this);
        this.view.dom.addEventListener('click', this.clickHandler, true);
      }

      handleClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // Cari elemen anchor terdekat (klik mungkin di child element)
        const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        const fragment = parseFragment(href);
        if (!fragment) return;

        const file = app.workspace.getActiveFile();
        if (!file) return;

        const heading = resolveSlug(fragment, file, app);
        if (!heading) return;

        e.preventDefault();
        e.stopPropagation();

        app.workspace.openLinkText(
          `${file.basename}#${heading}`,
          file.path,
          false
        );
      }

      update(_update: ViewUpdate): void {
        // Tidak perlu action saat update — event listener sudah di-attach
        // ke parent DOM yang persistent
      }

      destroy(): void {
        if (this.clickHandler) {
          this.view.dom.removeEventListener('click', this.clickHandler, true);
          this.clickHandler = null;
        }
      }
    }
  );
}

export { createLivePreviewPlugin };
```

### Modul 6 — `src/main.ts`

Entry point — orkestrator yang mengikat semua modul.

```typescript
import { Plugin } from 'obsidian';
import { registerReadingModePostProcessor } from './reading-mode';
import { registerHoverHandler } from './hover';
import { createLivePreviewPlugin } from './live-preview';

export default class GFMAnchorPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('[gfm-anchor] Plugin loaded');

    // FR-01 & FR-02: Reading Mode — klik dan hover
    this.registerMarkdownPostProcessor(
      registerReadingModePostProcessor(this.app)
    );

    // FR-02: Hover preview intercept
    this.registerEvent(
      // @ts-expect-error: 'hover-link' tidak ada di EventRef types resmi
      this.app.workspace.on('hover-link', registerHoverHandler(this.app))
    );

    // FR-03: Live Preview Mode
    this.registerEditorExtension(
      createLivePreviewPlugin(this.app)
    );

    console.log('[gfm-anchor] All handlers registered');
  }

  onunload(): void {
    // Semua handler di-unregister otomatis oleh Obsidian
    // via registerMarkdownPostProcessor dan registerEvent
    console.log('[gfm-anchor] Plugin unloaded');
  }
}
```

---

## Testing Strategy

### Fixture File untuk Testing

Buat file `test-fixture.md` di dev vault dengan konten berikut.
File ini mencakup semua edge case yang harus diverifikasi:

```markdown
# GFM Anchor Test Fixture

## Daftar Isi

- [Heading Normal](#heading-normal)
- [Heading dengan Ampersand](#heading-dengan-ampersand--simbol)
- [Heading Angka](#heading-123-angka)
- [Heading Unicode](#heading-unicode-bahasa-indonesia)
- [Heading Duplikat](#heading-duplikat)
- [Heading Duplikat (kedua)](#heading-duplikat-1)
- [OFM Format](#OFM%20Format) ← ini harus passthrough, tidak diproses plugin

---

## Heading Normal

Konten di bawah heading normal.

## Heading dengan Ampersand & Simbol

Konten di bawah heading dengan karakter spesial.

## Heading 123 Angka

Konten di bawah heading dengan angka.

## Heading Unicode Bahasa Indonesia

Konten dengan karakter é, ñ, ü seharusnya dipertahankan.

## Heading Duplikat

Ini heading duplikat pertama (slug: #heading-duplikat).

## Heading Duplikat

Ini heading duplikat kedua (slug: #heading-duplikat-1).

## OFM Format

Heading ini diakses via OFM format di TOC — harus tetap berfungsi.
```

### Test Cases Manual

Jalankan setiap test case berikut secara manual di dev vault:

#### TC-01: Heading Normal (Reading Mode)

1. Buka `test-fixture.md` di Reading Mode
2. Klik link `[Heading Normal](#heading-normal)`
3. Expected: scroll ke `## Heading Normal`

#### TC-02: Heading dengan Karakter Spesial (Reading Mode)

1. Klik link `[Heading dengan Ampersand](#heading-dengan-ampersand--simbol)`
2. Expected: scroll ke `## Heading dengan Ampersand & Simbol`
3. Note: double hyphen `--` adalah output GFM yang benar untuk `&` (ampersand
   dihapus, spasi setelahnya menjadi hyphen, collapse menghasilkan `--`)

#### TC-03: Duplicate Heading (Reading Mode)

1. Klik `[Heading Duplikat](#heading-duplikat)` — expected: heading pertama
2. Klik `[Heading Duplikat (kedua)](#heading-duplikat-1)` — expected: heading kedua

#### TC-04: OFM Passthrough (Reading Mode)

1. Klik link `[OFM Format](#OFM%20Format)`
2. Expected: berfungsi normal (Obsidian default handler mengambil alih)
3. Verify: plugin tidak double-process link ini

#### TC-05: Hover Preview

1. Hover (tanpa klik) pada setiap link di TOC
2. Expected: Page Preview popup muncul dengan konten heading yang benar

#### TC-06: Live Preview Mode

1. Buka file di Live Preview Mode
2. Klik masing-masing link di TOC
3. Expected: identik dengan TC-01 sampai TC-04

#### TC-07: Cross-file Anchor

1. Buat file baru `other-file.md` dengan heading `## Target Section`
2. Di file lain, buat link `[link](other-file.md#target-section)`
3. Klik link tersebut
4. Expected: `other-file.md` terbuka dan scroll ke `## Target Section`

### Unit Tests (Opsional tapi Direkomendasikan)

Setup Vitest untuk testing modul `slug.ts` yang pure:

```bash
pnpm add -D vitest
```

```typescript
// src/slug.test.ts
import { describe, it, expect } from 'vitest';
import { toGFMSlug, buildSlugMap, isGFMSlug } from './slug';

describe('toGFMSlug', () => {
  it('normalizes simple heading', () => {
    expect(toGFMSlug('Hello World')).toBe('hello-world');
  });

  it('removes ampersand and collapses double hyphen', () => {
    expect(toGFMSlug('Glosarium & Kode Sistem')).toBe('glosarium--kode-sistem');
  });

  it('preserves unicode letters', () => {
    expect(toGFMSlug('Héllo Wörld')).toBe('héllo-wörld');
  });

  it('handles numbers', () => {
    expect(toGFMSlug('Section 123')).toBe('section-123');
  });
});

describe('isGFMSlug', () => {
  it('detects GFM slug', () => {
    expect(isGFMSlug('glosarium--kode-sistem')).toBe(true);
  });

  it('detects OFM URL-encoded slug', () => {
    expect(isGFMSlug('Glosarium%20&%20Kode%20Sistem')).toBe(false);
  });

  it('detects OFM preserve-case slug', () => {
    expect(isGFMSlug('Hello World')).toBe(false);
  });
});

describe('buildSlugMap — duplicate headings', () => {
  it('handles duplicate headings with numeric suffix', () => {
    const headings = [
      { heading: 'Section', level: 2, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } },
      { heading: 'Section', level: 2, position: { start: { line: 5, col: 0, offset: 0 }, end: { line: 5, col: 0, offset: 0 } } },
    ];
    const map = buildSlugMap(headings);
    expect(map.get('section')).toBe('Section');
    expect(map.get('section-1')).toBe('Section');
  });
});
```

---

## Debugging Guide

### Setup Developer Tools

Buka Obsidian Developer Tools: `Ctrl+Shift+I` (Windows/Linux) atau `Cmd+Option+I` (Mac).

Semua `console.log` dari plugin muncul di tab **Console**.
Filter log plugin dengan prefix `[gfm-anchor]`.

### Debug Slug Algorithm

Paste langsung di Console untuk test slug tanpa restart plugin:

```javascript
// Test slug generation
function toGFMSlug(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Test dengan heading dari dokumen aktif
const headings = app.metadataCache.getFileCache(
  app.workspace.getActiveFile()
)?.headings ?? [];

headings.forEach(h => {
  console.log(`"${h.heading}" → "${toGFMSlug(h.heading)}"`);
});
```

### Debug Slug Map

```javascript
// Cek slug map untuk file aktif
const file = app.workspace.getActiveFile();
const cache = app.metadataCache.getFileCache(file);
const headings = cache?.headings ?? [];
console.table(headings.map(h => ({ heading: h.heading, line: h.position.start.line })));
```

### Debug Post-Processor

Verifikasi bahwa post-processor berjalan:

```javascript
// Di Console setelah plugin loaded — inject temporary logger
const originalRegister = app.workspace.registerMarkdownPostProcessor;
console.log('Post processors registered:', app.workspace._postProcessors?.length ?? 'unknown');
```

### Masalah Umum dan Solusinya

**Masalah:** Klik tidak bereaksi sama sekali di Reading Mode.

Kemungkinan penyebab:

- Post-processor tidak terdaftar dengan benar
- Event listener di-attach ke element yang salah

Langkah debug:

1. Buka Console, cek apakah ada log `[gfm-anchor] Plugin loaded`
2. Jika tidak ada: plugin tidak ter-load. Cek Settings → Community Plugins →
   pastikan plugin enabled
3. Inspect element anchor di Reading Mode: klik kanan → Inspect
4. Di Console: `document.querySelectorAll('a[href^="#"]')` — verifikasi
   ada elemen yang ter-select

---

**Masalah:** Hover preview tidak muncul (tapi klik berfungsi).

Kemungkinan penyebab:

- `hover-link` event name berubah di versi Obsidian baru
- Mutasi `event.linktext` tidak berhasil

Langkah debug:

```javascript
// Inject sementara untuk sniff event shape
app.workspace.on('hover-link', (e) => {
  console.log('[debug] hover-link event:', JSON.stringify(Object.keys(e)));
  console.log('[debug] linktext:', e.linktext);
});
```

Jika output tidak muncul saat hover: event name mungkin berbeda.
Coba: `'link-hover'`, `'hover-link-event'`.

---

**Masalah:** Live Preview tidak merespons klik.

Kemungkinan penyebab:

- CM6 ViewPlugin tidak terdaftar
- `registerEditorExtension` dipanggil sebelum editor ready

Langkah debug:

1. Cek apakah klik di Reading Mode berfungsi — jika ya, issue terisolasi di
   Live Preview
2. Di Console:

    ```javascript
    // Cek apakah ada error CM6
    app.workspace.activeEditor?.editor?.cm?.state?.config?.dynamicSlots
    ```

3. Coba switch ke Reading Mode dan kembali ke Live Preview untuk force re-render

---

**Masalah:** Link `#glosarium--kode-sistem` tidak navigate dengan benar.

Kemungkinan penyebab: heading duplikat atau karakter Unicode yang ditangani berbeda.

Langkah debug:

```javascript
// Verifikasi slug yang dihasilkan vs yang diexpect
const file = app.workspace.getActiveFile();
const headings = app.metadataCache.getFileCache(file)?.headings ?? [];

// Manual slug test
const heading = 'Glosarium & Kode Sistem';
const slug = heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
console.log('Expected slug:', slug);
// Output harus: "glosarium--kode-sistem"
// Jika output "glosarium-kode-sistem" (single hyphen): 
// bug di regex — spasi setelah & tidak diproses dengan benar
```

---

**Masalah:** OFM links rusak setelah plugin diaktifkan.

Kemungkinan penyebab: `isGFMSlug()` salah mengidentifikasi OFM slug sebagai GFM.

Langkah debug:

```javascript
function isGFMSlug(fragment) {
  if (/%[0-9A-F]{2}/i.test(fragment)) return false;
  if (/[A-Z]/.test(fragment)) return false;
  return true;
}

// Test dengan fragment yang bermasalah
console.log(isGFMSlug('Glosarium%20&%20Kode%20Sistem')); // harus false
console.log(isGFMSlug('glosarium--kode-sistem'));          // harus true
console.log(isGFMSlug('OFM%20Format'));                    // harus false
```

---

### Build dan Release

```bash
# Development build dengan watch mode
pnpm run dev

# Production build (minified, no source maps)
pnpm run build

# Output: main.js di root folder
```

Untuk release ke community plugin store, ikuti panduan resmi:
<https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>

---

## Batasan dan Keputusan Desain

**Mengapa tidak patch Obsidian's markdown parser secara langsung?**
Obsidian tidak mengekspos markdown parser internal sebagai public API.
Post-processor dan event hooks adalah satu-satunya surface yang stabil.

**Mengapa anchor link di DOM di-mutate ke format OFM (di reading-mode.ts)?**
Hover preview Obsidian membaca `href` attribute dari DOM element secara langsung
untuk menentukan target preview. Menyimpan GFM slug dan me-update `href` ke OFM
adalah satu-satunya cara agar hover preview berfungsi tanpa mengganti
seluruh hover rendering pipeline.

**Mengapa `isGFMSlug` mengecek uppercase dan `%XX`?**
OFM selalu preserve-case (mengandung uppercase jika heading-nya uppercase)
dan selalu URL-encode spasi menjadi `%20`. Dua kondisi ini mutual exclusive
dengan GFM yang selalu lowercase dan tidak URL-encode. Detection ini
adalah heuristic yang akurat untuk dokumen standar.
Edge case: heading yang seluruhnya lowercase tanpa karakter spesial — ambiguous
antara GFM dan OFM. Plugin menganggap ini GFM (lowercase-only slug adalah
valid GFM) dan resolusi tetap benar karena heading-nya identik.

---

## Referensi

- GFM Specification: <https://github.github.com/gfm/>
- GFM Anchor Algorithm Reference: <https://github.com/jch/html-pipeline>
- Obsidian Plugin API: <https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin>
- CodeMirror 6 ViewPlugin: <https://codemirror.net/docs/ref/#view.ViewPlugin>
- Obsidian Sample Plugin (template): <https://github.com/obsidianmd/obsidian-sample-plugin>
- Feature request thread (Obsidian Forum): <https://forum.obsidian.md/t/support-gfm-style-kebab-case-heading-slug-anchor-targets/30350>
