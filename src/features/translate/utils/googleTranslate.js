import { ENV } from '../../../bootstrap/environment.js';
import { LogData } from '../../../shared/utils/logger.js';

/**
 * Google Cloud Translation (Basic, v2). The key is sent in a header rather than the URL,
 * so it never ends up in logs of request URLs.
 */

const API_URL = 'https://translation.googleapis.com/language/translate/v2';
const REQUEST_TIMEOUT_MS = 10_000;
const LANGUAGES_TTL_MS = 24 * 60 * 60 * 1000;

/** Used until (or if) Google's own list can be loaded. */
export const FALLBACK_LANGUAGES = Object.freeze([
    { code: 'ar', name: 'Arabic' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'no', name: 'Norwegian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'es', name: 'Spanish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'vi', name: 'Vietnamese' },
]);

/**
 * @typedef {{ code: string, name: string }} Language
 * @typedef {{ text: string, from: string }} Translation
 */

/** Why a translation failed, so the reply can say something useful. */
export class TranslateError extends Error {
    /**
     * @param {'not_configured' | 'limit' | 'bad_language' | 'failed'} reason
     * @param {string} [message]
     */
    constructor(reason, message = reason) {
        super(message);
        this.reason = reason;
    }
}

export function isConfigured() {
    return Boolean(ENV.TRANSLATE_API_KEY);
}

/** @type {{ languages: Language[], loadedAt: number } | null} */
let languageCache = null;

/**
 * Every language Google can translate to, with English names. Loaded once a day.
 * @returns {Promise<Language[]>}
 */
export async function listLanguages() {
    if (languageCache && Date.now() - languageCache.loadedAt < LANGUAGES_TTL_MS) return languageCache.languages;
    if (!isConfigured()) return [...FALLBACK_LANGUAGES];

    try {
        const data = await request('GET', '/languages?target=en');
        const languages = data.languages
            .map(({ language, name }) => ({ code: language, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        languageCache = { languages, loadedAt: Date.now() };
        return languages;
    } catch (error) {
        LogData('Translate', `Could not load the language list: ${error.message}`, 'warning');
        // Try again in a few minutes rather than a day
        languageCache = { languages: [...FALLBACK_LANGUAGES], loadedAt: Date.now() - LANGUAGES_TTL_MS + 5 * 60_000 };
        return languageCache.languages;
    }
}

/** For tests. */
export function resetLanguageCache() {
    languageCache = null;
}

/**
 * @param {string} text
 * @param {string} target - Language code, e.g. 'en' or 'zh-CN'
 * @param {string | null} [source] - Left out to let Google detect it
 * @returns {Promise<Translation>}
 */
export async function translateText(text, target, source = null) {
    if (!isConfigured()) throw new TranslateError('not_configured');

    const body = { q: text, target, format: 'text', ...(source ? { source } : {}) };
    const data = await request('POST', '', body);
    const translation = data.translations?.[0];
    if (!translation) throw new TranslateError('failed', 'Google returned no translation');

    return { text: translation.translatedText, from: source ?? translation.detectedSourceLanguage ?? 'und' };
}

/**
 * @param {'GET' | 'POST'} method
 * @param {string} path
 * @param {object} [body]
 */
async function request(method, path, body) {
    let response;
    try {
        response = await fetch(API_URL + path, {
            method,
            headers: {
                'X-Goog-Api-Key': /** @type {string} */ (ENV.TRANSLATE_API_KEY),
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        throw new TranslateError('failed', `Request failed: ${error.message}`);
    }

    const json = await response.json().catch(() => null);
    if (response.ok && json?.data) return json.data;

    const error = json?.error;
    const reasons = (error?.errors ?? []).map((item) => item.reason);
    const message = `Google ${response.status}: ${error?.message ?? 'no details'}`;

    // Quota caps (429 / RESOURCE_EXHAUSTED) and the older daily or rate limit errors
    if (
        response.status === 429 ||
        error?.status === 'RESOURCE_EXHAUSTED' ||
        reasons.some((reason) => /limitexceeded/i.test(reason))
    ) {
        throw new TranslateError('limit', message);
    }
    if (response.status === 400 && /language|target|source/i.test(error?.message ?? '')) {
        throw new TranslateError('bad_language', message);
    }
    throw new TranslateError('failed', message);
}
