import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { stubEnvironment } from './helpers/env.js';

const DEV_GUILD = '400000000000000077';
const ERROR_CHANNEL = '500000000000000077';

/** @type {typeof import('../src/shared/utils/errorReport.js')} */
let errorReport;

before(async () => {
    stubEnvironment({ DEV_GUILD_ID: DEV_GUILD, ERROR_CID: ERROR_CHANNEL });
    errorReport = await import('../src/shared/utils/errorReport.js');
});

beforeEach(() => errorReport.resetErrorReports());

/** A client in the dev server, recording what is posted in the error channel. */
function fakeClient() {
    const posted = [];
    const channel = { isTextBased: () => true, send: async (message) => posted.push(message.embeds[0]) };
    const guild = { channels: { cache: new Map([[ERROR_CHANNEL, channel]]) } };
    return { client: { guilds: { cache: new Map([[DEV_GUILD, guild]]) } }, posted };
}

test('the same error from the same place is posted once, then counted', () => {
    const { shouldReport } = errorReport;
    const start = 1_000_000;
    assert.deepEqual(shouldReport('/level rank|boom', start), { send: true, heldBack: 0 });
    assert.equal(shouldReport('/level rank|boom', start + 1000).send, false);
    assert.equal(shouldReport('/level rank|boom', start + 2000).send, false);
    assert.equal(shouldReport('/ping|boom', start + 2000).send, true, 'a different place is its own report');

    // After the window it's posted again, saying how often it happened in between
    assert.deepEqual(shouldReport('/level rank|boom', start + 11 * 60_000), { send: true, heldBack: 2 });
});

test('at most 10 reports a minute, so a broken feature cannot flood the channel', () => {
    const { shouldReport } = errorReport;
    const sent = Array.from({ length: 15 }, (_, i) => shouldReport(`event ${i}|boom`, 5000).send);
    assert.equal(sent.filter(Boolean).length, 10);
    assert.equal(shouldReport('event 99|boom', 5000 + 61_000).send, true, 'the next minute starts fresh');
});

test('a report shows where it happened, the server, the user and the stack', async () => {
    const { client, posted } = fakeClient();
    const error = new Error('Missing Permissions');
    await errorReport.reportError(/** @type {any} */ (client), {
        source: '/moderation ban',
        error,
        guild: /** @type {any} */ ({ id: '1', name: 'Drift Kings' }),
        user: /** @type {any} */ ({ id: '2', username: 'dexvo' }),
    });

    const embed = posted[0].data ?? posted[0];
    assert.match(embed.title, /^Error \| Shard #0/);
    assert.match(embed.description, /Missing Permissions/);
    const fields = Object.fromEntries(embed.fields.map((field) => [field.name, field.value]));
    assert.equal(fields.Where, '/moderation ban');
    assert.equal(fields.Server, 'Drift Kings (1)');
    assert.equal(fields.User, '@dexvo (2)');
});

test('reporting never throws, even when the error channel is missing', async () => {
    const client = { guilds: { cache: new Map() } };
    await errorReport.reportError(/** @type {any} */ (client), { source: 'test', error: 'not even an Error' });
});
