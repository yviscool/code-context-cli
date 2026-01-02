/**
 * Scanner Module Tests
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { scan } from '../scanner';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__fixtures__');

describe('Scanner', () => {
    beforeAll(async () => {
        // Create test fixtures
        await mkdir(join(TEST_DIR, 'src'), { recursive: true });
        await mkdir(join(TEST_DIR, 'node_modules', 'dep'), { recursive: true });

        await writeFile(join(TEST_DIR, 'src', 'main.ts'), 'console.log("main");');
        await writeFile(join(TEST_DIR, 'src', 'utils.ts'), 'export const add = (a, b) => a + b;');
        await writeFile(join(TEST_DIR, 'src', 'style.css'), 'body { color: red; }');
        await writeFile(join(TEST_DIR, 'node_modules', 'dep', 'index.js'), 'module.exports = {};');
        await writeFile(join(TEST_DIR, '.gitignore'), '*.log\ntemp/');
    });

    afterAll(async () => {
        // Cleanup test fixtures
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    test('should scan TypeScript files', async () => {
        const results = await scan({
            cwd: TEST_DIR,
            patterns: ['**/*.ts'],
        });

        expect(results.length).toBe(2);
        expect(results.map(r => r.path).sort()).toEqual(['src/main.ts', 'src/utils.ts']);
    });

    test('should detect correct language', async () => {
        const results = await scan({
            cwd: TEST_DIR,
            patterns: ['**/*.ts', '**/*.css'],
        });

        const tsFile = results.find(r => r.path.endsWith('.ts'));
        const cssFile = results.find(r => r.path.endsWith('.css'));

        expect(tsFile?.language).toBe('typescript');
        expect(cssFile?.language).toBe('css');
    });

    test('should ignore node_modules by default', async () => {
        const results = await scan({
            cwd: TEST_DIR,
            patterns: ['**/*.js'],
        });

        // node_modules should be ignored
        expect(results.length).toBe(0);
    });

    test('should apply custom ignore patterns', async () => {
        const results = await scan({
            cwd: TEST_DIR,
            patterns: ['**/*.ts'],
            ignore: ['**/utils.ts'],
        });

        expect(results.length).toBe(1);
        expect(results[0].path).toBe('src/main.ts');
    });

    test('should read file content correctly', async () => {
        const results = await scan({
            cwd: TEST_DIR,
            patterns: ['**/main.ts'],
        });

        expect(results[0].content).toBe('console.log("main");');
    });
});
