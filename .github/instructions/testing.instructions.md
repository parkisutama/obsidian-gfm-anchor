---
applyTo: "src/**/*.test.ts,src/**/*.spec.ts"
---

# Test File Instructions

## Testing Framework

- Use **Vitest** for all unit tests
- Only test pure logic modules (primarily `slug.ts`) — no Obsidian API mocking needed

## Test Structure

```typescript
import { describe, it, expect } from 'vitest';
```

- Use `describe` blocks to group related tests by function
- Use clear, descriptive `it` strings: `it('preserves unicode letters', ...)`
- Test edge cases: empty strings, Unicode characters, duplicate headings, special chars

## Key Test Scenarios for slug.ts

- Simple heading → lowercase-hyphenated slug
- Special characters (& ! @ #) → removed
- Unicode letters (é, ñ, ü, 日本語) → preserved
- Numbers → preserved
- Duplicate headings → `-1`, `-2` suffix convention
- Leading/trailing whitespace → trimmed
- Multiple spaces → single hyphen

## What NOT to test here

- Obsidian API interactions (reading-mode, hover, live-preview) — these are manual tested
- DOM manipulation — no JSDOM needed
- File I/O — plugin never touches files
