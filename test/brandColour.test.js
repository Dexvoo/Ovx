import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { stubEnvironment } from './helpers/env.js';
import Guild_Settings_Cache, { brandColour, DEFAULT_EMBED_COLOUR } from '../src/shared/cache/guildSettings.cache.js';

/** @type {typeof import('../src/shared/utils/embed.js').Embed} */
let Embed;
let settings;

before(async () => {
    // embed.js reads the environment module, which exits if required variables are missing
    stubEnvironment({});
    ({ Embed } = await import('../src/shared/utils/embed.js'));
});

beforeEach(() => {
    settings = {};
    Guild_Settings_Cache.get = async (guildId) => ({ guildId, embedColour: null, bio: null, ...settings[guildId] });
});

/** A text channel in a guild that records what gets sent. */
function channelIn(guildId, sent) {
    return { guild: { id: guildId }, guildId, client: {}, send: async (payload) => sent.push(payload) };
}

test('Brand embeds use the colour the server chose', async () => {
    settings.g1 = { embedColour: '#ff00aa' };
    const sent = [];
    await Embed(channelIn('g1', sent), 'Brand', 'Title', 'Text');
    assert.equal(sent[0].embeds[0].data.color, 0xff00aa);
});

test('Brand embeds use the default purple when no colour is chosen, or outside servers', async () => {
    const sent = [];
    await Embed(channelIn('g2', sent), 'Brand', 'Title', 'Text');
    assert.equal(sent[0].embeds[0].data.color, parseInt(DEFAULT_EMBED_COLOUR.slice(1), 16));

    assert.equal(await brandColour(null), DEFAULT_EMBED_COLOUR, 'DMs have no server settings');
});

test('other colours are left as they are', async () => {
    settings.g1 = { embedColour: '#ff00aa' };
    const sent = [];
    await Embed(channelIn('g1', sent), 'Red', 'Error', 'Text');
    assert.equal(sent[0].embeds[0].data.color, 0xed4245);
});
