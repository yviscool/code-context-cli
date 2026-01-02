/**
 * Budget Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { fitToBudget, getBudgetSummary } from '../budget';
import type { ScanResult } from '../scanner';
import { countTokens } from '../tokenizer';

const createMockResult = (path: string, content: string, language: string): ScanResult => ({
    path,
    content,
    language,
    tokenInfo: countTokens(content),
});

const mockResults: ScanResult[] = [
    createMockResult('small.ts', 'const x = 1;', 'typescript'),
    createMockResult('medium.ts', 'function hello() {\n  console.log("world");\n}'.repeat(10), 'typescript'),
    createMockResult('large.ts', 'const data = '.padEnd(1000, 'x'), 'typescript'),
];

describe('Budget', () => {
    describe('fitToBudget', () => {
        test('should include all files within budget', () => {
            const result = fitToBudget(mockResults, { maxTokens: 10000 });
            expect(result.included.length).toBe(3);
            expect(result.excluded.length).toBe(0);
        });

        test('should exclude files exceeding budget', () => {
            const result = fitToBudget(mockResults, { maxTokens: 50 });
            expect(result.included.length).toBeLessThan(3);
            expect(result.excluded.length).toBeGreaterThan(0);
        });

        test('should respect priority patterns', () => {
            const result = fitToBudget(mockResults, {
                maxTokens: 100,
                priorityPatterns: ['small'],
            });

            // Small.ts should be included due to priority
            const hasSmall = result.included.some(r => r.path === 'small.ts');
            expect(hasSmall).toBe(true);
        });

        test('should track token usage correctly', () => {
            const result = fitToBudget(mockResults, { maxTokens: 5000 });
            expect(result.totalTokens).toBeGreaterThan(0);
            expect(result.budgetUsed).toBe(result.totalTokens);
            expect(result.budgetRemaining).toBe(5000 - result.totalTokens);
        });
    });

    describe('getBudgetSummary', () => {
        test('should format summary correctly', () => {
            const result = fitToBudget(mockResults, { maxTokens: 10000 });
            const summary = getBudgetSummary(result, 10000);

            expect(summary).toContain('/');
            expect(summary).toContain('%');
            expect(summary).toContain('included');
        });
    });
});
