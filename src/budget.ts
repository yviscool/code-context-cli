/**
 * Budget Module
 * Context budget control for fitting content within token limits
 */
import type { ScanResult } from './scanner';
import { countTokens, formatTokens } from './tokenizer';

export interface BudgetConfig {
    maxTokens: number;
    reserveTokens?: number;
    priorityPatterns?: string[];
}

export interface BudgetResult {
    included: ScanResult[];
    excluded: ScanResult[];
    totalTokens: number;
    budgetUsed: number;
    budgetRemaining: number;
}

/**
 * Calculate tokens for each file
 */
function calcFileTokens(results: ScanResult[]): Array<{ result: ScanResult; tokens: number }> {
    return results.map(result => ({
        result,
        tokens: countTokens(result.content).tokens,
    }));
}

/**
 * Sort files by priority (smaller files first, matching patterns get priority)
 */
function sortByPriority(
    files: Array<{ result: ScanResult; tokens: number }>,
    priorityPatterns: string[] = []
): Array<{ result: ScanResult; tokens: number }> {
    return files.sort((a, b) => {
        // Priority patterns first
        const aMatch = priorityPatterns.some(p => a.result.path.includes(p));
        const bMatch = priorityPatterns.some(p => b.result.path.includes(p));
        if (aMatch !== bMatch) return aMatch ? -1 : 1;

        // Smaller files first (more files = more context coverage)
        return a.tokens - b.tokens;
    });
}

/**
 * Fit files within token budget using greedy algorithm
 */
export function fitToBudget(results: ScanResult[], config: BudgetConfig): BudgetResult {
    const { maxTokens, reserveTokens = 0, priorityPatterns = [] } = config;
    const effectiveBudget = maxTokens - reserveTokens;

    const filesWithTokens = calcFileTokens(results);
    const sortedFiles = sortByPriority(filesWithTokens, priorityPatterns);

    const included: ScanResult[] = [];
    const excluded: ScanResult[] = [];
    let totalTokens = 0;

    for (const { result, tokens } of sortedFiles) {
        if (totalTokens + tokens <= effectiveBudget) {
            included.push(result);
            totalTokens += tokens;
        } else {
            excluded.push(result);
        }
    }

    return {
        included,
        excluded,
        totalTokens,
        budgetUsed: totalTokens,
        budgetRemaining: effectiveBudget - totalTokens,
    };
}

/**
 * Get budget summary message
 */
export function getBudgetSummary(result: BudgetResult, maxTokens: number): string {
    const pct = ((result.budgetUsed / maxTokens) * 100).toFixed(1);
    return `${formatTokens(result.budgetUsed)}/${formatTokens(maxTokens)} (${pct}%) | ` +
        `${result.included.length} included, ${result.excluded.length} excluded`;
}
