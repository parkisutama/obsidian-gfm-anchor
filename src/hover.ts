import type { App, TFile } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

interface HoverLinkEvent {
    event: MouseEvent;
    source: string;
    hoverParent: Element;
    targetEl: Element | null;
    linktext: string;
    sourcePath: string;
}

/**
 * Rewrites a hover-link event's linktext in-place if it contains a GFM slug.
 * Called both from the trigger patch (pre-listener) and the event listener (fallback).
 */
export function rewriteHoverEvent(rawEvent: unknown, app: App): void {
    if (!isHoverLinkEvent(rawEvent)) return;

    const linktext = rawEvent.linktext;

    // Handle "#fragment", "filename#fragment", and bare "fragment" (no #) forms.
    const hashIndex = linktext.indexOf('#');
    const filePart = hashIndex >= 0 ? linktext.slice(0, hashIndex) : '';
    const fragmentRaw = hashIndex >= 0 ? linktext.slice(hashIndex) : linktext;

    const fragment = parseFragment(fragmentRaw);
    if (!fragment) return;

    let file: TFile | null;
    if (filePart) {
        const resolved = app.metadataCache.getFirstLinkpathDest(
            filePart,
            rawEvent.sourcePath
        );
        file = resolved instanceof Object ? resolved as TFile : null;
    } else {
        file = app.vault.getFileByPath(rawEvent.sourcePath);
    }
    if (!file) return;

    const heading = resolveSlug(fragment, file, app);
    if (!heading) return;

    const newLinktext = `${filePart}#${heading}`;
    rawEvent.linktext = newLinktext;
}

/**
 * Creates a hover-link event listener (fallback for any events not caught
 * by the trigger patch).
 */
export function registerHoverHandler(app: App): (event: unknown) => void {
    return (rawEvent: unknown) => rewriteHoverEvent(rawEvent, app);
}

function isHoverLinkEvent(value: unknown): value is HoverLinkEvent {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return typeof obj['linktext'] === 'string' && typeof obj['sourcePath'] === 'string';
}
