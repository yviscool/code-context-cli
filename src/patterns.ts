/**
 * Pattern Definitions Module
 * Regex patterns for code symbol extraction, separated from parsing logic
 */
import type { SymbolKind } from './parser';

export interface PatternConfig {
    regex: RegExp;
    kind: SymbolKind;
}

/**
 * JavaScript/TypeScript patterns for symbol extraction
 */
export const JAVASCRIPT_PATTERNS: PatternConfig[] = [
    // Function declarations: function foo(), async function bar()
    {
        regex: /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)/,
        kind: 'function'
    },
    // Arrow functions: const foo = () => {}, const bar = async (x) => {}
    {
        regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?::\s*[^=]+)?\s*=>/,
        kind: 'function'
    },
    // Class declarations: class Foo {}, abstract class Bar {}
    {
        regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
        kind: 'class'
    },
    // Interface declarations: interface IFoo {}
    {
        regex: /^(?:export\s+)?interface\s+(\w+)/,
        kind: 'interface'
    },
    // Type aliases: type Foo = ...
    {
        regex: /^(?:export\s+)?type\s+(\w+)/,
        kind: 'type'
    },
];

/**
 * Language to pattern mapping
 * Allows easy extension for new languages
 */
export const LANGUAGE_PATTERNS: Record<string, PatternConfig[]> = {
    typescript: JAVASCRIPT_PATTERNS,
    javascript: JAVASCRIPT_PATTERNS,
    tsx: JAVASCRIPT_PATTERNS,
    jsx: JAVASCRIPT_PATTERNS,
};

/**
 * Get patterns for a specific language
 */
export function getPatternsForLanguage(language: string): PatternConfig[] {
    return LANGUAGE_PATTERNS[language] || [];
}
