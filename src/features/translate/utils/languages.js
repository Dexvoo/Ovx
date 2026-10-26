/**
 * @typedef {import('./googleTranslate.js').Language} Language
 */

/** Discord locales whose Google code isn't just the part before the dash. */
const LOCALE_OVERRIDES = Object.freeze({ 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW' });

/**
 * The language to translate into for someone, from their Discord app's language.
 * @param {string | null | undefined} locale - e.g. 'en-GB', 'es-419', 'pt-BR', 'zh-TW'
 */
export function localeToLanguage(locale) {
    if (!locale) return 'en';
    return LOCALE_OVERRIDES[locale] ?? locale.split('-')[0].toLowerCase();
}

/**
 * Finds a language by its code or English name, ignoring case.
 * @param {string} input
 * @param {readonly Language[]} languages
 * @returns {Language | null}
 */
export function findLanguage(input, languages) {
    const wanted = input.trim().toLowerCase();
    if (!wanted) return null;
    return (
        languages.find((language) => language.code.toLowerCase() === wanted) ??
        languages.find((language) => language.name.toLowerCase() === wanted) ??
        null
    );
}

/**
 * The English name of a language code, falling back to the code itself.
 * Google sometimes detects a base code ('zh') that the list only has variants of ('zh-CN').
 * @param {string} code
 * @param {readonly Language[]} languages
 */
export function languageName(code, languages) {
    const exact = findLanguage(code, languages);
    if (exact) return exact.name;
    const base = code.split('-')[0].toLowerCase();
    return languages.find((language) => language.code.toLowerCase().split('-')[0] === base)?.name ?? code;
}

/**
 * Autocomplete choices: names starting with the query first, then names or codes containing it.
 * @param {string} query
 * @param {readonly Language[]} languages
 * @param {number} [limit=25] - Discord shows at most 25
 * @returns {{ name: string, value: string }[]}
 */
export function matchLanguages(query, languages, limit = 25) {
    const wanted = query.trim().toLowerCase();
    const starts = [];
    const contains = [];
    for (const language of languages) {
        const name = language.name.toLowerCase();
        const code = language.code.toLowerCase();
        if (!wanted || name.startsWith(wanted) || code === wanted) starts.push(language);
        else if (name.includes(wanted) || code.startsWith(wanted)) contains.push(language);
    }
    return [...starts, ...contains].slice(0, limit).map((language) => ({ name: language.name, value: language.code }));
}

/**
 * Whether translating would give back the same text (the source is already the target language).
 * @param {string} from
 * @param {string} to
 */
export function isSameLanguage(from, to) {
    const a = from.toLowerCase();
    const b = to.toLowerCase();
    if (a === b) return true;
    // 'zh-CN' and 'zh-TW' are different, but 'en' and 'en-GB' are the same
    return (!a.includes('-') || !b.includes('-')) && a.split('-')[0] === b.split('-')[0] && a.split('-')[0] !== 'zh';
}
