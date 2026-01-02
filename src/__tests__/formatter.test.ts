/**
 * Formatter Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { format } from '../formatter';
import type { ScanResult } from '../scanner';

const mockResults: ScanResult[] = [
    { path: 'src/main.ts', content: 'console.log("hello");', language: 'typescript' },
    { path: 'src/utils.ts', content: 'export const add = (a, b) => a + b;', language: 'typescript' },
];

describe('Formatter', () => {
    describe('markdown format', () => {
        test('should include header', () => {
            const output = format(mockResults, { format: 'markdown' });
            expect(output).toContain('# Project Context');
        });

        test('should include directory tree by default', () => {
            const output = format(mockResults, { format: 'markdown' });
            expect(output).toContain('## Structure');
            expect(output).toContain('- src/');
            expect(output).toContain('- main.ts');
        });

        test('should exclude tree when includeTree is false', () => {
            const output = format(mockResults, { format: 'markdown', includeTree: false });
            expect(output).not.toContain('## Structure');
        });

        test('should wrap files in XML tags', () => {
            const output = format(mockResults, { format: 'markdown' });
            expect(output).toContain('<file path="src/main.ts" language="typescript">');
            expect(output).toContain('console.log("hello");');
            expect(output).toContain('</file>');
        });
    });

    describe('xml format', () => {
        test('should include XML declaration', () => {
            const output = format(mockResults, { format: 'xml' });
            expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        });

        test('should wrap in context element', () => {
            const output = format(mockResults, { format: 'xml' });
            expect(output).toContain('<context>');
            expect(output).toContain('</context>');
        });

        test('should escape special XML characters', () => {
            const resultsWithSpecialChars: ScanResult[] = [
                { path: 'test.ts', content: 'a < b && c > d', language: 'typescript' },
            ];

            const output = format(resultsWithSpecialChars, { format: 'xml' });
            expect(output).toContain('&lt;');
            expect(output).toContain('&amp;');
            expect(output).toContain('&gt;');
        });
    });
});
