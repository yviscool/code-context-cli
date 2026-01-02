/**
 * Chunker Module Tests
 */
import { describe, test, expect } from 'bun:test';
import { splitToChunks, getChunkHeader } from '../chunker';
import type { ScanResult } from '../scanner';

const mockResults: ScanResult[] = [
    { path: 'a.ts', content: 'const a = 1;', language: 'typescript' },
    { path: 'b.ts', content: 'const b = 2;', language: 'typescript' },
    { path: 'c.ts', content: 'const c = 3;'.repeat(100), language: 'typescript' },
    { path: 'd.ts', content: 'const d = 4;', language: 'typescript' },
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
