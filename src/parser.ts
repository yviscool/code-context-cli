/**
 * AST Parser Module
 * Extract code symbols with Regex (Tree-sitter optional)
 */
import { countTokens } from './tokenizer';
import { getPatternsForLanguage } from './patterns';

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'method' | 'variable' | 'export';

export interface CodeSymbol {
    name: string;
    kind: SymbolKind;
    startLine: number;
    endLine: number;
    signature: string;
    content: string;
    tokens: number;
}

// Tree-sitter availability flag
let treeSitterAvailable: boolean | null = null;
let Parser: any = null;
let TypeScript: any = null;
let JavaScript: any = null;

/**
 * Try to load Tree-sitter (lazy, once)
 */
async function tryLoadTreeSitter(): Promise<boolean> {
    if (treeSitterAvailable !== null) return treeSitterAvailable;

    try {
        Parser = (await import('tree-sitter')).default;
        TypeScript = (await import('tree-sitter-typescript')).default;
        JavaScript = (await import('tree-sitter-javascript')).default;
        treeSitterAvailable = true;
    } catch {
        treeSitterAvailable = false;
    }
    return treeSitterAvailable;
}

/**
 * Extract signature from content
 */
function extractSignature(content: string): string {
    const lines = content.split('\n');
    const firstLine = lines[0];

    const braceIndex = firstLine.indexOf('{');
    if (braceIndex > 0) {
        return firstLine.substring(0, braceIndex).trim();
    }

    let sig = '';
    for (const line of lines) {
        sig += line.trim() + ' ';
        if (line.includes('{') || line.includes('=>')) break;
    }

    return sig.replace(/\s*\{.*$/, '').replace(/\s*=>.*$/, ' =>').trim();
}

/**
 * Parse with Tree-sitter
 */
function parseWithTreeSitter(content: string, language: string): CodeSymbol[] {
    const parser = new Parser();
    const isTS = ['typescript', 'tsx'].includes(language);
    parser.setLanguage(isTS ? TypeScript.typescript : JavaScript);

    const tree = parser.parse(content);
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    function visit(node: any) {
        let kind: SymbolKind | null = null;
        let name: string | null = null;

        switch (node.type) {
            case 'function_declaration':
                kind = 'function';
                name = node.childForFieldName('name')?.text || null;
                break;
            case 'arrow_function':
                if (node.parent?.type === 'variable_declarator') {
                    kind = 'function';
                    name = node.parent.childForFieldName('name')?.text || null;
                }
                break;
            case 'class_declaration':
                kind = 'class';
                name = node.childForFieldName('name')?.text || null;
                break;
            case 'interface_declaration':
                kind = 'interface';
                name = node.childForFieldName('name')?.text || null;
                break;
            case 'type_alias_declaration':
                kind = 'type';
                name = node.childForFieldName('name')?.text || null;
                break;
            case 'method_definition':
                kind = 'method';
                name = node.childForFieldName('name')?.text || null;
                break;
        }

        if (kind && name) {
            const startLine = node.startPosition.row + 1;
            const endLine = node.endPosition.row + 1;
            const blockContent = lines.slice(startLine - 1, endLine).join('\n');

            symbols.push({
                name,
                kind,
                startLine,
                endLine,
                signature: extractSignature(blockContent),
                content: blockContent,
                tokens: countTokens(blockContent).tokens,
            });
        }

        for (const child of node.children) {
            visit(child);
        }
    }

    visit(tree.rootNode);
    return symbols;
}

/**
 * Parse with Regex (fallback)
 */
function parseWithRegex(content: string, language: string): CodeSymbol[] {
    const patterns = getPatternsForLanguage(language);
    if (patterns.length === 0) return [];

    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');
    const processedLines = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
        if (processedLines.has(i)) continue;
        const line = lines[i].trim();
        if (!line || line.startsWith('//')) continue;

        for (const { regex, kind } of patterns) {
            const match = line.match(regex);
            if (match) {
                let endLine = i;
                let braceCount = 0;
                let started = false;

                for (let j = i; j < lines.length; j++) {
                    for (const char of lines[j]) {
                        if (char === '{') { braceCount++; started = true; }
                        if (char === '}') braceCount--;
                    }
                    if (started && braceCount === 0) { endLine = j; break; }
                    if (!started && lines[j].includes(';')) { endLine = j; break; }
                }

                const blockContent = lines.slice(i, endLine + 1).join('\n');
                for (let k = i; k <= endLine; k++) processedLines.add(k);

                symbols.push({
                    name: match[1],
                    kind,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: extractSignature(blockContent),
                    content: blockContent,
                    tokens: countTokens(blockContent).tokens,
                });
                break;
            }
        }
    }

    return symbols;
}

/**
 * Parse code and extract symbols
 */
export async function parseSymbols(content: string, language: string): Promise<CodeSymbol[]> {
    if (!['typescript', 'javascript', 'tsx', 'jsx'].includes(language)) {
        return [];
    }

    // Try Tree-sitter first
    const hasTreeSitter = await tryLoadTreeSitter();

    if (hasTreeSitter) {
        try {
            return parseWithTreeSitter(content, language);
        } catch {
            // Fallback to regex
        }
    }

    return parseWithRegex(content, language);
}

/**
 * Get symbol summary
 */
export function getSymbolSummary(symbols: CodeSymbol[]): string {
    const counts: Record<string, number> = {};
    let totalTokens = 0;

    for (const sym of symbols) {
        counts[sym.kind] = (counts[sym.kind] || 0) + 1;
        totalTokens += sym.tokens;
    }

    const parts: string[] = [];
    if (counts.function) parts.push(`${counts.function} fn`);
    if (counts.class) parts.push(`${counts.class} class`);
    if (counts.interface) parts.push(`${counts.interface} iface`);
    if (counts.type) parts.push(`${counts.type} type`);

    return parts.length > 0
        ? `${parts.join(', ')} | ${totalTokens} tok`
        : `${totalTokens} tok`;
}
