import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { parseFragment, resolveSlug } from './resolver';

/**
 * Creates a MarkdownPostProcessor that rewrites GFM anchor hrefs
 * in Reading Mode DOM so Obsidian's native hover and click work.
 *
 * Click navigation is handled by the global click handler in main.ts.
 * This post-processor only rewrites data-href/href for Page Preview.
 */
export function registerReadingModePostProcessor(app: App): (
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
) => void {
    return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const anchors = el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');

        for (const anchor of anchors) {
            const href = anchor.getAttribute('href');
            if (!href) continue;

            const fragment = parseFragment(href);
            if (!fragment) continue;

            const file = app.vault.getFileByPath(ctx.sourcePath);
            if (!file) continue;

            const heading = resolveSlug(fragment, file, app);
            if (!heading) continue;

            anchor.dataset['gfmSlug'] = fragment;
            anchor.setAttribute('href', `#${heading}`);
            anchor.setAttribute('data-href', `#${heading}`);
        }
    };
}
