/**
 * Output Controller Module
 * Unified output handling for file, clipboard, and stdout
 */
import { writeFile } from 'fs/promises';
import clipboard from 'clipboardy';
import pc from 'picocolors';
import type { Chunk } from './chunker';
import { format, type FormatOptions } from './formatter';
import { getChunkHeader } from './chunker';

export interface OutputOptions {
    file?: string;
    clipboard?: boolean;
    silent?: boolean;
}

export interface ChunkOutputOptions extends OutputOptions {
    formatOptions: FormatOptions;
}

/**
 * Unified output controller for CLI
 * Handles file writing, clipboard copying, and stdout
 */
export class OutputController {
    /**
     * Write content to configured outputs
     */
    async write(content: string, options: OutputOptions): Promise<void> {
        if (options.clipboard) {
            await clipboard.write(content);
            console.log(pc.green('✓ Copied to clipboard'));
        }

        if (options.file) {
            await writeFile(options.file, content, 'utf-8');
            console.log(pc.green(`✓ Written to ${options.file}`));
        }

        if (!options.clipboard && !options.file && !options.silent) {
            console.log(pc.dim('---'));
            console.log(content);
        }
    }

    /**
     * Write multiple chunks to configured outputs
     */
    async writeChunks(chunks: Chunk[], options: ChunkOutputOptions): Promise<void> {
        console.log(pc.cyan(`\n📦 Split into ${chunks.length} chunks`));

        for (const chunk of chunks) {
            const output = getChunkHeader(chunk) + '\n\n' + format(chunk.files, options.formatOptions);

            const filename = options.file
                ? options.file.replace(/(\.\w+)?$/, `.${chunk.index + 1}$1`)
                : null;

            if (filename) {
                await writeFile(filename, output, 'utf-8');
                console.log(pc.green(`  ✓ Chunk ${chunk.index + 1}/${chunk.total}: ${filename}`));
            } else if (!options.silent) {
                console.log(pc.dim(`\n--- Chunk ${chunk.index + 1}/${chunk.total} ---`));
                console.log(output);
            }
        }

        // Copy first chunk to clipboard if requested
        if (options.clipboard && chunks.length > 0) {
            const firstOutput = getChunkHeader(chunks[0]) + '\n\n' + format(chunks[0].files, options.formatOptions);
            await clipboard.write(firstOutput);
            console.log(pc.green('\n✓ First chunk copied to clipboard'));
        }
    }
}

// Singleton instance for CLI use
export const outputController = new OutputController();
