import { describe, it, expect } from 'vitest';
import { toGFMSlug, isGFMSlug, buildSlugMap } from './slug';

describe('toGFMSlug', () => {
    it('normalizes simple heading to lowercase-hyphenated', () => {
        expect(toGFMSlug('Hello World')).toBe('hello-world');
    });

    it('removes ampersand and preserves resulting double hyphen', () => {
        expect(toGFMSlug('Glosarium & Kode Sistem')).toBe('glosarium--kode-sistem');
    });

    it('preserves unicode letters', () => {
        expect(toGFMSlug('Héllo Wörld')).toBe('héllo-wörld');
    });

    it('preserves numbers', () => {
        expect(toGFMSlug('Section 123')).toBe('section-123');
    });

    it('removes special characters (! @ # $ %)', () => {
        expect(toGFMSlug('Hello! @World #Test')).toBe('hello-world-test');
    });

    it('trims leading and trailing whitespace', () => {
        expect(toGFMSlug('  spaced heading  ')).toBe('spaced-heading');
    });

    it('replaces each space individually (no collapse)', () => {
        expect(toGFMSlug('multiple   spaces   here')).toBe('multiple---spaces---here');
    });

    it('handles empty string', () => {
        expect(toGFMSlug('')).toBe('');
    });

    it('handles heading with only special characters', () => {
        expect(toGFMSlug('!@#$%^&*()')).toBe('');
    });

    it('preserves hyphens in heading', () => {
        expect(toGFMSlug('already-hyphenated')).toBe('already-hyphenated');
    });

    it('handles Japanese characters', () => {
        expect(toGFMSlug('日本語テスト')).toBe('日本語テスト');
    });

    it('handles mixed ASCII and Unicode', () => {
        expect(toGFMSlug('Café au lait')).toBe('café-au-lait');
    });

    it('handles parentheses and brackets', () => {
        expect(toGFMSlug('Section (Advanced)')).toBe('section-advanced');
    });

    it('handles backticks in code headings', () => {
        expect(toGFMSlug('Using `code` blocks')).toBe('using-code-blocks');
    });
});

describe('isGFMSlug', () => {
    it('detects valid GFM slug', () => {
        expect(isGFMSlug('hello-world')).toBe(true);
    });

    it('detects GFM slug with numbers', () => {
        expect(isGFMSlug('section-123')).toBe(true);
    });

    it('detects GFM slug with unicode lowercase', () => {
        expect(isGFMSlug('héllo-wörld')).toBe(true);
    });

    it('rejects OFM URL-encoded slug', () => {
        expect(isGFMSlug('Glosarium%20%26%20Kode%20Sistem')).toBe(false);
    });

    it('rejects OFM preserve-case slug', () => {
        expect(isGFMSlug('Hello World')).toBe(false);
    });

    it('rejects slug with uppercase letters', () => {
        expect(isGFMSlug('Hello-world')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isGFMSlug('')).toBe(false);
    });

    it('detects slug with double hyphen', () => {
        expect(isGFMSlug('glosarium--kode-sistem')).toBe(true);
    });

    it('rejects slug with percent encoding', () => {
        expect(isGFMSlug('OFM%20Format')).toBe(false);
    });
});

describe('buildSlugMap', () => {
    const pos = { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } };

    it('maps unique headings correctly', () => {
        const headings = [
            { heading: 'Hello World', level: 2, position: pos },
            { heading: 'Another Section', level: 2, position: pos },
        ];
        const map = buildSlugMap(headings);
        expect(map.get('hello-world')).toBe('Hello World');
        expect(map.get('another-section')).toBe('Another Section');
    });

    it('handles duplicate headings with numeric suffix', () => {
        const headings = [
            { heading: 'Section', level: 2, position: pos },
            { heading: 'Section', level: 2, position: pos },
            { heading: 'Section', level: 2, position: pos },
        ];
        const map = buildSlugMap(headings);
        expect(map.get('section')).toBe('Section');
        expect(map.get('section-1')).toBe('Section');
        expect(map.get('section-2')).toBe('Section');
    });

    it('handles empty heading list', () => {
        const map = buildSlugMap([]);
        expect(map.size).toBe(0);
    });

    it('handles headings with special characters', () => {
        const headings = [
            { heading: 'Glosarium & Kode Sistem', level: 2, position: pos },
        ];
        const map = buildSlugMap(headings);
        expect(map.get('glosarium--kode-sistem')).toBe('Glosarium & Kode Sistem');
    });

    it('handles mixed unicode headings', () => {
        const headings = [
            { heading: 'Café au lait', level: 2, position: pos },
            { heading: '日本語テスト', level: 3, position: pos },
        ];
        const map = buildSlugMap(headings);
        expect(map.get('café-au-lait')).toBe('Café au lait');
        expect(map.get('日本語テスト')).toBe('日本語テスト');
    });
});
