import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvironment } from '../src/bootstrap/parseEnvironment.js';

const APP_ID = '100000000000000000';
const DEV_APP_ID = '200000000000000000';
const base = { MONGO_URI: 'mongodb://localhost/test', BOT_TOKEN: 'prod-token', BOT_APPLICATION_ID: APP_ID };

test('production only needs MONGO_URI, BOT_TOKEN and BOT_APPLICATION_ID', () => {
    const { env, errors } = parseEnvironment(base);

    assert.deepEqual(errors, []);
    assert.equal(env.TOKEN, 'prod-token');
    assert.equal(env.APPLICATION_ID, APP_ID);
    assert.equal(env.DEVELOPER_MODE, false);
    assert.equal(env.DEFAULT_LANGUAGE, 'en-GB');
    assert.equal(env.DEV_GUILD_ID, null);
    assert.deepEqual(env.DEVELOPER_IDS, []);
});

test('developer mode uses the dev token and application ID instead', () => {
    const { env, errors } = parseEnvironment({
        MONGO_URI: 'mongodb://localhost/test',
        DEVELOPER_MODE: 'true',
        BOT_TOKEN_DEV: 'dev-token',
        BOT_APPLICATION_ID_DEV: DEV_APP_ID,
    });

    assert.deepEqual(errors, []);
    assert.equal(env.TOKEN, 'dev-token');
    assert.equal(env.APPLICATION_ID, DEV_APP_ID);
});

test('reports every missing required variable for the current mode', () => {
    const { env, errors } = parseEnvironment({ DEVELOPER_MODE: 'true', BOT_TOKEN: 'prod-token' });

    assert.equal(env, null);
    assert.deepEqual(errors, [
        'MONGO_URI is required',
        'BOT_TOKEN_DEV is required',
        'BOT_APPLICATION_ID_DEV is required',
    ]);
});

test("treats empty, whitespace and 'none' as not set", () => {
    const { env } = parseEnvironment({ ...base, DEV_GUILD_ID: 'none', COMMAND_CID: '  ', VOTE_CID: '' });

    assert.equal(env.DEV_GUILD_ID, null);
    assert.equal(env.COMMAND_CID, null);
    assert.equal(env.VOTE_CID, null);
});

test('parses and trims the developer ID list', () => {
    const { env } = parseEnvironment({ ...base, DEVELOPER_IDS: '387341502134878218, 300000000000000000 ,' });
    assert.deepEqual(env.DEVELOPER_IDS, ['387341502134878218', '300000000000000000']);
});

test('rejects IDs that are not Discord IDs, such as placeholders copied from .env.example', () => {
    const { env, errors } = parseEnvironment({
        ...base,
        DEV_GUILD_ID: 'DEV_GUILD_ID',
        DEVELOPER_IDS: '387341502134878218,DEVELOPER_ID_2',
        BOT_APPLICATION_ID: 'BOT_APPLICATION_ID',
    });

    assert.equal(env, null);
    assert.equal(errors.length, 3);
    assert.ok(errors.some((e) => e.startsWith('DEV_GUILD_ID must be a Discord ID')));
    assert.ok(errors.some((e) => e.startsWith('DEVELOPER_IDS must be a Discord ID')));
    assert.ok(errors.some((e) => e.startsWith('BOT_APPLICATION_ID must be a Discord ID')));
});

test('reads JOIN_GUILD_CID without warnings', () => {
    const { env, warnings } = parseEnvironment({ ...base, JOIN_GUILD_CID: '300000000000000000' });
    assert.equal(env.JOIN_GUILD_CID, '300000000000000000');
    assert.deepEqual(warnings, []);
});

test('still accepts the old misspelled JOIN_GUID_CID, with a warning', () => {
    const { env, errors, warnings } = parseEnvironment({ ...base, JOIN_GUID_CID: '300000000000000000' });
    assert.deepEqual(errors, []);
    assert.equal(env.JOIN_GUILD_CID, '300000000000000000');
    assert.deepEqual(warnings, ['JOIN_GUID_CID is deprecated, rename it to JOIN_GUILD_CID']);
});

