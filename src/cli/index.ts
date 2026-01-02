#!/usr/bin/env bun
/**
 * ctx - CLI Entry Point
 * Weave your codebase into AI-ready context
 */
import cac from 'cac';
import pc from 'picocolors';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { scan } from '../scanner';
import { format } from '../formatter';
import { formatTokens, parseBudget, MODEL_LIMITS } from '../tokenizer';
import { fitToBudget, getBudgetSummary } from '../budget';
import { splitToChunks } from '../chunker';
import { parseSymbols, getSymbolSummary, type CodeSymbol } from '../parser';
import { outputController } from '../output';

const cli = cac('ctx');

const DEFAULT_EXTENSIONS = 'ts,js,tsx,jsx,py,rs,go,java,c,cpp,h,hpp,css,html,json,yaml,yml,md,sh,sql,vue,svelte';

cli
    .command('[dir]', 'Scan directory and generate AI-ready context')
    .option('-e, --ext <extensions>', 'File extensions to include (comma-separated)', {
        default: DEFAULT_EXTENSIONS,
    })
    .option('-i, --ignore <patterns>', 'Patterns to ignore (comma-separated)')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .option('-f, --format <type>', 'Output format: markdown or xml', { default: 'markdown' })
    .option('--no-tree', 'Exclude directory tree from output')
    .option('-c, --copy', 'Copy output to clipboard')
    .option('--interactive', 'Launch interactive TUI mode')
    .option('-b, --budget <tokens>', 'Token budget limit (e.g., 32k, 128000)')
    .option('--chunk <tokens>', 'Split output into chunks of max tokens')
    .option('-m, --model <name>', 'Model for token limit reference', { default: 'gpt-4o' })
    .option('--priority <patterns>', 'Priority file patterns (comma-separated)')
    .option('-s, --symbols', 'Show symbol statistics for each file')
    .option('--signatures-only', 'Export only function/class signatures, not implementations')
    .option('--no-test', 'Exclude test files (*.test.*, *.spec.*, __tests__)')
    .option('--stats', 'Show detailed statistics (files, languages, tokens)')
    .option('--compact', 'Compress output by removing comments and empty lines')
    .action(async (dir: string | undefined, options) => {
        const cwd = resolve(dir || '.');

        const extensions = (options.ext as string).split(',').map(e => e.trim());
        const patterns = extensions.map(ext => `**/*.${ext}`);

        let ignore = options.ignore
            ? (options.ignore as string).split(',').map(p => p.trim())
            : [];

        // Add test file patterns if --no-test is specified
        if (options.test === false) {
            ignore = [...ignore, '**/*.test.*', '**/*.spec.*', '**/__tests__/**'];
        }

        // Interactive mode
        if (options.interactive) {
            const { launchTUI } = await import('../tui/App');
            const output = await launchTUI({
                cwd,
                patterns,
                ignore,
                copyToClipboard: options.copy,
            });

            if (options.output) {
                await writeFile(options.output, output, 'utf-8');
                console.log(pc.green(`\n✓ Written to ${options.output}`));
            } else if (!options.copy) {
                console.log('\n' + output);
            }
            return;
        }

        // Non-interactive mode
        console.log(pc.cyan('📂 Scanning:'), cwd);
        console.log(pc.dim(`   Patterns: ${patterns.slice(0, 5).join(', ')}${patterns.length > 5 ? '...' : ''}`));
        if (ignore.length > 0) {
            console.log(pc.dim(`   Ignoring: ${ignore.join(', ')}`));
        }

        try {
            let results = await scan({ cwd, patterns, ignore });

            console.log(pc.green(`✓ Found ${results.length} files`));

            // Parse symbols if needed
            const symbolsMap = new Map<string, CodeSymbol[]>();

            if (options.symbols || options.signaturesOnly) {
                console.log(pc.dim('  Parsing symbols...'));

                for (const result of results) {
                    if (['typescript', 'javascript', 'tsx', 'jsx'].includes(result.language)) {
                        const symbols = await parseSymbols(result.content, result.language);
                        symbolsMap.set(result.path, symbols);

                        if (options.symbols) {
                            console.log(pc.dim(`    ${result.path}: ${getSymbolSummary(symbols)}`));
                        }
                    }
                }
            }

            // Calculate total tokens from preloaded tokenInfo
            const totalTokens = results.reduce((sum, r) => sum + r.tokenInfo.tokens, 0);
            console.log(pc.dim(`  Total tokens: ${formatTokens(totalTokens)}`));

            // Show detailed stats if requested
            if (options.stats) {
                const langStats: Record<string, { files: number; tokens: number }> = {};
                for (const r of results) {
                    if (!langStats[r.language]) {
                        langStats[r.language] = { files: 0, tokens: 0 };
                    }
                    langStats[r.language].files++;
                    langStats[r.language].tokens += r.tokenInfo.tokens;
                }

                console.log(pc.cyan('\n📊 Statistics:'));
                console.log(pc.dim(`   Total files: ${results.length}`));
                console.log(pc.dim(`   Total tokens: ${formatTokens(totalTokens)}`));
                console.log(pc.dim(`   Languages:`));
                for (const [lang, stat] of Object.entries(langStats).sort((a, b) => b[1].tokens - a[1].tokens)) {
                    console.log(pc.dim(`     - ${lang}: ${stat.files} files, ${formatTokens(stat.tokens)} tokens`));
                }
            }

            // Apply budget if specified
            if (options.budget) {
                const maxTokens = parseBudget(options.budget as string);
                const priorityPatterns = options.priority
                    ? (options.priority as string).split(',').map(p => p.trim())
                    : [];

                const budgetResult = fitToBudget(results, {
                    maxTokens,
                    priorityPatterns,
                    reserveTokens: 1000,
                });

                results = budgetResult.included;
                console.log(pc.yellow(`  Budget: ${getBudgetSummary(budgetResult, maxTokens)}`));

                if (budgetResult.excluded.length > 0) {
                    console.log(pc.dim(`  Excluded: ${budgetResult.excluded.slice(0, 3).map(f => f.path).join(', ')}${budgetResult.excluded.length > 3 ? '...' : ''}`));
                }
            }

            // Chunking mode
            if (options.chunk) {
                const maxTokensPerChunk = parseBudget(options.chunk as string);
                const chunks = splitToChunks(results, { maxTokensPerChunk });

                await outputController.writeChunks(chunks, {
                    file: options.output,
                    clipboard: options.copy,
                    formatOptions: {
                        format: options.format as 'markdown' | 'xml',
                        includeTree: options.tree !== false,
                        signaturesOnly: options.signaturesOnly,
                        symbols: symbolsMap,
                        compact: options.compact,
                    },
                });

                return;
            }

            // Normal output
            const output = format(results, {
                format: options.format as 'markdown' | 'xml',
                includeTree: options.tree !== false,
                signaturesOnly: options.signaturesOnly,
                symbols: symbolsMap,
                compact: options.compact,
            });

            await outputController.write(output, {
                file: options.output,
                clipboard: options.copy,
            });
        } catch (err) {
            console.error(pc.red('Error:'), err);
            process.exit(1);
        }
    });

cli.help();
cli.version('1.5.0');

cli.parse();
