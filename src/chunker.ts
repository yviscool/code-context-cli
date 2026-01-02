/**
 * Chunker Module
 * Split large content into manageable chunks
 */
import type { ScanResult } from './scanner';
import { formatTokens } from './tokenizer';

export interface Chunk {
    index: number;
    total: number;
    files: ScanResult[];
    tokens: number;
}

export interface ChunkOptions {
    maxTokensPerChunk: number;
    overlap?: number; // Files to repeat at chunk boundaries
}

/**
 * Split files into chunks that fit within token limits
 */
export function splitToChunks(results: ScanResult[], options: ChunkOptions): Chunk[] {
    const { maxTokensPerChunk, overlap = 0 } = options;

    const filesWithTokens = results.map(result => ({
        result,
        tokens: result.tokenInfo.tokens,
    }));

    const chunks: Chunk[] = [];
    let currentChunk: ScanResult[] = [];
    let currentTokens = 0;

    for (const { result, tokens } of filesWithTokens) {
        // If single file exceeds limit, put it in its own chunk
        if (tokens > maxTokensPerChunk) {
            // Save current chunk if not empty
            if (currentChunk.length > 0) {
                chunks.push({
                    index: chunks.length,
                    total: 0, // Will be updated later
                    files: currentChunk,
                    tokens: currentTokens,
                });
                currentChunk = [];
                currentTokens = 0;
            }

            // Add oversized file as its own chunk
            chunks.push({
                index: chunks.length,
                total: 0,
                files: [result],
                tokens,
            });
            continue;
        }

        // Check if file fits in current chunk
        if (currentTokens + tokens <= maxTokensPerChunk) {
            currentChunk.push(result);
            currentTokens += tokens;
        } else {
            // Save current chunk and start new one
            if (currentChunk.length > 0) {
                chunks.push({
                    index: chunks.length,
                    total: 0,
                    files: currentChunk,
                    tokens: currentTokens,
                });
            }

            // Start new chunk with overlap
            const overlapFiles = overlap > 0
                ? currentChunk.slice(-overlap)
                : [];
            const overlapTokens = overlapFiles.reduce(
                (sum, f) => sum + f.tokenInfo.tokens,
                0
            );

            currentChunk = [...overlapFiles, result];
            currentTokens = overlapTokens + tokens;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
        chunks.push({
            index: chunks.length,
            total: 0,
            files: currentChunk,
            tokens: currentTokens,
        });
    }

    // Update total count
    const total = chunks.length;
    for (const chunk of chunks) {
        chunk.total = total;
    }

    return chunks;
}

/**
 * Get chunk header for output
 */
export function getChunkHeader(chunk: Chunk): string {
    return `<!-- Chunk ${chunk.index + 1}/${chunk.total} | ${chunk.files.length} files | ${formatTokens(chunk.tokens)} tokens -->`;
}
