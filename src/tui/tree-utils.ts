/**
 * Tree Utilities Module
 * Unified tree traversal and manipulation functions for TUI
 */

import type { ScanResult } from '../scanner';

/**
 * File/Directory node in the tree
 */
export interface FileNode {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileNode[];
    result?: ScanResult;
    tokens?: number;
    selected: boolean;
    expanded: boolean;
}

/**
 * Generic tree traversal - visits every node
 */
export function traverseTree(
    nodes: FileNode[],
    visitor: (node: FileNode) => void
): void {
    for (const node of nodes) {
        visitor(node);
        if (node.children) {
            traverseTree(node.children, visitor);
        }
    }
}

/**
 * Find a node by path and apply an operation
 */
export function findAndApply(
    nodes: FileNode[],
    targetPath: string,
    apply: (node: FileNode) => void
): boolean {
    for (const node of nodes) {
        if (node.path === targetPath) {
            apply(node);
            return true;
        }
        if (node.children && findAndApply(node.children, targetPath, apply)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a node is selected by path
 */
export function isNodeSelected(nodes: FileNode[], path: string): boolean {
    for (const node of nodes) {
        if (node.path === path) return node.selected;
        if (node.children) {
            const found = isNodeSelected(node.children, path);
            if (found !== undefined) return found;
        }
    }
    return false;
}

// ============ Selection Operations ============

/**
 * Set all children's selected state recursively
 */
function setChildrenSelected(children: FileNode[], selected: boolean): void {
    for (const child of children) {
        child.selected = selected;
        if (child.children) {
            setChildrenSelected(child.children, selected);
        }
    }
}

/**
 * Toggle selection for a specific node (and its children if directory)
 */
export function toggleSelection(nodes: FileNode[], targetPath: string): void {
    findAndApply(nodes, targetPath, node => {
        node.selected = !node.selected;
        if (node.isDir && node.children) {
            setChildrenSelected(node.children, node.selected);
        }
    });
}

/**
 * Select all nodes
 */
export function selectAll(nodes: FileNode[]): void {
    traverseTree(nodes, node => { node.selected = true; });
}

/**
 * Deselect all nodes
 */
export function deselectAll(nodes: FileNode[]): void {
    traverseTree(nodes, node => { node.selected = false; });
}

/**
 * Invert selection for all files (not directories)
 */
export function invertSelection(nodes: FileNode[]): void {
    traverseTree(nodes, node => {
        if (!node.isDir) {
            node.selected = !node.selected;
        }
    });
}

// ============ Directory Expansion Operations ============

/**
 * Toggle expand state for a specific directory
 */
export function toggleExpand(nodes: FileNode[], targetPath: string): void {
    findAndApply(nodes, targetPath, node => {
        if (node.isDir) {
            node.expanded = !node.expanded;
        }
    });
}

/**
 * Expand all directories
 */
export function expandAll(nodes: FileNode[]): void {
    traverseTree(nodes, node => {
        if (node.isDir) node.expanded = true;
    });
}

/**
 * Collapse all directories
 */
export function collapseAll(nodes: FileNode[]): void {
    traverseTree(nodes, node => {
        if (node.isDir) node.expanded = false;
    });
}

// ============ Selection for Current Directory ============

/**
 * Select/deselect all files in current directory
 */
export function toggleCurrentDirSelection(nodes: FileNode[], targetPath: string): void {
    findAndApply(nodes, targetPath, node => {
        if (node.isDir && node.children) {
            // Toggle: if any child is selected, deselect all; otherwise select all
            const anySelected = node.children.some(c => c.selected);
            setChildrenSelected(node.children, !anySelected);
            node.selected = !anySelected;
        }
    });
}

// ============ Test File Operations ============

/**
 * Toggle selection for test files only
 */
export function toggleTestFiles(nodes: FileNode[]): void {
    const testPatterns = ['.test.', '.spec.', '__tests__'];
    traverseTree(nodes, node => {
        if (!node.isDir) {
            const isTest = testPatterns.some(p => node.path.includes(p));
            if (isTest) {
                node.selected = !node.selected;
            }
        }
    });
}

// ============ Statistics ============

/**
 * Calculate directory statistics (for badges)
 */
export function getDirStats(node: FileNode): { fileCount: number; totalTokens: number } {
    let fileCount = 0;
    let totalTokens = 0;

    if (node.children) {
        traverseTree(node.children, child => {
            if (!child.isDir && child.tokens) {
                fileCount++;
                totalTokens += child.tokens;
            }
        });
    }

    return { fileCount, totalTokens };
}

/**
 * Calculate selected statistics
 */
export function getSelectedStats(nodes: FileNode[]): { count: number; tokens: number } {
    let count = 0;
    let tokens = 0;

    traverseTree(nodes, node => {
        if (node.selected && !node.isDir && node.tokens) {
            count++;
            tokens += node.tokens;
        }
    });

    return { count, tokens };
}

// ============ Tree Building ============

/**
 * Build tree structure from scan results
 */
export function buildFileTree(results: ScanResult[]): FileNode[] {
    const root: Record<string, any> = {};

    for (const result of results) {
        const parts = result.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = { result, tokens: result.tokenInfo.tokens };
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
 * Flatten tree for navigation (respects expanded state)
 */
export function flattenTree(nodes: FileNode[], depth = 0): Array<{ node: FileNode; depth: number }> {
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
 * Deep clone tree (for immutable updates)
 */
export function cloneTree(nodes: FileNode[]): FileNode[] {
    return JSON.parse(JSON.stringify(nodes));
}
