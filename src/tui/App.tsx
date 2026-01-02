/**
 * TUI App - Interactive File Selection
 */
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { scan, type ScanResult } from '../scanner';
import { format } from '../formatter';
import { countTokens, formatTokens, getTokenColor } from '../tokenizer';
import clipboard from 'clipboardy';

interface FileNode {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileNode[];
    result?: ScanResult;
    tokens?: number;
    selected: boolean;
    expanded: boolean;
}

interface AppProps {
    cwd: string;
    patterns: string[];
    ignore: string[];
    onComplete: (output: string) => void;
}

/**
 * Build tree structure from scan results
 */
function buildFileTree(results: ScanResult[]): FileNode[] {
    const root: Record<string, any> = {};

    for (const result of results) {
        const parts = result.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = { result, tokens: countTokens(result.content).tokens };
            } else {
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        }
    }

    function toNodes(obj: Record<string, any>, parentPath = ''): FileNode[] {
        return Object.entries(obj)
            .map(([name, value]) => {
                const path = parentPath ? `${parentPath}/${name}` : name;
                if (value.result) {
                    return {
                        name,
                        path,
                        isDir: false,
                        result: value.result,
                        tokens: value.tokens,
                        selected: false,
                        expanded: false,
                    };
                }
                return {
                    name,
                    path,
                    isDir: true,
                    children: toNodes(value, path),
                    selected: false,
                    expanded: true,
                };
            })
            .sort((a, b) => {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
    }

    return toNodes(root);
}

/**
 * Flatten tree for navigation
 */
function flattenTree(nodes: FileNode[], depth = 0): Array<{ node: FileNode; depth: number }> {
    const result: Array<{ node: FileNode; depth: number }> = [];

    for (const node of nodes) {
        result.push({ node, depth });
        if (node.isDir && node.expanded && node.children) {
            result.push(...flattenTree(node.children, depth + 1));
        }
    }

    return result;
}

/**
 * File Tree Item Component
 */
function TreeItem({ node, depth, isActive, filter }: {
    node: FileNode;
    depth: number;
    isActive: boolean;
    filter: string;
}) {
    const indent = '  '.repeat(depth);
    const icon = node.isDir
        ? (node.expanded ? '📂' : '📁')
        : '📄';
    const checkbox = node.selected ? '[✓]' : '[ ]';
    const tokenBadge = node.tokens
        ? ` (${formatTokens(node.tokens)} tok)`
        : '';

    // Highlight matching text
    const nameColor = filter && node.name.toLowerCase().includes(filter.toLowerCase())
        ? 'cyan'
        : undefined;

    return (
        <Box>
            <Text color={isActive ? 'blue' : undefined} bold={isActive}>
                {indent}
            </Text>
            <Text color={isActive ? 'blue' : 'gray'}>
                {checkbox}{' '}
            </Text>
            <Text>{icon} </Text>
            <Text color={nameColor} bold={isActive}>
                {node.name}
                {node.isDir && '/'}
            </Text>
            <Text color="gray" dimColor>
                {tokenBadge}
            </Text>
        </Box>
    );
}

/**
 * Main App Component
 */
function App({ cwd, patterns, ignore, onComplete }: AppProps) {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<FileNode[]>([]);
    const [cursor, setCursor] = useState(0);
    const [filter, setFilter] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ScanResult[]>([]);

    // Load files
    useEffect(() => {
        scan({ cwd, patterns, ignore }).then(scanResults => {
            setResults(scanResults);
            setTree(buildFileTree(scanResults));
            setLoading(false);
        });
    }, [cwd, patterns, ignore]);

    // Flatten and filter tree
    const flatList = useMemo(() => {
        const flat = flattenTree(tree);
        if (!filter) return flat;
        return flat.filter(({ node }) =>
            node.path.toLowerCase().includes(filter.toLowerCase())
        );
    }, [tree, filter]);

    // Calculate selected tokens
    const { selectedCount, totalTokens } = useMemo(() => {
        let count = 0;
        let tokens = 0;

        function traverse(nodes: FileNode[]) {
            for (const node of nodes) {
                if (node.selected && !node.isDir && node.tokens) {
                    count++;
                    tokens += node.tokens;
                }
                if (node.children) traverse(node.children);
            }
        }
        traverse(tree);

        return { selectedCount: count, totalTokens: tokens };
    }, [tree]);

    // Handle keyboard input
    useInput((input, key) => {
        if (isSearching) {
            if (key.escape || key.return) {
                setIsSearching(false);
            }
            return;
        }

        if (input === '/') {
            setIsSearching(true);
            return;
        }

        if (input === 'q' || key.escape) {
            exit();
            return;
        }

        if (key.upArrow || input === 'k') {
            setCursor(c => Math.max(0, c - 1));
            return;
        }

        if (key.downArrow || input === 'j') {
            setCursor(c => Math.min(flatList.length - 1, c + 1));
            return;
        }

        if (input === ' ') {
            // Toggle selection
            const item = flatList[cursor];
            if (!item) return;

            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));

                function toggle(nodes: FileNode[], targetPath: string): boolean {
                    for (const node of nodes) {
                        if (node.path === targetPath) {
                            node.selected = !node.selected;
                            // If directory, select all children
                            if (node.isDir && node.children) {
                                function setAll(children: FileNode[], val: boolean) {
                                    for (const child of children) {
                                        child.selected = val;
                                        if (child.children) setAll(child.children, val);
                                    }
                                }
                                setAll(node.children, node.selected);
                            }
                            return true;
                        }
                        if (node.children && toggle(node.children, targetPath)) {
                            return true;
                        }
                    }
                    return false;
                }

                toggle(clone, item.node.path);
                return clone;
            });
            return;
        }

        if (key.return) {
            const item = flatList[cursor];
            if (item?.node.isDir) {
                // Toggle expand
                setTree(prev => {
                    const clone = JSON.parse(JSON.stringify(prev));

                    function toggleExpand(nodes: FileNode[], targetPath: string): boolean {
                        for (const node of nodes) {
                            if (node.path === targetPath) {
                                node.expanded = !node.expanded;
                                return true;
                            }
                            if (node.children && toggleExpand(node.children, targetPath)) {
                                return true;
                            }
                        }
                        return false;
                    }

                    toggleExpand(clone, item.node.path);
                    return clone;
                });
            }
            return;
        }

        if (input === 'a') {
            // Select all
            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                function selectAll(nodes: FileNode[]) {
                    for (const node of nodes) {
                        node.selected = true;
                        if (node.children) selectAll(node.children);
                    }
                }
                selectAll(clone);
                return clone;
            });
            return;
        }

        if (input === 'n') {
            // Deselect all (None)
            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                function deselectAll(nodes: FileNode[]) {
                    for (const node of nodes) {
                        node.selected = false;
                        if (node.children) deselectAll(node.children);
                    }
                }
                deselectAll(clone);
                return clone;
            });
            return;
        }

        if (input === 'i') {
            // Invert selection
            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                function invertAll(nodes: FileNode[]) {
                    for (const node of nodes) {
                        if (!node.isDir) {
                            node.selected = !node.selected;
                        }
                        if (node.children) invertAll(node.children);
                    }
                }
                invertAll(clone);
                return clone;
            });
            return;
        }

        if (input === 'e') {
            // Expand all directories
            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                function expandAll(nodes: FileNode[]) {
                    for (const node of nodes) {
                        if (node.isDir) node.expanded = true;
                        if (node.children) expandAll(node.children);
                    }
                }
                expandAll(clone);
                return clone;
            });
            return;
        }

        if (input === 'z') {
            // Collapse all directories (fold)
            setTree(prev => {
                const clone = JSON.parse(JSON.stringify(prev));
                function collapseAll(nodes: FileNode[]) {
                    for (const node of nodes) {
                        if (node.isDir) node.expanded = false;
                        if (node.children) collapseAll(node.children);
                    }
                }
                collapseAll(clone);
                return clone;
            });
            return;
        }

        if (input === 'c') {
            // Confirm and generate
            const selectedResults = results.filter(r => {
                function isSelected(nodes: FileNode[], path: string): boolean {
                    for (const node of nodes) {
                        if (node.path === path) return node.selected;
                        if (node.children) {
                            const result = isSelected(node.children, path);
                            if (result !== undefined) return result;
                        }
                    }
                    return false;
                }
                return isSelected(tree, r.path);
            });

            const output = format(selectedResults, { format: 'markdown', includeTree: true });
            onComplete(output);
            exit();
            return;
        }
    });

    if (loading) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="cyan">⏳ Scanning files...</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            {/* Header */}
            <Box marginBottom={1}>
                <Text bold color="cyan">ctx</Text>
                <Text color="gray"> - Code Context Generator</Text>
            </Box>

            {/* Search */}
            <Box marginBottom={1}>
                <Text color="gray">🔍 </Text>
                {isSearching ? (
                    <TextInput
                        value={filter}
                        onChange={setFilter}
                        placeholder="Type to filter..."
                    />
                ) : (
                    <Text color="gray">{filter || 'Press / to search'}</Text>
                )}
            </Box>

            {/* File Tree */}
            <Box flexDirection="column" marginBottom={1}>
                {flatList.slice(Math.max(0, cursor - 10), cursor + 15).map(({ node, depth }, i) => (
                    <TreeItem
                        key={node.path}
                        node={node}
                        depth={depth}
                        isActive={cursor === Math.max(0, cursor - 10) + i}
                        filter={filter}
                    />
                ))}
                {flatList.length === 0 && (
                    <Text color="gray">No files found</Text>
                )}
            </Box>

            {/* Status Bar */}
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text>
                    Selected: <Text bold color="green">{selectedCount}</Text> files |
                    Tokens: <Text bold color={getTokenColor(totalTokens)}>{formatTokens(totalTokens)}</Text>
                </Text>
            </Box>

            {/* Help */}
            <Box marginTop={1} flexDirection="column">
                <Text color="gray">
                    [↑↓/jk] Navigate  [Space] Toggle  [Enter] Expand/Collapse
                </Text>
                <Text color="gray">
                    [a] All  [n] None  [i] Invert  [e] Expand All  [z] Collapse All
                </Text>
                <Text color="gray">
                    [/] Search  [c] Confirm  [q] Quit
                </Text>
            </Box>
        </Box>
    );
}

/**
 * Launch TUI
 */
export async function launchTUI(options: {
    cwd: string;
    patterns: string[];
    ignore: string[];
    copyToClipboard?: boolean;
}): Promise<string> {
    return new Promise((resolve) => {
        const { waitUntilExit } = render(
            <App
                cwd={options.cwd}
                patterns={options.patterns}
                ignore={options.ignore}
                onComplete={async (output) => {
                    if (options.copyToClipboard) {
                        await clipboard.write(output);
                        console.log('\n✅ Copied to clipboard!');
                    }
                    resolve(output);
                }}
            />
        );

        waitUntilExit();
    });
}
