/**
 * i18n translations index
 * Add new languages here and they will be automatically available
 */

import enUS from './en-US.json';
import zhCN from './zh-CN.json';

export interface TranslationSet {
    [key: string]: string;
}

export interface AvailableLocales {
    [locale: string]: TranslationSet;
}

/**
 * All available translations
 * To add a new language:
 * 1. Create a new JSON file in this folder (e.g., 'ja-JP.json')
 * 2. Import it above
 * 3. Add it to this object
 */
export const translations: AvailableLocales = {
    'en-US': enUS as TranslationSet,
    'en-GB': enUS as TranslationSet,  // Fallback to US English
    'zh-CN': zhCN as TranslationSet,
    'zh-TW': zhCN as TranslationSet,  // Fallback to Simplified Chinese
};

/**
 * Default/fallback locale
 */
export const defaultLocale = 'en-US';

/**
 * Get translation for a key
 * @param locale Current locale
 * @param key Translation key
 * @param params Optional parameters for interpolation
 */
export function translate(locale: string, key: string, params?: Record<string, string | number>): string {
    // Try exact locale
    let translation = translations[locale]?.[key];

    // Fallback to language without region (e.g., 'zh-CN' -> 'zh')
    if (!translation) {
        const lang = locale.split('-')[0];
        for (const loc of Object.keys(translations)) {
            if (loc.startsWith(lang + '-')) {
                translation = translations[loc]?.[key];
                if (translation) break;
            }
        }
    }

    // Fallback to default locale
    if (!translation) {
        translation = translations[defaultLocale]?.[key];
    }

    // If still not found, return the key itself
    if (!translation) {
        return key;
    }

    // Interpolate parameters
    if (params) {
        for (const [param, value] of Object.entries(params)) {
            translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
    }

    return translation;
}
