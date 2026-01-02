/**
 * Formatter Module
 * Converts scan results into AI-friendly Markdown or XML format
 */
import type { ScanResult } from './scanner';
import type { CodeSymbol } from './parser';

export interface FormatOptions {
    format: 'markdown' | 'xml';
    includeTree?: boolean;
    signaturesOnly?: boolean;
    symbols?: Map<string, CodeSymbol[]>;
    compact?: boolean;
}

/**
 * Build a directory tree structure from file paths
 */
function buildTree(paths: string[]): string {
    const tree: Record<string, any> = {};

    for (const path of paths) {
        const parts = path.split('/');
        let current = tree;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = null;
            } else {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }
    }

    function render(node: Record<string, any>, prefix = ''): string[] {
        const entries = Object.entries(node).sort(([a], [b]) => {
            const aIsDir = node[a] !== null;
            const bIsDir = node[b] !== null;
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
            return a.localeCompare(b);
        });

        const lines: string[] = [];

        for (const [name, children] of entries) {
            if (children === null) {
                lines.push(`${prefix}- ${name}`);
            } else {
                lines.push(`${prefix}- ${name}/`);
                lines.push(...render(children, prefix + '  '));
            }
        }

        return lines;
    }

    return render(tree).join('\n');
}

/**
 * Compress content by removing empty lines and comments
 */
function compactContent(content: string, language: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let prevEmpty = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines (keep max one consecutive)
        if (!trimmed) {
            if (!prevEmpty) result.push('');
            prevEmpty = true;
            continue;
        }
        prevEmpty = false;

        // Skip single-line comments for JS/TS/C-like languages
        if (['typescript', 'javascript', 'tsx', 'jsx', 'c', 'cpp', 'java', 'rust', 'go'].includes(language)) {
            if (trimmed.startsWith('//') && !trimmed.startsWith('///')) continue;
        }

        // Skip Python comments
        if (language === 'python' && trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
            continue;
        }

        result.push(line);
    }

    return result.join('\n');
}

/**
 * Format content based on options
 */
function getFileContent(result: ScanResult, options: FormatOptions): string {
    // Signatures only mode
    if (options.signaturesOnly && options.symbols) {
        const fileSymbols = options.symbols.get(result.path);
        if (fileSymbols && fileSymbols.length > 0) {
            return fileSymbols
                .map(s => `// ${s.kind}: ${s.name}\n${s.signature}`)
                .join('\n\n');
        }
    }

    let content = result.content;

    // Apply compact mode
    if (options.compact) {
        content = compactContent(content, result.language);
    }

    return content;
}

/**
 * Format results as Markdown with XML file tags
 */
function formatMarkdown(results: ScanResult[], options: FormatOptions): string {
    const { includeTree = true, signaturesOnly = false } = options;
    const lines: string[] = ['# Project Context', ''];

    if (signaturesOnly) {
        lines.push('> **Note**: Signatures only mode - implementations omitted');
        lines.push('');
    }

    if (includeTree && results.length > 0) {
        lines.push('## Structure');
        lines.push(buildTree(results.map(r => r.path)));
        lines.push('');
        lines.push('---');
        lines.push('');
    }

    for (const result of results) {
        const content = getFileContent(result, options);
        lines.push(`<file path="${result.path}" language="${result.language}">`);
        lines.push(content);
        lines.push('</file>');
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Format results as pure XML
 */
function formatXml(results: ScanResult[], options: FormatOptions): string {
    const { includeTree = true, signaturesOnly = false } = options;
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<context>'];

    if (signaturesOnly) {
        lines.push('  <note>Signatures only mode - implementations omitted</note>');
    }

    if (includeTree && results.length > 0) {
        lines.push('  <structure>');
        const treeLines = buildTree(results.map(r => r.path)).split('\n');
        for (const line of treeLines) {
            lines.push(`    ${line}`);
        }
        lines.push('  </structure>');
    }

    lines.push('  <files>');

    for (const result of results) {
        const content = getFileContent(result, options);
        lines.push(`    <file path="${result.path}" language="${result.language}">`);
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        lines.push(escapedContent);
        lines.push('    </file>');
    }

    lines.push('  </files>');
    lines.push('</context>');

    return lines.join('\n');
}

/**
 * Format scan results into AI-friendly output
 */
export function format(results: ScanResult[], options: FormatOptions): string {
    const { format: outputFormat } = options;

    if (outputFormat === 'xml') {
        return formatXml(results, options);
    }

    return formatMarkdown(results, options);
}
