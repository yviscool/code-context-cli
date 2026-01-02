/**
 * Scanner Module
 * Scans directories using Bun's native Glob API and respects .gitignore
 */
import { Glob } from 'bun';
import { readFile } from 'fs/promises';
import { join, extname, relative } from 'path';

export interface ScanOptions {
  cwd: string;
  patterns: string[];
  ignore?: string[];
}

export interface ScanResult {
  path: string;
  content: string;
  language: string;
}

/** Map file extensions to language names */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.sh': 'bash',
  '.sql': 'sql',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/** Default ignore patterns */
const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '*.lock',
  'package-lock.json',
  '.DS_Store',
];

/**
 * Parse .gitignore file and return patterns
 */
async function parseGitignore(cwd: string): Promise<string[]> {
  try {
    const content = await readFile(join(cwd, '.gitignore'), 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => {
        // Convert gitignore patterns to glob patterns
        if (pattern.endsWith('/')) {
          return pattern + '**';
        }
        return pattern;
      });
  } catch {
    return [];
  }
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || 'text';
}

/**
 * Check if a file matches any of the ignore patterns
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    const glob = new Glob(pattern);
    if (glob.match(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Scan directory for files matching patterns
 */
export async function scan(options: ScanOptions): Promise<ScanResult[]> {
  const { cwd, patterns, ignore = [] } = options;
  
  // Combine default ignores, gitignore patterns, and user-specified ignores
  const gitignorePatterns = await parseGitignore(cwd);
  const allIgnorePatterns = [...DEFAULT_IGNORE, ...gitignorePatterns, ...ignore];
  
  const results: ScanResult[] = [];
  const seenPaths = new Set<string>();
  
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    
    for await (const file of glob.scan({ cwd, dot: false, onlyFiles: true })) {
      // Skip if already processed or should be ignored
      if (seenPaths.has(file) || shouldIgnore(file, allIgnorePatterns)) {
        continue;
      }
      
      seenPaths.add(file);
      
      try {
        const absolutePath = join(cwd, file);
        const content = await readFile(absolutePath, 'utf-8');
        
        results.push({
          path: file,
          content,
          language: detectLanguage(file),
        });
      } catch (err) {
        // Skip files that can't be read (binary files, permission issues, etc.)
        console.warn(`Warning: Could not read file ${file}:`, err);
      }
    }
  }
  
  // Sort results by path for consistent output
  return results.sort((a, b) => a.path.localeCompare(b.path));
}
