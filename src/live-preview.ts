import { ViewPlugin, EditorView } from '@codemirror/view';
import type { App, TFile } from 'obsidian';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

const ANCHOR_SELECTOR =
    'a.internal-link, a[data-href*="#"], a[href^="#"]';

/**
 * Read the raw fragment from an anchor's data-href or href.
 * Works with or without # prefix.
 */
function readRawFragment(anchor: HTMLAnchorElement): string | null {
    const raw =
        anchor.getAttribute('data-href') ?? anchor.getAttribute('href');
    if (!raw) return null;
    return parseFragment(raw);
}

/**
 * Safely retrieve the TFile associated with this CM6 editor view
 * via Obsidian's editorInfoField StateField.
 */
function getFileFromView(view: EditorView): TFile | null {
    try {
        return view.state.field(editorInfoField).file;
    } catch {
        return null;
    }
}

/**
 * Check whether this CM6 editor is currently in Live Preview mode.
 * Returns false if the field is unavailable (e.g. Source Mode).
 */
function isLivePreview(view: EditorView): boolean {
    try {
        return view.state.field(editorLivePreviewField);
    } catch {
        return false;
    }
}

/**
 * CM6 ViewPlugin for Live Preview mode.
 *
 * Responsibilities:
 * 1. DOM rewriting — rewrites data-href/href on rendered <a> elements from
 *    GFM slug to OFM heading text. This enables Obsidian's native Page
 *    Preview (hover) to work correctly.
 * 2. mouseover handler — catches elements that weren't rewritten yet
 *    (e.g., just rendered by CM6) and rewrites just before hover triggers.
 *
 * Note: click/navigation in LP is handled by the document-level mousedown
 * capture handler in main.ts, which fires before Obsidian's CM6 handlers.
 */
function createLivePreviewPlugin(app: App) {
    return ViewPlugin.fromClass(
        class {
            private rafId = 0;

            constructor(private view: EditorView) {
                this.scheduleRewrite();
            }

            update(): void {
                // Always schedule — CM6 can re-render widget decorations
                // on any update (doc, viewport, selection, height, focus).
                // The rAF debounce + data-gfm-processed flag keep cost low.
                this.scheduleRewrite();
            }

            destroy(): void {
                cancelAnimationFrame(this.rafId);
            }

            private scheduleRewrite(): void {
                cancelAnimationFrame(this.rafId);
                this.rafId = requestAnimationFrame(() => {
                    try {
                        this.rewriteAnchors();
                    } catch (e: unknown) {
                        console.warn('[gfm-anchor] LP rewrite error:', e);
                    }
                });
            }

            private rewriteAnchors(): void {
                if (!isLivePreview(this.view)) return;

                const file = getFileFromView(this.view);
                if (!file) return;

                const anchors =
                    this.view.contentDOM.querySelectorAll<HTMLAnchorElement>(
                        ANCHOR_SELECTOR
                    );

                if (anchors.length === 0) return;

                for (const anchor of anchors) {
                    if (anchor.dataset['gfmProcessed']) continue;

                    const fragment = readRawFragment(anchor);
                    if (!fragment) continue;

                    const heading = resolveSlug(fragment, file, app);
                    if (!heading) continue;

                    anchor.dataset['gfmSlug'] = fragment;
                    anchor.setAttribute('data-href', `#${heading}`);
                    anchor.setAttribute('href', `#${heading}`);
                    anchor.dataset['gfmProcessed'] = 'true';
                }
            }
        },
        {
            eventHandlers: {
                mouseover(e: MouseEvent, view: EditorView) {
                    try {
                        const target = e.target;
                        if (!(target instanceof HTMLElement)) return;

                        const anchor =
                            target.closest<HTMLAnchorElement>(
                                ANCHOR_SELECTOR
                            );
                        if (!anchor || anchor.dataset['gfmProcessed']) return;

                        if (!isLivePreview(view)) return;

                        const fragment = readRawFragment(anchor);
                        if (!fragment) return;

                        const file = getFileFromView(view);
                        if (!file) return;

                        const heading = resolveSlug(fragment, file, app);
                        if (!heading) return;

                        anchor.dataset['gfmSlug'] = fragment;
                        anchor.setAttribute('data-href', `#${heading}`);
                        anchor.setAttribute('href', `#${heading}`);
                        anchor.dataset['gfmProcessed'] = 'true';
                    } catch {
                        // ignore mouseover errors silently
                    }
                }
            }
        }
    );
}

export { createLivePreviewPlugin };