test('prefers JOIN_GUILD_CID when both names are set', () => {
    const { env, warnings } = parseEnvironment({
        ...base,
        JOIN_GUILD_CID: '300000000000000000',
        JOIN_GUID_CID: '400000000000000000',
    });
    assert.equal(env.JOIN_GUILD_CID, '300000000000000000');
    assert.deepEqual(warnings, []);
});

const dashboardBase = {
    ...base,
    DASHBOARD_ENABLED: 'true',
    BOT_CLIENT_SECRET: 'client-secret',
    SESSION_SECRET: 'x'.repeat(32),
};

test('the dashboard is off, and needs no settings, unless DASHBOARD_ENABLED is true', () => {
    const { env, errors } = parseEnvironment(base);
    assert.deepEqual(errors, []);
    assert.equal(env.DASHBOARD, null);
});

test('dashboard defaults to localhost:3000 over http', () => {
    const { env, errors } = parseEnvironment(dashboardBase);
    assert.deepEqual(errors, []);
    assert.deepEqual(env.DASHBOARD, {
        PORT: 3000,
        HOST: '127.0.0.1',
        URL: 'http://localhost:3000',
        SECURE: false,
        TRUST_PROXY: false,
        CLIENT_SECRET: 'client-secret',
        SESSION_SECRET: 'x'.repeat(32),
    });
});

test('dashboard requires a client secret for the current mode and a long session secret', () => {
    const { errors } = parseEnvironment({ ...base, DASHBOARD_ENABLED: 'true', SESSION_SECRET: 'short' });
    assert.ok(errors.includes('BOT_CLIENT_SECRET is required'));
    assert.ok(errors.some((e) => e.startsWith('SESSION_SECRET must be at least 32 characters')));
});

test('dashboard refuses plain http on a public domain, but allows https', () => {
    const insecure = parseEnvironment({ ...dashboardBase, DASHBOARD_URL: 'http://dash.example.com' });
    assert.ok(insecure.errors.some((e) => e.startsWith('DASHBOARD_URL must use https://')));

    const { env, errors } = parseEnvironment({ ...dashboardBase, DASHBOARD_URL: 'https://dash.example.com/' });
    assert.deepEqual(errors, []);
    assert.equal(env.DASHBOARD.URL, 'https://dash.example.com', 'trailing slash removed');
    assert.equal(env.DASHBOARD.SECURE, true);
});

test('dashboard rejects invalid ports and URLs', () => {
    const { errors } = parseEnvironment({ ...dashboardBase, DASHBOARD_PORT: '99999', DASHBOARD_URL: 'not a url' });
    assert.ok(errors.some((e) => e.startsWith('DASHBOARD_PORT must be a port number')));
    assert.ok(errors.some((e) => e.startsWith('DASHBOARD_URL must be a full URL')));
});

test('stream notification keys: each platform is off until both of its keys are set', () => {
    const { env, warnings } = parseEnvironment({
        ...base,
        TWITCH_CLIENT_ID: 'id',
        TWITCH_CLIENT_SECRET: 'secret',
        KICK_CLIENT_ID: 'only-half',
        YOUTUBE_API_KEY: 'key',
    });
    assert.deepEqual(env.STREAMS, {
        TWITCH: { CLIENT_ID: 'id', CLIENT_SECRET: 'secret' },
        KICK: null,
        YOUTUBE_API_KEY: 'key',
    });
    assert.ok(warnings.some((warning) => warning.includes('KICK_CLIENT_SECRET')));
    assert.deepEqual(parseEnvironment(base).env.STREAMS, { TWITCH: null, KICK: null, YOUTUBE_API_KEY: null });
});

test('the error channel is optional and must be a channel ID', () => {
    assert.equal(parseEnvironment(base).env.ERROR_CID, null);
    assert.equal(parseEnvironment({ ...base, ERROR_CID: '500000000000000077' }).env.ERROR_CID, '500000000000000077');
    assert.ok(parseEnvironment({ ...base, ERROR_CID: 'errors' }).errors.some((error) => error.includes('ERROR_CID')));
});
