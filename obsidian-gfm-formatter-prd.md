# PRD — obsidian-gfm-formatter

> Product Requirements Document untuk plugin Obsidian terpisah yang memformat anchor link dari format OFM ke GFM.
> Plugin ini dirancang agar 100% kompatibel dengan **obsidian-gfm-anchor** (resolver runtime).

---

## 1. Latar Belakang & Masalah

### 1.1 Dua standar anchor yang tidak kompatibel

Obsidian menggunakan dua format anchor yang berbeda:

| Format | Nama Resmi | Contoh untuk heading `## Hello & World` |
|--------|-----------|------------------------------------------|
| GFM | GitHub Flavored Markdown | `#hello--world` |
| OFM | Obsidian Flavored Markdown | `#Hello%20&%20World` |

GFM digunakan oleh: GitHub, GitLab, MkDocs, Hugo, Typora, Pandoc.
OFM digunakan oleh: Obsidian secara internal (auto-complete `[[#`).

### 1.2 Plugin obsidian-gfm-anchor (existing, jangan disentuh)

Plugin **gfm-anchor** sudah ada dan bekerja sebagai **runtime resolver** — ia mengizinkan GFM anchor yang sudah ada di dalam file untuk diklik dan di-hover dengan benar di Obsidian, tanpa mengubah isi file.

Cara kerjanya:

1. User klik/hover anchor `#hello-world`
2. Plugin deteksi: apakah ini GFM slug? (lowercase, tidak ada `%XX`, tidak ada uppercase)
3. Jika ya → bangun slug map dari semua heading di file → resolve `hello-world` → `Hello & World`
4. Navigasi ke heading OFM menggunakan Obsidian native API
5. **File tidak pernah disentuh**

### 1.3 Kebutuhan yang belum terpenuhi

User yang menulis/mengimpor dokumen dari GitHub, MkDocs, atau tool lain sering punya anchor OFM (`#Hello%20%26%20World`) padahal seharusnya GFM (`#hello--world`) — atau sebaliknya. Tidak ada tool batch yang bisa mengkonversi anchor link dalam file vault secara massal, presisi, dan aman.

---

## 2. Tujuan Plugin Baru: obsidian-gfm-formatter

| | |
|---|---|
| **Plugin ID** | `gfm-formatter` |
| **Nama tampil** | GFM Formatter |
| **Fungsi inti** | Konversi anchor link dari OFM → GFM di dalam konten file |
| **Scope** | File aktif / folder / vault (on-demand command) |
| **Integrasi target** | Obsidian Linter via Custom Lint Commands |
| **Relasi ke gfm-anchor** | Komplementer — formatter menulis ulang file, resolver membaca ulang |

---

## 3. GFM Anchor Spec (Referensi Implementasi)

### 3.1 Algoritma slug GFM

Algoritma ini **wajib identik** dengan yang ada di `obsidian-gfm-anchor/src/slug.ts`:

```
toGFMSlug(heading):
  1. Lowercase seluruh string
  2. Hapus semua karakter KECUALI: Unicode letters (\\p{L}), Unicode digits (\\p{N}), spasi, hyphen
  3. Trim leading/trailing whitespace
  4. Ganti setiap spasi dengan hyphen (tidak collapse — setiap spasi jadi satu hyphen)
```

> **KRITIS**: Flag `u` dan `\\p{L}` WAJIB digunakan. Tanpa ini, karakter non-ASCII (é, ñ, ü, 日本語) akan salah dihapus.

```typescript
// Implementasi referensi (dari slug.ts)
function toGFMSlug(heading: string): string {
    return heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')  // Unicode-aware
        .trim()
        .replace(/\s/gu, '-');               // setiap spasi → hyphen
}
```

### 3.2 Contoh konversi heading → slug

| Heading | GFM Slug | Keterangan |
|---------|----------|-----------|
| `Hello World` | `hello-world` | kasus dasar |
| `Hello & World` | `hello--world` | `&` dihapus → dua spasi → dua hyphen |
| `Section 1.2` | `section-12` | titik dihapus |
| `Héllo Wörld` | `héllo-wörld` | Unicode huruf dipertahankan |
| `日本語テスト` | `日本語テスト` | Japanese dipertahankan |
| `Café au lait` | `café-au-lait` | aksen dipertahankan |
| `!@#$%^&*()` | `` (string kosong) | semua charakter special dihapus |
| `multiple   spaces` | `multiple---spaces` | setiap spasi → hyphen (tanpa collapse) |

