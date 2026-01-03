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
import { highlight } from 'cardinal';

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

// Fixed viewport height to ensure consistency across panes and fit standard terminals
const VIEWPORT_HEIGHT = 20;

interface AppProps {
    cwd: string;
    patterns: string[];
    ignore: string[];
    onComplete: (output: string) => void;
}

/**
 * Component to highlight matched text
 */
function HighlightedText({ text, filter, isActive }: { text: string, filter: string, isActive: boolean }) {
    if (!filter || !text.toLowerCase().includes(filter.toLowerCase())) {
        return <Text bold={isActive}>{text}</Text>;
    }

    // Escape regex special chars
    const escapedFilter = filter.replace(/[.*+?^${}()|[\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedFilter})`, 'gi'));
    
    return (
        <Text bold={isActive}>
            {parts.map((part, i) => {
                const isMatch = part.toLowerCase() === filter.toLowerCase();
                return (
                    <Text key={i} color={isMatch ? 'cyan' : undefined} underline={isMatch}>
                        {part}
                    </Text>
                );
            })}
        </Text>
    );
}

/**
 * Enhanced icon component for better visuals
 */
function FileIcon({ node }: { node: FileNode }) {
    if (node.isDir) {
        return <Text color="yellow">{node.expanded ? '📂 ' : '📁 '}</Text>;
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts':
        case 'tsx': return <Text color="blue"> </Text>;
        case 'js':
        case 'jsx': return <Text color="yellow"> </Text>;
        case 'json': return <Text color="yellow"> </Text>;
        case 'md': return <Text color="magenta"> </Text>;
        case 'py': return <Text color="blue"> </Text>;
        case 'rs': return <Text color="red"> </Text>;
        case 'go': return <Text color="cyan"> </Text>;
        case 'css':
        case 'scss': return <Text color="blue"> </Text>;
        case 'html': return <Text color="red"> </Text>;
        default: return <Text color="gray">📄 </Text>;
    }
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
    const checkbox = node.selected ? '[✓]' : '[ ]';

    // Token badge with color coding
    let tokenBadge = '';
    let tokenColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';

    if (node.tokens) {
        tokenBadge = ` ${formatTokens(node.tokens)}`;
        // Color code by token count
        if (node.tokens > 5000) tokenColor = 'red';
        else if (node.tokens > 2000) tokenColor = 'yellow';
        else tokenColor = 'green';
    }

    // Directory stats badge
    let dirBadge = '';
    if (node.isDir && showDirStats) {
        const stats = getDirStats(node);
        dirBadge = ` ${stats.fileCount}f ${formatTokens(stats.totalTokens)}`;
    }

    return (
        <Box>
            <Text color={isActive ? 'blue' : undefined} bold={isActive}>
                {indent}
            </Text>
            <Text color={isActive ? 'blue' : node.selected ? 'green' : 'gray'}>
                {checkbox}{' '}
            </Text>
            <FileIcon node={node} />
            <Box flexGrow={1}>
                <HighlightedText text={node.name} filter={filter} isActive={isActive} />
            </Box>
            {node.isDir ? (
                <Text color="gray" dimColor> {dirBadge}</Text>
            ) : (
                <Text color={tokenColor} dimColor> {tokenBadge}</Text>
            )}
        </Box>
    );
}

/**
 * Code Preview Component with Line Numbers, Highlighting and Scrolling
 * Optimized: Renders as two text blocks (gutter + content) to prevent layout issues
 */
function CodePreview({ content, path, language, isSelected, offset, height }: {
    content: string,
    path: string,
    language: string,
    isSelected: boolean,
    offset: number,
    height: number
}) {
    
    const highlightedContent = useMemo(() => {
        if (!content) return '';
        
        try {
            if (['typescript', 'javascript', 'tsx', 'jsx', 'json'].includes(language)) {
                return highlight(content);
            }
        } catch (e) {
            // Fallback
        }
        return content;
    }, [content, language]);

    const allLines = highlightedContent.split('\n');
    const previewLines = allLines.slice(offset, offset + height);
    const hasMoreBelow = allLines.length > offset + height;
    const hasMoreAbove = offset > 0;

    // Generate line numbers text
    const lineNumbersText = previewLines
        .map((_, i) => (i + offset + 1).toString().padStart(4))
        .join('\n');

    // Generate code text
    // Note: We don't join with \n here because we render them as Text lines to support individual truncation if needed?
    // Actually, Text with newlines and wrap='truncate' might truncate the whole block.
    // Let's stick to mapping Text components but WITHOUT nested Boxes for performance, 
    // OR use a single Text block if we trust 'truncate-end' per line.
    // Ink's 'truncate' usually applies to the block.
    // Safe approach: Render individual Text components for code lines, but inside a single container Box, avoiding per-line Boxes with borders.
    
    return (
        <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray" flexGrow={1}>
             {/* Header */}
             <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" marginBottom={0} paddingBottom={0}>
                <Text bold color="cyan">  {path}</Text>
                {isSelected && (
                    <Box marginLeft={2}>
                        <Text color="green" bold>[SELECTED]</Text>
                    </Box>
                )}
                <Box marginLeft="auto">
                    <Text color="gray">{language} | {allLines.length} lines</Text>
                </Box>
             </Box>
             
             {/* Content Area */}
             <Box flexDirection="column" marginTop={0} height={height}>
                 {hasMoreAbove && (
                     <Box justifyContent="center" height={1}>
                        <Text color="yellow" dimColor>--- {offset} lines above ---</Text>
                     </Box>
                 )}
                 
                 {/* Split View: Gutter | Code */}
                 <Box flexDirection="row" flexGrow={1} overflow="hidden">
                    {/* Gutter */}
                    <Box flexDirection="column" width={5} marginRight={1}>
                        <Text color="gray" dimColor>{lineNumbersText}</Text>
                    </Box>

                    {/* Vertical Separator (simulated with borderLeft on Code Box) */}
                    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderTop={false} borderBottom={false} borderRight={false} borderLeft={true} borderColor="gray" paddingLeft={1}>
                         {previewLines.map((line, i) => (
                             <Text key={i} wrap="truncate-end">{line}</Text>
                         ))}
                    </Box>
                 </Box>

                 {hasMoreBelow && (
                     <Box justifyContent="center" marginTop={0} height={1}>
                        <Text color="yellow" dimColor>--- {allLines.length - (offset + height)} more (J) ---</Text>
                     </Box>
                 )}
             </Box>
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
    const [lastKey, setLastKey] = useState('');
    const [previewOffset, setPreviewOffset] = useState(0);

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

    // Reset preview offset when cursor moves
    useEffect(() => {
        setPreviewOffset(0);
    }, [cursor]);

    // Calculate selected stats using tree-utils
    const { selectedCount, totalTokens } = useMemo(() => {
        const stats = getSelectedStats(tree);
        return { selectedCount: stats.count, totalTokens: stats.tokens };
    }, [tree]);

    // Current active node for preview
    const activeItem = flatList[cursor];
    const previewNode = activeItem?.node;

    // Scroll indicators for tree
    // Center the cursor in the viewport
    let listStart = cursor - Math.floor(VIEWPORT_HEIGHT / 2);
    if (listStart < 0) listStart = 0;
    
    let listEnd = listStart + VIEWPORT_HEIGHT;
    if (listEnd > flatList.length) {
        listEnd = flatList.length;
        // Adjust start if we hit the bottom to keep viewport full if possible
        listStart = Math.max(0, listEnd - VIEWPORT_HEIGHT);
    }
    
    const visibleList = flatList.slice(listStart, listEnd);
    const hasMoreAbove = listStart > 0;
    const hasMoreBelow = listEnd < flatList.length;

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

        // Navigation: j/k (vim)
        if (key.upArrow || input === 'k') {
            setCursor(c => Math.max(0, c - 1));
            return;
        }

        if (key.downArrow || input === 'j') {
            setCursor(c => Math.min(flatList.length - 1, c + 1));
            return;
        }

        // Preview Scroll: J/K (Shift+j/k)
        if (input === 'J') {
            setPreviewOffset(o => o + 5);
            return;
        }
        if (input === 'K') {
            setPreviewOffset(o => Math.max(0, o - 5));
            return;
        }

        // Half-page down/up
        if (key.ctrl && input === 'd') {
            setCursor(c => Math.min(flatList.length - 1, c + 10));
            return;
        }
        if (key.ctrl && input === 'u') {
            setCursor(c => Math.max(0, c - 10));
            return;
        }

        // Jump to top/bottom
        if (input === 'g') {
            if (lastKey === 'g') setCursor(0);
            else setLastKey('g');
            return;
        }
        if (input === 'G') {
            setCursor(flatList.length - 1);
            return;
        }

        // Toggle selection
        if (input === 'x' || input === ' ') {
            const item = flatList[cursor];
            if (!item) return;
            setTree(prev => {
                const clone = cloneTree(prev);
                toggleSelection(clone, item.node.path);
                return clone;
            });
            return;
        }

        // Expand/Collapse
        if (input === 'o' || input === 'l' || key.return) {
            const item = flatList[cursor];
            if (item?.node.isDir) {
                if (input === 'l' && item.node.expanded) return;
                setTree(prev => {
                    const clone = cloneTree(prev);
                    if (input === 'l') findAndApply(clone, item.node.path, n => { n.expanded = true; });
                    else toggleExpand(clone, item.node.path);
                    return clone;
                });
            }
            return;
        }
        if (input === 'h') {
            const item = flatList[cursor];
            if (item?.node.isDir && item.node.expanded) {
                setTree(prev => {
                    const clone = cloneTree(prev);
                    toggleExpand(clone, item.node.path);
                    return clone;
                });
            }
            return;
        }

        // Global actions
        if (input === 'a') {
            setTree(prev => {
                const clone = cloneTree(prev);
                selectAll(clone);
                return clone;
            });
            return;
        }
        if (input === 'u' || input === 'n') {
            setTree(prev => {
                const clone = cloneTree(prev);
                deselectAll(clone);
                return clone;
            });
            return;
        }

        // Confirm
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

        setLastKey('');
    });

    if (loading) {
        return (
            <Box flexDirection="column" padding={1} justifyContent="center" alignItems="center" height="100%">
                <Text color="cyan" bold>{t('tui.scanning')}</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" height="100%">
            {/* Main Content Area: Split View */}
            <Box flexDirection="row" flexGrow={1}>
                
                {/* Left Pane: File Tree */}
                <Box flexDirection="column" width="30%" borderStyle="single" borderColor="blue" paddingX={1}>
                    {/* Header */}
                    <Box marginBottom={1}>
                        <Text bold color="cyan">  FILES</Text>
                        <Box marginLeft="auto">
                            <Text color="gray">{flatList.length}</Text>
                        </Box>
                    </Box>

                    {/* Search */}
                    <Box marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text color="gray">  </Text>
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
                    <Box height={1} justifyContent="center">
                        {hasMoreAbove && (
                            <Text color="yellow" bold>▲ {t('tui.more_above', listStart)}</Text>
                        )}
                    </Box>

                    {/* File Tree List */}
                    <Box flexDirection="column" flexGrow={1}>
                        {visibleList.map(({ node, depth }, i) => (
                            <TreeItem
                                key={node.path}
                                node={node}
                                depth={depth}
                                isActive={cursor === listStart + i}
                                filter={filter}
                                showDirStats={showDirStats}
                            />
                        ))}
                         {flatList.length === 0 && (
                            <Box marginTop={2} justifyContent="center">
                                <Text color="gray" italic>{t('tui.no_files')}</Text>
                            </Box>
                        )}
                    </Box>
                    
                    {/* Scroll indicator (bottom) */}
                    <Box height={1} justifyContent="center">
                        {hasMoreBelow && (
                            <Text color="yellow" bold>▼ {t('tui.more_below', flatList.length - listEnd)}</Text>
                        )}
                    </Box>
                </Box>

                {/* Right Pane: Preview */}
                <Box flexDirection="column" width="70%" borderStyle="single" borderColor="blue" paddingX={0}>
                    {previewNode && !previewNode.isDir && previewNode.result ? (
                        <CodePreview 
                            content={previewNode.result.content} 
                            path={previewNode.path}
                            language={previewNode.result.language}
                            isSelected={previewNode.selected}
                            offset={previewOffset}
                            height={VIEWPORT_HEIGHT + 4} // Slightly taller to match tree + header/footer
                        />
                    ) : (
                        <Box flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                            <Text color="gray" dimColor></Text>
                            <Text color="gray" bold>{previewNode?.isDir ? 'Directory Explorer' : 'Select a file to preview'}</Text>
                             {previewNode?.isDir && (
                                <Box marginTop={1} flexDirection="column" alignItems="center" borderStyle="single" borderColor="gray" paddingX={2}>
                                    <Text bold color="cyan">{previewNode.name}/</Text>
                                    <Text color="gray">{getDirStats(previewNode).fileCount} files in this directory</Text>
                                    <Text color="gray">{formatTokens(getDirStats(previewNode).totalTokens)} total tokens</Text>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Bottom Status Bar */}
            <Box borderStyle="single" borderColor="green" paddingX={1} flexDirection="row" justifyContent="space-between">
                <Box>
                    <Text bold color="cyan"> ctx </Text>
                    <Text> │ </Text>
                    <Text>
                        {t('tui.selected')} <Text bold color="green">{selectedCount}</Text>
                    </Text>
                    <Text> │ </Text>
                    <Text>
                        Tokens: <Text bold color={getTokenColor(totalTokens)}>{formatTokens(totalTokens)}</Text>
                    </Text>
                </Box>
                <Box>
                     <Text color="gray" dimColor>
                         {t('tui.help.nav')}
                     </Text>
                </Box>
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
