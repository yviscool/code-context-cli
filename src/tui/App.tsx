/**
 * TUI App - Interactive File Selection
 * Refactored with tree-utils for cleaner code
 */
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { scan, type ScanResult } from '../scanner';
import { format } from '../formatter';
import { formatTokens, getTokenColor } from '../tokenizer';
import { t } from '../i18n';
import clipboard from 'clipboardy';

import {
    type FileNode,
    buildFileTree,
    flattenTree,
    cloneTree,
    findAndApply,
    toggleSelection,
    toggleExpand,
    selectAll,
    deselectAll,
    invertSelection,
    expandAll,
    collapseAll,
    toggleCurrentDirSelection,
    toggleTestFiles,
    getSelectedStats,
    getDirStats,
    isNodeSelected,
} from './tree-utils';

interface AppProps {
    cwd: string;
    patterns: string[];
    ignore: string[];
    onComplete: (output: string) => void;
}

/**
 * File Tree Item Component with enhanced visuals
 */
function TreeItem({ node, depth, isActive, filter, showDirStats }: {
    node: FileNode;
    depth: number;
    isActive: boolean;
    filter: string;
    showDirStats: boolean;
}) {
    const indent = '  '.repeat(depth);
    const icon = node.isDir
        ? (node.expanded ? '📂' : '📁')
        : '📄';
    const checkbox = node.selected ? '[✓]' : '[ ]';

    // Token badge with color coding
    let tokenBadge = '';
    let tokenColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

    if (node.tokens) {
        tokenBadge = ` (${formatTokens(node.tokens)} tok)`;
        // Color code by token count
        if (node.tokens > 5000) tokenColor = 'red';
        else if (node.tokens > 2000) tokenColor = 'yellow';
        else tokenColor = 'green';
    }

    // Directory stats badge
    let dirBadge = '';
    if (node.isDir && showDirStats) {
        const stats = getDirStats(node);
        dirBadge = ` [${stats.fileCount} files | ${formatTokens(stats.totalTokens)}]`;
    }

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
            {node.isDir ? (
                <Text color="gray" dimColor>{dirBadge}</Text>
            ) : (
                <Text color={tokenColor} dimColor>{tokenBadge}</Text>
            )}
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
    const [showDirStats, setShowDirStats] = useState(true);
    const [lastKey, setLastKey] = useState(''); // For gg/zz detection

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

    // Calculate selected stats using tree-utils
    const { selectedCount, totalTokens } = useMemo(() => {
        const stats = getSelectedStats(tree);
        return { selectedCount: stats.count, totalTokens: stats.tokens };
    }, [tree]);

    // Scroll indicators
    const visibleStart = Math.max(0, cursor - 10);
    const visibleEnd = Math.min(flatList.length, cursor + 15);
    const hasMoreAbove = visibleStart > 0;
    const hasMoreBelow = visibleEnd < flatList.length;

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

        // Navigation: j/k (vim), Ctrl+d/u for half-page
        if (key.upArrow || input === 'k') {
            setCursor(c => Math.max(0, c - 1));
            setLastKey('');
            return;
        }

        if (key.downArrow || input === 'j') {
            setCursor(c => Math.min(flatList.length - 1, c + 1));
            setLastKey('');
            return;
        }

        // Half-page down (Ctrl+d vim style)
        if (key.ctrl && input === 'd') {
            setCursor(c => Math.min(flatList.length - 1, c + 10));
            setLastKey('');
            return;
        }

        // Half-page up (Ctrl+u vim style)
        if (key.ctrl && input === 'u') {
            setCursor(c => Math.max(0, c - 10));
            setLastKey('');
            return;
        }

        // Jump to top: gg (vim double-g)
        if (input === 'g') {
            if (lastKey === 'g') {
                setCursor(0);
                setLastKey('');
            } else {
                setLastKey('g');
            }
            return;
        }

        // Jump to bottom: G (vim)
        if (input === 'G') {
            setCursor(flatList.length - 1);
            setLastKey('');
            return;
        }

        // Toggle selection: x (vim-like mark/cross)
        if (input === 'x' || input === ' ') {
            const item = flatList[cursor];
            if (!item) return;

            setTree(prev => {
                const clone = cloneTree(prev);
                toggleSelection(clone, item.node.path);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Toggle expand: o (vim open fold) or Enter or l (vim right = expand)
        if (input === 'o' || input === 'l' || key.return) {
            const item = flatList[cursor];
            if (item?.node.isDir) {
                // l only expands, h only collapses
                if (input === 'l' && item.node.expanded) {
                    setLastKey('');
                    return;
                }
                setTree(prev => {
                    const clone = cloneTree(prev);
                    if (input === 'l') {
                        // Expand only - use findAndApply to set expanded
                        findAndApply(clone, item.node.path, node => { node.expanded = true; });
                    } else {
                        toggleExpand(clone, item.node.path);
                    }
                    return clone;
                });
            }
            setLastKey('');
            return;
        }

        // Collapse: h (vim left = collapse)
        if (input === 'h') {
            const item = flatList[cursor];
            if (item?.node.isDir && item.node.expanded) {
                setTree(prev => {
                    const clone = cloneTree(prev);
                    toggleExpand(clone, item.node.path);
                    return clone;
                });
            }
            setLastKey('');
            return;
        }

        // Select all: a or Ctrl+a
        if (input === 'a' || (key.ctrl && input === 'a')) {
            setTree(prev => {
                const clone = cloneTree(prev);
                selectAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Deselect all: u (vim undo-like) or n
        if (input === 'u' || input === 'n') {
            setTree(prev => {
                const clone = cloneTree(prev);
                deselectAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Invert selection: i (vim insert = flip)
        if (input === 'i') {
            setTree(prev => {
                const clone = cloneTree(prev);
                invertSelection(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Expand all: zR (vim) - we use 'e' or detect zR
        if (input === 'R' && lastKey === 'z') {
            setTree(prev => {
                const clone = cloneTree(prev);
                expandAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }
        if (input === 'e') {
            setTree(prev => {
                const clone = cloneTree(prev);
                expandAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Collapse all: zM (vim) - we use 'E' or detect zM
        if (input === 'M' && lastKey === 'z') {
            setTree(prev => {
                const clone = cloneTree(prev);
                collapseAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }
        if (input === 'E') {
            setTree(prev => {
                const clone = cloneTree(prev);
                collapseAll(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Store z for z-commands
        if (input === 'z') {
            setLastKey('z');
            return;
        }

        // Select current directory files: * (vim search-like)
        if (input === '*') {
            const item = flatList[cursor];
            if (item?.node.isDir) {
                setTree(prev => {
                    const clone = cloneTree(prev);
                    toggleCurrentDirSelection(clone, item.node.path);
                    return clone;
                });
            }
            setLastKey('');
            return;
        }

        // Toggle test files: t
        if (input === 't') {
            setTree(prev => {
                const clone = cloneTree(prev);
                toggleTestFiles(clone);
                return clone;
            });
            setLastKey('');
            return;
        }

        // Toggle dir stats display: s
        if (input === 's') {
            setShowDirStats(prev => !prev);
            setLastKey('');
            return;
        }

        // Confirm: ZZ (vim save & quit) or c
        if ((input === 'Z' && lastKey === 'Z') || input === 'c') {
            const selectedResults = results.filter(r => isNodeSelected(tree, r.path));
            const output = format(selectedResults, { format: 'markdown', includeTree: true });
            onComplete(output);
            exit();
            return;
        }
        if (input === 'Z') {
            setLastKey('Z');
            return;
        }

        // Clear lastKey for unrecognized inputs
        setLastKey('');
    });

    if (loading) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="cyan">{t('tui.scanning')}</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            {/* Header */}
            <Box marginBottom={1}>
                <Text bold color="cyan">ctx</Text>
                <Text color="gray"> - {t('tui.title')}</Text>
            </Box>

            {/* Search */}
            <Box marginBottom={1}>
                <Text color="gray">🔍 </Text>
                {isSearching ? (
                    <TextInput
                        value={filter}
                        onChange={setFilter}
                        placeholder={t('tui.search_placeholder')}
                    />
                ) : (
                    <Text color="gray">{filter || t('tui.search_hint')}</Text>
                )}
            </Box>

            {/* Scroll indicator (top) */}
            {hasMoreAbove && (
                <Box>
                    <Text color="yellow" dimColor>  {t('tui.more_above', visibleStart)}</Text>
                </Box>
            )}

            {/* File Tree */}
            <Box flexDirection="column" marginBottom={1}>
                {flatList.slice(visibleStart, visibleEnd).map(({ node, depth }, i) => (
                    <TreeItem
                        key={node.path}
                        node={node}
                        depth={depth}
                        isActive={cursor === visibleStart + i}
                        filter={filter}
                        showDirStats={showDirStats}
                    />
                ))}
                {flatList.length === 0 && (
                    <Text color="gray">{t('tui.no_files')}</Text>
                )}
            </Box>

            {/* Scroll indicator (bottom) */}
            {hasMoreBelow && (
                <Box>
                    <Text color="yellow" dimColor>  {t('tui.more_below', flatList.length - visibleEnd)}</Text>
                </Box>
            )}

            {/* Status Bar */}
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text>
                    {t('tui.selected')} <Text bold color="green">{selectedCount}</Text> {t('tui.files')} |
                    {t('tui.tokens')} <Text bold color={getTokenColor(totalTokens)}>{formatTokens(totalTokens)}</Text>
                </Text>
            </Box>

            {/* Help - Vim Style */}
            <Box marginTop={1} flexDirection="column">
                <Text color="gray">
                    {t('tui.help.nav')}
                </Text>
                <Text color="gray">
                    {t('tui.help.select')}
                </Text>
                <Text color="gray">
                    {t('tui.help.expand')}
                </Text>
                <Text color="gray">
                    {t('tui.help.action')}
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
                        console.log(`\n${t('tui.copied')}`);
                    }
                    resolve(output);
                }}
            />
        );

        waitUntilExit();
    });
}