### 3.3 Handling duplicate headings (KRITIS)

GFM menggunakan suffix numerik. Counter dimulai dari 0 (tidak ada suffix), lalu `‑1`, `‑2`, dst.

```
Headings di file:
  Section (pertama)  → #section
  Section (kedua)    → #section-1
  Section (ketiga)   → #section-2
  Other              → #other
```

> Plugin formatter WAJIB mengimplementasikan counter ini identik agar anchor yang dihasilkan sesuai dengan yang diselesaikan oleh gfm-anchor.

Pseudocode:

```
buildSlugMap(headings[]):
  counter = Map<string, int>
  result  = Map<string, string>   // slug → heading original
  
  for each heading h:
    base  = toGFMSlug(h.text)
    count = counter.get(base) ?? 0
    slug  = count === 0 ? base : base + "-" + count
    counter.set(base, count + 1)
    result.set(slug, h.text)      // pertama kali saja
```

### 3.4 Deteksi apakah fragment adalah OFM (bukan GFM)

Sebuah anchor fragment dianggap perlu dikonversi jika:

- Mengandung `%XX` URL encoding (ciri khas OFM), **atau**
- Mengandung huruf uppercase (OFM preserve case)

Fragment dianggap sudah GFM / tidak perlu disentuh jika:

- Seluruhnya lowercase
- Tidak ada `%XX` encoding
- Hanya mengandung huruf, angka, hyphen

---

## 4. Format Link yang Akan Diproses

Plugin formatter perlu menangani 4 jenis anchor link:

### 4.1 Markdown link intra-file

```markdown
[teks](#Hello%20World)          →  [teks](#hello-world)
[teks](#Hello World)            →  [teks](#hello-world)
[teks](#HelloWorld)             →  [teks](#helloworld)   ← hanya jika heading ditemukan
```

### 4.2 Markdown link lintas file

```markdown
[teks](other-file.md#Hello%20World)   →  [teks](other-file.md#hello-world)
[teks](notes/sub.md#My Section)       →  [teks](notes/sub.md#my-section)
```

### 4.3 Wikilink dengan anchor intra-file

```markdown
[[#Hello & World]]              →  [[#hello--world]]
[[#Hello & World|alias]]        →  [[#hello--world|alias]]
```

### 4.4 Wikilink dengan anchor lintas file

```markdown
[[other-file#Hello World]]      →  [[other-file#hello-world]]
[[notes/sub#My Section|alias]]  →  [[notes/sub#hello-world|alias]]  ← gunakan slug dari target
```

---

## 5. Apa yang TIDAK Boleh Diproses

### 5.1 Zone yang wajib diabaikan (skip)

| Zone | Contoh | Alasan |
|------|--------|--------|
| Fenced code block | ` ```\n...\n``` ` | Konten literal, bukan markdown |
| Indented code block | 4 spasi di awal | Idem |
| Inline code | `` `[link](#anchor)` `` | Literal |
| YAML frontmatter | `---\n...\n---` | Bukan markdown body |
| URL eksternal | `[text](https://example.com#section)` | Bukan internal anchor |
| HTML block | `<a href="#anchor">` | Scope berbeda |

### 5.2 Link yang sudah GFM — jangan disentuh

Jika fragment sudah lowercase dan tidak ada encoding, biarkan apa adanya.

### 5.3 Anchor yang tidak ditemukan di heading

Jika tidak ada heading yang cocok di target file, biarkan link apa adanya (jangan hapus atau ubah).

---

## 6. Fitur & Commands

### 6.1 Commands yang wajib ada

| Command ID | Nama | Scope |
|-----------|------|-------|
| `gfm-formatter:convert-active-file` | Convert GFM Anchors: Active File | File aktif saja |
| `gfm-formatter:convert-vault` | Convert GFM Anchors: Entire Vault | Semua .md di vault |
| `gfm-formatter:convert-folder` | Convert GFM Anchors: Choose Folder | Folder tertentu (folder picker) |

