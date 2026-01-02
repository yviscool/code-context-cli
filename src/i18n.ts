/**
 * Internationalization Module (i18n)
 * Auto-detects system locale and loads corresponding translations
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM 环境下模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Locale = 'en' | 'zh';

let translations: Record<string, string> = {};
let currentLocale: Locale = 'en';

/**
 * Detect system locale from environment
 */
function getSystemLocale(): Locale {
    // Priority: environment variables (more reliable across runtimes)
    const lang = process.env.LANG || process.env.LC_MESSAGES || process.env.LC_ALL;
    if (lang && lang.toLowerCase().startsWith('zh')) {
        return 'zh';
    }

    // Fallback to Intl API
    try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        if (locale.startsWith('zh')) {
            return 'zh';
        }
    } catch {
        // Ignore errors
    }

    return 'en';
}

/**
 * Load translations for a specific locale
 */
function loadTranslations(locale: Locale): boolean {
    const filePath = path.join(__dirname, 'locales', `${locale}.json`);
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        translations = JSON.parse(fileContent);
        currentLocale = locale;
        return true;
    } catch (error) {
        // If loading fails, fallback to English
        if (locale !== 'en') {
            return loadTranslations('en');
        }
        console.error(`Failed to load translations for locale: ${locale}`, error);
        return false;
    }
}

/**
 * Translate a key with optional parameter substitution.
 * 
 * @param key - The translation key
 * @param args - Replacement parameters for {0}, {1}, etc.
 * @returns Translated string, or the key itself if not found
 * 
 * @example
 * t('cli.found_files', 42) // "✓ Found 42 files"
 * t('cli.lang_stat', 'typescript', 10, '5.2k') // "- typescript: 10 files, 5.2k tokens"
 */
export function t(key: string, ...args: (string | number)[]): string {
    let message = translations[key] || key;
    args.forEach((arg, index) => {
        message = message.replace(`{${index}}`, String(arg));
    });
    return message;
}

/**
 * Get current locale
 */
export function getLocale(): Locale {
    return currentLocale;
}

/**
 * Set locale manually (for testing or user preference)
 */
export function setLocale(locale: Locale): boolean {
    return loadTranslations(locale);
}

/**
 * Check if current locale is Chinese
 */
export function isChinese(): boolean {
    return currentLocale === 'zh';
}

// Initialize with system locale on module load
loadTranslations(getSystemLocale());
