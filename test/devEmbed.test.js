import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { EmbedBuilder } from 'discord.js';
import { stubEnvironment } from './helpers/env.js';

/** @type {typeof import('../src/shared/utils/embed.js').DevEmbed} */
let DevEmbed;

const DEV_GUILD_ID = '1503593846406123672';
const DEV_LOG_CHANNEL_ID = '1503593846406123673';

before(async () => {
    // embed.js reads the environment module, which exits if required variables are missing
    stubEnvironment({ DEV_GUILD_ID, COMMAND_CID: DEV_LOG_CHANNEL_ID });

    ({ DevEmbed } = await import('../src/shared/utils/embed.js'));
});

/** A client that holds the dev guild with one text channel, recording what gets sent. */
function makeClient(sent) {
    const channel = { isTextBased: () => true, send: async (payload) => sent.push(payload) };
    const guild = { channels: { cache: new Map([[DEV_LOG_CHANNEL_ID, channel]]) } };
    return { guilds: { cache: new Map([[DEV_GUILD_ID, guild]]) } };
}

test('sends directly when the bot is not sharded', async () => {
    const sent = [];
    await DevEmbed('command', makeClient(sent), new EmbedBuilder().setDescription('hi'));

    assert.equal(sent.length, 1);
    assert.equal(sent[0].embeds[0].description, 'hi');
});

test('targets only the shard that hosts the dev guild', async () => {
    const sent = [];
    const shardClient = makeClient(sent);
    let targeted;

    const client = {
        shard: {
            count: 4,
            // Simulates discord.js running the function on the requested shard
            broadcastEval: async (fn, { context, shard }) => {
                targeted = shard;
                return fn(shardClient, context);
            },
        },
    };

    await DevEmbed('command', client, new EmbedBuilder().setDescription('sharded'));

    // Discord's rule: shard = (guild_id >> 22) % shard_count
    assert.equal(targeted, Number((BigInt(DEV_GUILD_ID) >> 22n) % 4n));
    assert.equal(sent[0].embeds[0].description, 'sharded');
});