> Command `convert-active-file` adalah command yang didaftarkan di Obsidian Linter Custom Lint Commands.

### 6.2 Context menu (opsional, v1.1+)

Tambahkan item di context menu file/folder explorer:

- "Convert GFM Anchors" pada file .md
- "Convert GFM Anchors in Folder" pada folder

### 6.3 Settings

| Key | Type | Default | Keterangan |
|-----|------|---------|-----------|
| `convertMarkdownLinks` | boolean | `true` | Proses `[text](file#anchor)` |
| `convertWikiLinks` | boolean | `true` | Proses `[[file#anchor]]` |
| `skipCodeBlocks` | boolean | `true` | Skip fenced/indented code blocks |
| `contextMenu` | boolean | `true` | Tampilkan context menu |

---

## 7. Kompatibilitas dengan obsidian-gfm-anchor

### 7.1 Kontrak yang wajib dijaga

Plugin formatter HARUS menggunakan **algoritma slug yang identik** dengan gfm-anchor. Kalau tidak, hasil konversi formatter tidak akan bisa di-resolve oleh gfm-anchor.

Cara terbaik: copy atau import logika yang sama.

```typescript
// Copy exact dari obsidian-gfm-anchor/src/slug.ts
function toGFMSlug(heading: string): string {
    return heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s/gu, '-');
}
```

### 7.2 Alur kerja kompatibel

**Sebelum formatter dijalankan:**

```markdown
[lihat section ini](#Hello%20%26%20World)   ← OFM, gfm-anchor sudah bisa handle ini
```

**Sesudah formatter dijalankan:**

```markdown
[lihat section ini](#hello--world)           ← GFM, gfm-anchor tetap bisa handle ini
```

Kedua kondisi → gfm-anchor navigate dengan benar. Tidak ada break.

### 7.3 Skenario edge case / potensi konflik

| Skenario | Behavior yang benar |
|----------|---------------------|
| Fragment sudah GFM | Biarkan, jangan proses ulang |
| Heading tidak ada di cache | Biarkan link apa adanya |
| Cross-file & target file belum di-cache | Skip (bisa notice warning opsional) |
| gfm-anchor tidak aktif | Formatter tetap bekerja independen |
| Formatter dijalankan 2x | Idempotent — hasil kedua sama dengan pertama |

---

## 8. Arsitektur Internal (Rekomendasi)

```text
src/
├── main.ts           ← Plugin entry, register commands, settings, context menu
├── settings.ts       ← Settings interface + SettingTab
├── slug.ts           ← toGFMSlug(), buildSlugMap() — COPY dari gfm-anchor, jangan import
├── parser.ts         ← Deteksi & ekstraksi semua link dari teks markdown
├── converter.ts      ← Logika utama konversi OFM → GFM per-link per-file
└── utils.ts          ← Helpers: skip code fence, get headings, normalize path
```

### 8.1 Alur konversi per file

```
convertFile(file):
  1. Baca konten file (vault.read)
  2. Build heading map dari metadataCache untuk file ini
  3. Parse konten, identifikasi semua zone yang harus di-skip
  4. Untuk setiap link yang ditemukan (di luar zone skip):
     a. Ekstrak filePart dan fragment
     b. Resolve target file (intra = current file, lintas = metadataCache)
     c. Build slug map untuk target file dari headingnya
     d. Cek apakah fragment adalah OFM (ada %XX atau uppercase)
     e. Jika OFM: decode → cari heading → toGFMSlug → replace
     f. Jika sudah GFM / tidak ditemukan: biarkan
  5. Jika ada perubahan: vault.modify(file, newContent)
```

### 8.2 Parser link minimal yang dibutuhkan

```typescript
// Markdown link: [label](target#fragment)
const MD_LINK = /\[([^\]]*)\]\(([^)#]*)#([^)]+)\)/gu;

// Wikilink: [[target#fragment]] atau [[target#fragment|alias]]
const WIKI_LINK = /\[\[([^#|\]]*?)#([^\]|]+?)(\|[^\]]+)?\]\]/gu;
```

### 8.3 Skip zone parser

Wajib dideteksi dan di-skip sebelum menjalankan regex link:

