import type { App, TFile } from 'obsidian';
import type { HeadingCache } from 'obsidian';
import { isGFMSlug, toGFMSlug } from './slug';

export interface ResolvedSlugTarget {
    heading: string;
    line: number;
    headingOccurrence: number;
}

/**
 * Resolves a GFM slug to the original heading text for a given file.
 * Returns null if the slug doesn't match any heading or isn't GFM format.
 */
export function resolveSlug(
    slug: string,
    file: TFile,
    app: App
): string | null {
    return resolveSlugTarget(slug, file, app)?.heading ?? null;
}

/**
 * Resolves a GFM slug to the original heading text and source position.
 */
export function resolveSlugTarget(
    slug: string,
    file: TFile,
    app: App
): ResolvedSlugTarget | null {
    if (!isGFMSlug(slug)) return null;

    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.headings?.length) return null;

    const target = resolveHeadingCache(slug, cache.headings);
    if (!target) return null;

    return {
        heading: target.heading.heading,
        line: target.heading.position.start.line,
        headingOccurrence: target.headingOccurrence,
    };
}

function resolveHeadingCache(
    slug: string,
    headings: HeadingCache[]
): { heading: HeadingCache; headingOccurrence: number } | null {
    const slugCounter = new Map<string, number>();
    const headingCounter = new Map<string, number>();

    for (const heading of headings) {
        const base = toGFMSlug(heading.heading);
        const slugCount = slugCounter.get(base) ?? 0;
        const candidate = slugCount === 0 ? base : `${base}-${slugCount}`;
        const headingOccurrence = headingCounter.get(heading.heading) ?? 0;

        slugCounter.set(base, slugCount + 1);
        headingCounter.set(heading.heading, headingOccurrence + 1);

        if (candidate === slug) {
            return { heading, headingOccurrence };
        }
    }

    return null;
}

/**
 * Extracts a GFM fragment from an href/data-href string.
 * Handles all formats:
 *   "#gfm-slug"           → "gfm-slug"
 *   "gfm-slug"            → "gfm-slug"  (Obsidian may omit #)
 *   "file#gfm-slug"       → "gfm-slug"
 *   "#Obsidian%20Style"   → "Obsidian Style"
 */
export function parseFragment(href: string): string | null {
    const hashIdx = href.indexOf('#');
    let raw: string;
    if (hashIdx >= 0) {
        raw = href.slice(hashIdx + 1);
    } else {
        // No hash — treat entire string as potential fragment
        raw = href;
    }
    if (!raw) return null;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}
