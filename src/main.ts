import { MarkdownView, Plugin } from 'obsidian';
import type { App, TFile, WorkspaceLeaf } from 'obsidian';
import { registerReadingModePostProcessor } from './reading-mode';
import { registerHoverHandler, rewriteHoverEvent } from './hover';
import { createLivePreviewPlugin } from './live-preview';
import {
    parseFragment,
    resolveSlug,
    resolveSlugTarget,
    type ResolvedSlugTarget,
} from './resolver';

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function getTargetFile(
    app: App,
    raw: string,
    sourcePath: string
): TFile | null {
    const hashIdx = raw.indexOf('#');
    if (hashIdx < 0) {
        return app.vault.getFileByPath(sourcePath);
    }

    const filePart = raw.slice(0, hashIdx);
    if (!filePart) {
        return app.vault.getFileByPath(sourcePath);
    }

    return app.metadataCache.getFirstLinkpathDest(filePart, sourcePath);
}

function scrollPreviewToHeading(
    view: MarkdownView,
    target: ResolvedSlugTarget
): boolean {
    const headings = Array.from(
        view.previewMode.containerEl.querySelectorAll<HTMLElement>(
            'h1,h2,h3,h4,h5,h6'
        )
    ).filter((heading) => heading.textContent?.trim() === target.heading);

    const heading = headings[target.headingOccurrence];
    if (!heading) return false;

    heading.scrollIntoView({ block: 'start' });
    return true;
}

function scrollMarkdownViewToTarget(
    view: MarkdownView,
    target: ResolvedSlugTarget
): void {
    if (view.getMode() === 'preview' && scrollPreviewToHeading(view, target)) {
        return;
    }

    view.editor.scrollIntoView(
        {
            from: { line: target.line, ch: 0 },
            to: { line: target.line, ch: 0 },
        },
        false
    );
}

async function navigateWithoutHighlight(
    app: App,
    file: TFile,
    target: ResolvedSlugTarget,
    newLeaf: boolean
): Promise<void> {
    const leaf: WorkspaceLeaf =
        app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf(false);

    const targetLeaf = newLeaf ? app.workspace.getLeaf(true) : leaf;
    await targetLeaf.openFile(file);
    await nextFrame();

    if (targetLeaf.view instanceof MarkdownView) {
        scrollMarkdownViewToTarget(targetLeaf.view, target);
    }
}

