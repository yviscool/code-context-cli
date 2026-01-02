/**
 * Parser Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { parseSymbols, getSymbolSummary } from '../parser';

const sampleTS = `
export function add(a: number, b: number): number {
  return a + b;
}

const subtract = (a: number, b: number) => a - b;

export class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}

interface Operation {
  name: string;
  execute: (a: number, b: number) => number;
}

type NumberPair = [number, number];
`;

describe('Parser', () => {
    describe('parseSymbols', () => {
        test('should parse function declarations', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const funcs = symbols.filter(s => s.kind === 'function');

            expect(funcs.length).toBeGreaterThanOrEqual(1);
            expect(funcs.some(f => f.name === 'add')).toBe(true);
        });

        test('should parse class declarations', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const classes = symbols.filter(s => s.kind === 'class');

            expect(classes.length).toBeGreaterThanOrEqual(1);
            expect(classes.some(c => c.name === 'Calculator')).toBe(true);
        });

        test('should parse interface declarations', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const interfaces = symbols.filter(s => s.kind === 'interface');

            expect(interfaces.length).toBeGreaterThanOrEqual(1);
            expect(interfaces.some(i => i.name === 'Operation')).toBe(true);
        });

        test('should parse type declarations', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const types = symbols.filter(s => s.kind === 'type');

            expect(types.length).toBeGreaterThanOrEqual(1);
            expect(types.some(t => t.name === 'NumberPair')).toBe(true);
        });

        test('should extract signatures', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const addFunc = symbols.find(s => s.name === 'add');

            expect(addFunc).toBeDefined();
            expect(addFunc!.signature).toContain('function add');
            expect(addFunc!.signature).toContain('number');
        });

        test('should count tokens', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');

            for (const sym of symbols) {
                expect(sym.tokens).toBeGreaterThan(0);
            }
        });

        test('should handle empty content', async () => {
            const symbols = await parseSymbols('', 'typescript');
            expect(symbols.length).toBe(0);
        });
    });

    describe('getSymbolSummary', () => {
        test('should format summary', async () => {
            const symbols = await parseSymbols(sampleTS, 'typescript');
            const summary = getSymbolSummary(symbols);

            expect(summary).toContain('fn');
            expect(summary).toContain('tok');
        });
    });
});