1. YAML frontmatter: `---` sampai `---` di awal file
2. Fenced code block: ` ``` ` sampai ` ``` ` atau `~~~` sampai `~~~`
3. Indented code block: baris yang diawali 4+ spasi
4. Inline code: `` `...` ``

---

## 9. Non-Goals (Eksplisit Tidak Ada di v1)

- Tidak ada fitur konversi arah balik (GFM → OFM)
- Tidak ada real-time / live transform saat mengetik
- Tidak ada perubahan path file atau format link (wikilink ↔ markdown) — itu domain Link Converter
- Tidak ada UI settings yang kompleks
- Tidak ada sync / two-way dengan gfm-anchor

---

## 10. Integrasi Obsidian Linter

### 10.1 Cara mendaftarkan

Di Settings Obsidian Linter:

1. Buka **Custom Rules** → **Custom Lint Commands**
2. Tambahkan command: `GFM Formatter: Convert GFM Anchors: Active File`
3. Setiap kali Linter berjalan (manual/on-save), formatter akan dijalankan otomatis setelahnya

### 10.2 Urutan eksekusi

```
Linter rules (heading, spacing, yaml, dll)
        ↓
GFM Formatter — convert anchor (dijalankan via Custom Lint Commands)
        ↓
File tersimpan dengan anchor GFM yang benar
        ↓
gfm-anchor — resolve anchor saat user klik (runtime, tanpa menyentuh file)
```

### 10.3 Catatan penting tentang timing

- Linter sudah selesai mengubah heading sebelum formatter dijalankan (karena Custom Lint Commands berjalan setelah rules)
- Formatter membaca metadata cache yang mungkin belum di-refresh → disarankan gunakan custom heading parser dari teks file yang sudah di-lint, bukan hanya mengandalkan `app.metadataCache`

---

## 11. Batasan Teknis & Risk

| Risk | Mitigasi |
|------|----------|
| Metadata cache belum update saat command dipanggil | Parse heading langsung dari teks file (tidak hanya cache) |
| Regex link salah pattern | Test unit per format link |
| Konversi tidak idempotent | Cek apakah fragment sudah GFM sebelum konversi |
| File dengan banyak link → lambat | Proses sekali pass, bukan multiple replace |
| Konflik dengan undo history Obsidian | Gunakan `vault.modify`, bukan `editor.replaceRange` |

---

## 12. Acceptance Criteria

- [ ] Konversi `[text](#Hello%20World)` → `[text](#hello-world)` dengan benar
- [ ] Konversi `[[#Hello & World]]` → `[[#hello--world]]` dengan benar
- [ ] Duplicate heading menghasilkan suffix yang benar: `#section`, `#section-1`, `#section-2`
- [ ] Link di dalam fenced code block tidak ikut dikonversi
- [ ] Link di dalam inline code tidak ikut dikonversi
- [ ] Link ke URL eksternal tidak disentuh
- [ ] Link yang heading-nya tidak ditemukan → tidak diubah
- [ ] Menjalankan konversi 2x menghasilkan output yang sama (idempotent)
- [ ] Unicode heading (é, ñ, 日本語) menghasilkan slug yang sama persis dengan gfm-anchor
- [ ] Obsidian Linter dapat memanggil command via Custom Lint Commands

---

## 13. Stack Teknis

- **Bahasa**: TypeScript (strict mode, ES2022, tidak ada `any`)
- **Build**: esbuild (sama dengan gfm-anchor)
- **Package manager**: pnpm
- **Test**: Vitest — unit test pada `slug.ts`, `parser.ts`, `converter.ts`
- **Runtime dependency**: Zero (hanya Obsidian API)
- **Min Obsidian**: `1.4.0`

---

## 14. Referensi

| Sumber | Relevansi |
|--------|-----------|
| `obsidian-gfm-anchor/src/slug.ts` | Algoritma slug yang wajib direplikasi |
| `obsidian-gfm-anchor/src/resolver.ts` | Cara deteksi OFM vs GFM (`isGFMSlug`) |
| GitHub GFM Spec (heading anchors) | Definisi resmi algoritma slug |
| `platers/obsidian-linter` — Custom Lint Commands | Cara integrasi via command |
| `ozntel/obsidian-link-converter` — `converter.ts` | Referensi pola parsing wikilink + markdown link |
