/**
 * Token Counter Module
 * Precise token counting using gpt-tokenizer
 */
import { encode, encodeChat } from 'gpt-tokenizer';

export interface TokenInfo {
    chars: number;
    lines: number;
    tokens: number;
}

/**
 * Model token limits
 */
export const MODEL_LIMITS: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
};

/**
 * Count tokens precisely using gpt-tokenizer
 */
export function countTokens(content: string): TokenInfo {
    const chars = content.length;
    const lines = content.split('\n').length;
    const tokens = encode(content).length;

    return { chars, lines, tokens };
}

/**
 * Estimate token count (fast, less accurate)
 * Used for real-time preview where speed matters
 */
export function estimateTokens(content: string): number {
    // CJK characters: ~1.5 chars per token
    // Other: ~4 chars per token
    const cjkChars = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const nonCjkChars = content.length - cjkChars;
    return Math.ceil(cjkChars / 1.5 + nonCjkChars / 4);
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
    if (tokens < 1000) {
        return `${tokens}`;
    }
    return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * Parse token budget string (e.g., "32k", "128000")
 */
export function parseBudget(budget: string): number {
    const match = budget.toLowerCase().match(/^(\d+(?:\.\d+)?)(k)?$/);
    if (!match) {
        throw new Error(`Invalid budget format: ${budget}`);
    }
    const value = parseFloat(match[1]);
    return match[2] ? Math.floor(value * 1000) : Math.floor(value);
}

/**
 * Get token budget status color
 */
export function getTokenColor(tokens: number, limit = 128000): 'green' | 'yellow' | 'red' {
    const ratio = tokens / limit;
    if (ratio < 0.5) return 'green';
    if (ratio < 0.8) return 'yellow';
    return 'red';
}
