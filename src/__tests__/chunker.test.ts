/**
 * Chunker Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { splitToChunks, getChunkHeader } from '../chunker';
import type { ScanResult } from '../scanner';
import { countTokens } from '../tokenizer';

const createMockResult = (path: string, content: string, language: string): ScanResult => ({
    path,
    content,
    language,
    tokenInfo: countTokens(content),
});

const mockResults: ScanResult[] = [
    createMockResult('a.ts', 'const a = 1;', 'typescript'),
    createMockResult('b.ts', 'const b = 2;', 'typescript'),
    createMockResult('c.ts', 'const c = 3;'.repeat(100), 'typescript'),
    createMockResult('d.ts', 'const d = 4;', 'typescript'),
];

describe('Chunker', () => {
    describe('splitToChunks', () => {
        test('should create single chunk for small content', () => {
            const smallResults = mockResults.slice(0, 2);
            const chunks = splitToChunks(smallResults, { maxTokensPerChunk: 10000 });

            expect(chunks.length).toBe(1);
            expect(chunks[0].files.length).toBe(2);
        });

        test('should split large content into multiple chunks', () => {
            const chunks = splitToChunks(mockResults, { maxTokensPerChunk: 50 });

            expect(chunks.length).toBeGreaterThan(1);
        });

        test('should set correct index and total', () => {
            const chunks = splitToChunks(mockResults, { maxTokensPerChunk: 50 });

            for (let i = 0; i < chunks.length; i++) {
                expect(chunks[i].index).toBe(i);
                expect(chunks[i].total).toBe(chunks.length);
            }
        });

        test('should track tokens per chunk', () => {
            const chunks = splitToChunks(mockResults, { maxTokensPerChunk: 10000 });

            expect(chunks[0].tokens).toBeGreaterThan(0);
        });
    });

    describe('getChunkHeader', () => {
        test('should format header correctly', () => {
            const chunks = splitToChunks(mockResults.slice(0, 2), { maxTokensPerChunk: 10000 });
            const header = getChunkHeader(chunks[0]);

            expect(header).toContain('Chunk 1/1');
            expect(header).toContain('files');
            expect(header).toContain('tokens');
        });
    });
});