export default class GFMAnchorPlugin extends Plugin {
    async onload(): Promise<void> {

        // --- openLinkText patch -----------------------------------------------
        // Most robust approach: intercepts ALL navigation (click, hover-preview,
        // keyboard, etc.) regardless of how Obsidian handles LP link events.
        // This fires whenever Obsidian tries to navigate to a GFM slug that it
        // can't find, and redirects it to the correct OFM heading text.
        const origOpenLinkText = this.app.workspace.openLinkText.bind(
            this.app.workspace
        );
        const self = this;

        this.app.workspace.openLinkText = async function patchedOpenLinkText(
            linktext: string,
            sourcePath: string,
            ...rest: unknown[]
        ): Promise<void> {
            const hashIdx = linktext.indexOf('#');
            if (hashIdx >= 0) {
                const filePart = linktext.slice(0, hashIdx);
                const rawFrag = linktext.slice(hashIdx + 1);
                if (rawFrag) {
                    let fragment: string;
                    try { fragment = decodeURIComponent(rawFrag); } catch { fragment = rawFrag; }

                    let file: TFile | null;
                    if (filePart) {
                        file = self.app.metadataCache.getFirstLinkpathDest(
                            filePart, sourcePath
                        ) as TFile | null;
                    } else {
                        file = self.app.vault.getFileByPath(sourcePath);
                    }

                    if (file) {
                        const heading = resolveSlug(fragment, file, self.app);
                        if (heading) {
                            linktext = filePart
                                ? `${filePart}#${heading}`
                                : `#${heading}`;
                        }
                    }
                }
            }
            return (origOpenLinkText as (a: string, b: string, ...r: unknown[]) => Promise<void>)(linktext, sourcePath, ...rest);
        };

        this.register(() => {
            this.app.workspace.openLinkText = origOpenLinkText;
        });
        // ----------------------------------------------------------------------

        // Mousedown handler — capture phase on document, fires BEFORE Obsidian's
        // CM6 event handlers. Only intercepts GFM slugs inside .cm-editor (Live Preview).
        // Kept as a fast-path for cases where the LP link IS an <a> element.
        const handleLPMousedown = (e: MouseEvent): void => {
            if (e.button !== 0) return;
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            if (!target.closest?.('.cm-editor')) return;

            const anchor = target.closest<HTMLAnchorElement>('a');
            if (!anchor) return;

            const raw = anchor.getAttribute('data-href') ?? anchor.getAttribute('href');
            if (!raw) return;

            const fragment = anchor.dataset['gfmSlug'] ?? parseFragment(raw);
            if (!fragment) return;

            const file = this.app.workspace.getActiveFile();
            if (!file) return;

            const slugTarget = resolveSlugTarget(fragment, file, this.app);
            if (!slugTarget) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const newLeaf = e.ctrlKey || e.metaKey;
            void navigateWithoutHighlight(this.app, file, slugTarget, newLeaf);
        };

        document.addEventListener('mousedown', handleLPMousedown, true);
        this.register(() =>
            document.removeEventListener('mousedown', handleLPMousedown, true)
        );

        // Global click handler — capture phase on document.
        // Handles GFM anchor clicks in Reading Mode (LP is handled by mousedown above).
        const handleClick = (e: MouseEvent): void => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            // Find any anchor — broad match
            const anchor = target.closest<HTMLAnchorElement>('a');
            if (!anchor) return;

            // Live Preview is handled by the mousedown handler above
            if (anchor.closest('.cm-editor')) return;

            const dataHref = anchor.getAttribute('data-href');
            const href = anchor.getAttribute('href');

            // Must be a fragment link (contains # or is a GFM-like slug)
            const raw = dataHref ?? href;
            if (!raw) return;

            // Quick check: must contain # or look like a slug (no / or .)
            const hasHash = raw.includes('#');
            const looksLikeSlug = !hasHash && !raw.includes('/') && !raw.includes('.');
            if (!hasHash && !looksLikeSlug) return;

            const fragment = anchor.dataset['gfmSlug'] ?? parseFragment(raw);
            if (!fragment) return;

            const file = this.app.workspace.getActiveFile();
            if (!file) return;

            const targetFile = getTargetFile(this.app, raw, file.path);
            if (!targetFile) return;

            const slugTarget = resolveSlugTarget(
                fragment,
                targetFile,
                this.app
            );
            if (!slugTarget) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const newLeaf = e.ctrlKey || e.metaKey;
            void navigateWithoutHighlight(
                this.app,
                targetFile,
                slugTarget,
                newLeaf
            );
        };

        document.addEventListener('click', handleClick, true);
        this.register(() =>
            document.removeEventListener('click', handleClick, true)
        );

        // Reading Mode — rewrite data-href/href in DOM for native hover
        this.registerMarkdownPostProcessor(
            registerReadingModePostProcessor(this.app)
        );

        // Patch workspace.trigger so we rewrite GFM slugs in 'hover-link' events
        // BEFORE Obsidian's Page Preview core plugin reads event.linktext.
        // Core plugins register their listeners earlier than user plugins, so a
        // normal on('hover-link', ...) listener always fires too late.
        const origTrigger = this.app.workspace.trigger.bind(this.app.workspace);
        const app = this.app;
        (this.app.workspace as { trigger(...a: unknown[]): void }).trigger = function (
            name: unknown, ...args: unknown[]
        ): void {
            if (name === 'hover-link' && args.length > 0) {
                rewriteHoverEvent(args[0], app);
            }
            origTrigger(name as string, ...args);
        };
        this.register(() => {
            // Restore by removing the instance property (exposes prototype method)
            delete (this.app.workspace as { trigger?: unknown }).trigger;
        });

        // Fallback: on('hover-link', ...) listener for any events not caught above
        this.registerEvent(
            // @ts-expect-error 'hover-link' is not in the official EventRef types
            this.app.workspace.on('hover-link', registerHoverHandler(this.app))
        );

        // Live Preview — rewrite data-href/href in CM6 DOM for native hover
        this.registerEditorExtension(
            createLivePreviewPlugin(this.app)
        );
    }

    onunload(): void {
    }
}
