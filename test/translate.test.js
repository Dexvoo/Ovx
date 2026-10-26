import './helpers/setupEnv.js';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ENV } from '../src/bootstrap/environment.js';
import {
    translateText,
    listLanguages,
    resetLanguageCache,
    TranslateError,
    FALLBACK_LANGUAGES,
} from '../src/features/translate/utils/googleTranslate.js';
import {
    localeToLanguage,
    findLanguage,
    languageName,
    matchLanguages,
    isSameLanguage,
} from '../src/features/translate/utils/languages.js';
import { messageText, commandData as menuData } from '../src/features/translate/commands/translateMessage.js';
import { commandData as slashData, meta } from '../src/features/translate/commands/translate.js';

const realFetch = globalThis.fetch;
/** @type {{ url: string, init: RequestInit }[]} */
let requests;

/** @param {number} status @param {any} body */
const respondWith = (status, body) => {
    globalThis.fetch = /** @type {any} */ (
        async (url, init) => {
            requests.push({ url, init });
            return new Response(JSON.stringify(body), { status });
        }
    );
};

beforeEach(() => {
    requests = [];
    ENV.TRANSLATE_API_KEY = 'test-key';
    resetLanguageCache();
});

afterEach(() => {
    globalThis.fetch = realFetch;
    ENV.TRANSLATE_API_KEY = null;
});

test('Discord locales become Google language codes', () => {
    assert.equal(localeToLanguage('en-GB'), 'en');
    assert.equal(localeToLanguage('es-419'), 'es');
    assert.equal(localeToLanguage('pt-BR'), 'pt');
    assert.equal(localeToLanguage('zh-TW'), 'zh-TW');
    assert.equal(localeToLanguage('fr'), 'fr');
    assert.equal(localeToLanguage(undefined), 'en');
});

test('languages are found by code or name, and autocomplete puts the best matches first', () => {
    assert.equal(findLanguage('ja', FALLBACK_LANGUAGES)?.name, 'Japanese');
    assert.equal(findLanguage('  GERMAN ', FALLBACK_LANGUAGES)?.code, 'de');
    assert.equal(findLanguage('Klingon', FALLBACK_LANGUAGES), null);

    const choices = matchLanguages('chi', FALLBACK_LANGUAGES);
    assert.deepEqual(
        choices.map((choice) => choice.value),
        ['zh-CN', 'zh-TW']
    );
    assert.equal(matchLanguages('', FALLBACK_LANGUAGES).length, 25);
    assert.equal(languageName('zh', FALLBACK_LANGUAGES), 'Chinese (Simplified)');
    assert.equal(languageName('xx', FALLBACK_LANGUAGES), 'xx');
});

test('the same language is spotted, but Chinese variants are different', () => {
    assert.equal(isSameLanguage('en', 'en'), true);
    assert.equal(isSameLanguage('en', 'en-GB'), true);
    assert.equal(isSameLanguage('zh-CN', 'zh-TW'), false);
    assert.equal(isSameLanguage('es', 'en'), false);
});

test('translating sends the key in a header, never the URL', async () => {
    respondWith(200, { data: { translations: [{ translatedText: 'Hello', detectedSourceLanguage: 'es' }] } });

    const result = await translateText('Hola', 'en');

    assert.deepEqual(result, { text: 'Hello', from: 'es' });
    const [{ url, init }] = requests;
    assert.ok(!url.includes('test-key'));
    assert.equal(/** @type {any} */ (init.headers)['X-Goog-Api-Key'], 'test-key');
    assert.deepEqual(JSON.parse(String(init.body)), { q: 'Hola', target: 'en', format: 'text' });
});

test('a chosen source language is sent, and returned as the source', async () => {
    respondWith(200, { data: { translations: [{ translatedText: 'Hello' }] } });
    const result = await translateText('Hola', 'en', 'es');
    assert.equal(result.from, 'es');
    assert.equal(JSON.parse(String(requests[0].init.body)).source, 'es');
});

test('Google errors are sorted into reasons the reply can explain', async () => {
    const reasonFor = async (status, error) => {
        respondWith(status, { error });
        try {
            await translateText('Hola', 'en');
            return 'no error';
        } catch (caught) {
            assert.ok(caught instanceof TranslateError);
            return caught.reason;
        }
    };

    assert.equal(await reasonFor(429, { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' }), 'limit');
    assert.equal(await reasonFor(403, { message: 'Daily Limit', errors: [{ reason: 'dailyLimitExceeded' }] }), 'limit');
    assert.equal(await reasonFor(400, { message: 'Invalid Value: target language' }), 'bad_language');
    assert.equal(await reasonFor(500, { message: 'Backend Error' }), 'failed');
});

test('without a key nothing is sent to Google', async () => {
    ENV.TRANSLATE_API_KEY = null;
    respondWith(200, {});
    await assert.rejects(translateText('Hola', 'en'), { reason: 'not_configured' });
    assert.deepEqual(await listLanguages(), [...FALLBACK_LANGUAGES]);
    assert.equal(requests.length, 0);
});

test("Google's language list is loaded once, and the built-in list is used if it can't be", async () => {
    respondWith(200, {
        data: {
            languages: [
                { language: 'fr', name: 'French' },
                { language: 'cy', name: 'Welsh' },
            ],
        },
    });
    const languages = await listLanguages();
    await listLanguages();
    assert.deepEqual(
        languages.map((language) => language.code),
        ['fr', 'cy']
    );
    assert.equal(requests.length, 1);

    resetLanguageCache();
    respondWith(500, { error: { message: 'down' } });
    assert.deepEqual(await listLanguages(), [...FALLBACK_LANGUAGES]);
});

test('a message is translated from its text, or its embed when it has none', () => {
    assert.equal(messageText(/** @type {any} */ ({ content: 'Bonjour', embeds: [] })), 'Bonjour');
    assert.equal(
        messageText(/** @type {any} */ ({ content: '', embeds: [{ title: 'Titre', description: 'Texte' }] })),
        'Titre\nTexte'
    );
    assert.equal(messageText(/** @type {any} */ ({ content: '   ', embeds: [] })), '');
});

test('both commands work in servers, DMs and group chats, installed to a server or an account', () => {
    for (const data of [slashData, menuData]) {
        const json = data.toJSON();
        assert.deepEqual(json.integration_types, [
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
        ]);
        assert.deepEqual(json.contexts, [
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        ]);
    }
    assert.deepEqual(meta.privateOptions, ['text']);
});
