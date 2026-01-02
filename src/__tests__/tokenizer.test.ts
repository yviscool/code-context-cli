/**
 * Tokenizer Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { countTokens, estimateTokens, formatTokens, parseBudget, getTokenColor } from '../tokenizer';

describe('Tokenizer', () => {
    describe('countTokens (precise)', () => {
        test('should count English text precisely', () => {
            const result = countTokens('Hello World');
            expect(result.chars).toBe(11);
            expect(result.tokens).toBeGreaterThan(0);
            expect(result.tokens).toBeLessThan(10); // Should be around 2-3 tokens
        });

        test('should count lines correctly', () => {
            const result = countTokens('line1\nline2\nline3');
            expect(result.lines).toBe(3);
        });

        test('should handle empty string', () => {
            const result = countTokens('');
            expect(result.chars).toBe(0);
            expect(result.tokens).toBe(0);
        });

        test('should handle code content', () => {
            const code = `function hello() {\n  console.log("world");\n}`;
            const result = countTokens(code);
            expect(result.tokens).toBeGreaterThan(5);
            expect(result.tokens).toBeLessThan(30);
        });
    });

    describe('estimateTokens (fast)', () => {
        test('should estimate English text', () => {
            const estimate = estimateTokens('Hello World');
            expect(estimate).toBeGreaterThan(0);
        });

        test('should handle CJK characters', () => {
            const englishEstimate = estimateTokens('hello');
            const chineseEstimate = estimateTokens('你好世界');

            // CJK should have higher token density per character
            expect(chineseEstimate / 4).toBeGreaterThan(englishEstimate / 5);
        });
    });

    describe('formatTokens', () => {
        test('should format small numbers', () => {
            expect(formatTokens(500)).toBe('500');
        });

        test('should format thousands with k suffix', () => {
            expect(formatTokens(1500)).toBe('1.5k');
            expect(formatTokens(10000)).toBe('10.0k');
        });
    });

    describe('parseBudget', () => {
        test('should parse plain numbers', () => {
            expect(parseBudget('1000')).toBe(1000);
        });

        test('should parse k suffix', () => {
            expect(parseBudget('32k')).toBe(32000);
            expect(parseBudget('128K')).toBe(128000);
        });

        test('should parse decimal k', () => {
            expect(parseBudget('1.5k')).toBe(1500);
        });

        test('should throw on invalid format', () => {
            expect(() => parseBudget('abc')).toThrow();
        });
    });

    describe('getTokenColor', () => {
        test('should return green for low usage', () => {
            expect(getTokenColor(10000, 128000)).toBe('green');
        });

        test('should return yellow for medium usage', () => {
            expect(getTokenColor(80000, 128000)).toBe('yellow');
        });

        test('should return red for high usage', () => {
            expect(getTokenColor(110000, 128000)).toBe('red');
        });
    });
});
