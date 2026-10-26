import './helpers/setupEnv.js';
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApplicationCommandOptionType } from 'discord.js';
import { UsageDay } from '../src/features/usage/models/usageDay.js';
import { GuildDeparture } from '../src/features/dataRetention/models/guildDeparture.js';
import { CommandSettings } from '../src/features/commandSettings/models/commandSettings.js';
import { commandKey, recordCommand, recordGuildChange, flushUsage, dayKey } from '../src/features/usage/utils/usage.js';
import { usageReport } from '../src/features/usage/utils/report.js';

const GUILD_A = '400000000000000001';
const GUILD_B = '400000000000000002';

let writes;
beforeEach(async () => {
    writes = [];
    UsageDay.updateOne = /** @type {any} */ (async (filter, update) => writes.push({ filter, update }));
    await flushUsage(); // Start from an empty buffer
    writes = [];
});

const originalDistinct = mongoose.Model.distinct;
after(() => {
    mongoose.Model.distinct = originalDistinct;
});

test('commands are named with their subcommands', () => {
    const { Subcommand, SubcommandGroup, String: Text } = ApplicationCommandOptionType;
    const interaction = (commandName, data) => /** @type {any} */ ({ commandName, options: { data } });

    assert.equal(commandKey(interaction('ping', [])), 'ping');
    assert.equal(
        commandKey(
            interaction('moderation', [{ name: 'ban', type: Subcommand, options: [{ name: 'user', type: 6 }] }])
        ),
        'moderation ban'
    );
    assert.equal(
        commandKey(
            interaction('leveladmin', [
                { name: 'xp', type: SubcommandGroup, options: [{ name: 'add', type: Subcommand, options: [] }] },
            ])
        ),
        'leveladmin xp add'
    );
    assert.equal(commandKey(interaction('translate', [{ name: 'text', type: Text, value: 'hola' }])), 'translate');
    assert.equal(commandKey(/** @type {any} */ ({ commandName: 'Translate', options: undefined })), 'Translate');
});

test('usage is counted in memory and written in one go, without user IDs', async () => {
    recordCommand('moderation ban', GUILD_A);
    recordCommand('moderation ban', GUILD_B);
    recordCommand('help', null);
    recordCommand('odd.name', GUILD_A);
    recordGuildChange('joins');

    const now = new Date('2026-10-13T23:59:00Z');
    assert.equal(await flushUsage(now), true);
    assert.equal(writes.length, 1);
    const { filter, update } = writes[0];
    assert.deepEqual(filter, { day: '2026-10-13' });
    assert.deepEqual(update.$inc, {
        joins: 1,
        leaves: 0,
        'commands.moderation ban': 2,
        'commands.help': 1,
        'commands.odd_name': 1,
    });
    assert.deepEqual(update.$addToSet.guilds.$each.sort(), [GUILD_A, GUILD_B], 'DMs add no server');

    assert.equal(await flushUsage(now), false, 'nothing new to write');
});

test('a failed write keeps the counts for the next try', async () => {
    recordCommand('help', GUILD_A);
    UsageDay.updateOne = /** @type {any} */ (
        async () => {
            throw new Error('offline');
        }
    );
    await assert.rejects(flushUsage());
    recordCommand('help', GUILD_B);

    UsageDay.updateOne = /** @type {any} */ (async (filter, update) => writes.push({ filter, update }));
    await flushUsage();
    assert.equal(writes[0].update.$inc['commands.help'], 2);
});

test('the report fills in quiet days, adds up commands, and leaves out servers that removed Ovx', async () => {
    const now = new Date('2026-10-13T12:00:00Z');
    UsageDay.find = /** @type {any} */ (
        () => ({
            lean: async () => [
                {
                    day: '2026-10-12',
                    commands: { help: 3, 'moderation ban': 1 },
                    guilds: [GUILD_A],
                    joins: 2,
                    leaves: 0,
                },
                { day: '2026-10-13', commands: { help: 1 }, guilds: [GUILD_A, GUILD_B], joins: 0, leaves: 1 },
                { day: '2026-01-01', commands: { old: 99 }, guilds: [], joins: 0, leaves: 0 },
            ],
        })
    );
    GuildDeparture.distinct = /** @type {any} */ (async () => [GUILD_B]);
    const filters = [];
    mongoose.Model.distinct = /** @type {any} */ (
        async function (field, filter) {
            filters.push(filter);
            return [GUILD_A];
        }
    );
    CommandSettings.aggregate = /** @type {any} */ (async () => [{ _id: 'ping', servers: 2 }]);

    const report = await usageReport({ days: 7, now });
    assert.equal(report.daily.length, 7);
    assert.equal(report.daily[0].day, '2026-10-07');
    assert.equal(report.daily[6].day, dayKey(now));
    assert.equal(report.daily[0].uses, 0, 'a day nobody used Ovx');
    assert.deepEqual(report.totals, { uses: 5, activeServers: 2, joins: 2, leaves: 1 });
    assert.deepEqual(report.commands[0], { name: 'help', uses: 4 });
    assert.ok(!report.commands.some((command) => command.name === 'old'), 'outside the window');
    assert.ok(report.features.every((feature) => feature.servers === 1));
    assert.ok(
        filters.every((filter) => filter.guildId.$nin[0] === GUILD_B),
        'removed servers are not counted'
    );
    assert.deepEqual(report.disabledCommands, [{ name: 'ping', servers: 2 }]);

    assert.equal((await usageReport({ days: 12345, now })).days, 30, 'odd windows fall back to 30 days');
});
