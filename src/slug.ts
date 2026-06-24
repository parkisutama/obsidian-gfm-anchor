import type { HeadingCache } from 'obsidian';

/**
 * Converts a heading string to a GFM anchor slug.
 * Unicode-aware: preserves non-ASCII letters (é, ñ, ü, etc.).
 */
export function toGFMSlug(heading: string): string {
    return heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s/gu, '-');
}

/**
 * Detects whether a fragment is a GFM-style slug (not OFM).
 * OFM fragments contain uppercase letters or %XX URL encoding.
 * GFM slugs are always lowercase with only letters, digits, and hyphens.
 */
export function isGFMSlug(fragment: string): boolean {
    if (fragment.length === 0) return false;
    if (/%[0-9A-Fa-f]{2}/u.test(fragment)) return false;
    if (/[A-Z]/u.test(fragment)) return false;
    return true;
}

/**
 * Builds a mapping from GFM slug → original heading text.
 * Handles duplicate headings with numeric suffix (GFM convention):
 * #section, #section-1, #section-2, etc.
 */
export function buildSlugMap(headings: HeadingCache[]): Map<string, string> {
    const map = new Map<string, string>();
    const counter = new Map<string, number>();

    for (const h of headings) {
        const base = toGFMSlug(h.heading);
        const count = counter.get(base) ?? 0;
        const slug = count === 0 ? base : `${base}-${count}`;

        counter.set(base, count + 1);

        if (!map.has(slug)) {
            map.set(slug, h.heading);
        }
    }

    return map;
}
