import './helpers/setupEnv.js';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PermissionFlagsBits } from 'discord.js';
import {
    commandBlocker,
    commandList,
    validateCommandSettings,
    describeCommandChanges,
} from '../src/features/commandSettings/utils/commandSettings.js';
import { categoryCommands } from '../src/features/utility/utils/help.js';

const CHANNEL = '500000000000000001';
const THREAD_PARENT = '500000000000000002';
const ROLE = '600000000000000001';

/** A command used by a member. */
function use(commandName, { admin = false, channelId = 'other', parentId = null, roles = [] } = {}) {
    return /** @type {any} */ ({
        commandName,
        channelId,
        channel: { isThread: () => Boolean(parentId), parentId },
        memberPermissions: { has: (flag) => admin && flag === PermissionFlagsBits.ManageGuild },
        member: { roles: { cache: new Map(roles.map((id) => [id, {}])) } },
    });
}

const settings = {
    guildId: 'g',
    disabled: ['translate'],
    rules: {
        level: { channelIds: [CHANNEL, THREAD_PARENT], roleIds: [] },
        giveaway: { channelIds: [], roleIds: [ROLE] },
    },
};

test('turned-off commands and limits apply, but never to members with Manage Server', () => {
    assert.deepEqual(commandBlocker(use('translate'), settings), { key: 'off' });
    assert.equal(commandBlocker(use('translate', { admin: true }), settings), null, 'admins always pass');

    assert.equal(commandBlocker(use('level', { channelId: 'other' }), settings).key, 'wrong_channel');
    assert.equal(commandBlocker(use('level', { channelId: CHANNEL }), settings), null);
    assert.equal(
        commandBlocker(use('level', { channelId: 'thread', parentId: THREAD_PARENT }), settings),
        null,
        'a thread counts as its channel'
    );

    assert.equal(commandBlocker(use('giveaway'), settings).key, 'missing_role');
    assert.equal(commandBlocker(use('giveaway', { roles: [ROLE] }), settings), null);
    assert.equal(commandBlocker(use('avatar'), settings), null, 'no settings: allowed');
});

test('settings: unknown commands are dropped, and missing channels or roles are reported', () => {
    const guild = /** @type {any} */ ({ channelIds: new Set([CHANNEL]), roles: new Map([[ROLE, {}]]) });
    const names = new Set(['level', 'translate']);
    const { settings: valid, errors } = validateCommandSettings(
        {
            disabled: ['translate', 'translate', 'made-up'],
            rules: {
                level: { channelIds: [CHANNEL], roleIds: [] },
                'made-up': { channelIds: [CHANNEL] },
                translate: { channelIds: [], roleIds: [] },
            },
        },
        guild,
        names
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(valid.disabled, ['translate']);
    assert.deepEqual(Object.keys(valid.rules), ['level'], 'empty rules and unknown commands are left out');

    assert.ok(
        validateCommandSettings({ rules: { level: { channelIds: ['gone'] } } }, guild, names).errors[0].includes(
            'no longer exists'
        )
    );
});

test('changes are described for the Web Logs', () => {
    const names = { channel: () => '#bots', role: () => '@Staff' };
    const before = { disabled: [], rules: {} };
    const after = { disabled: ['translate'], rules: { level: { channelIds: [CHANNEL], roleIds: [] } } };
    assert.deepEqual(describeCommandChanges(before, after, names), [
        'Turned off /translate',
        '/level: anywhere, for anyone → in #bots',
    ]);
});

/** Every command, loaded the way the bot loads them */
const commands = new Map();
before(async () => {
    const featuresDir = fileURLToPath(new URL('../src/features', import.meta.url));
    for (const feature of fs.readdirSync(featuresDir)) {
        const dir = path.join(featuresDir, feature, 'commands');
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
            const filePath = pathToFileURL(path.join(dir, file)).href;
            const imported = await import(filePath);
            commands.set(imported.commandData.name, {
                ...imported,
                meta: { developerOnly: false, ...imported.meta },
                filePath,
            });
        }
    }
});

test('the Commands page lists every command except developer tools, menus marked', () => {
    const list = commandList(/** @type {any} */ ({ commands }));
    const names = list.map((command) => command.name);
    assert.ok(names.includes('level'));
    assert.ok(!names.includes('premium') && !names.includes('backup'), 'developer tools are hidden');
    const menu = list.find((command) => command.name === 'Translate');
    assert.equal(menu.menu, true);
    assert.ok(
        list.every((command) => command.category),
        'every command has a category'
    );
});

test('/help leaves out commands the server turned off', () => {
    const shown = categoryCommands(commands.values(), 'translate', null, new Set(['translate']));
    assert.deepEqual(
        shown.map((command) => command.commandData.name),
        ['Translate']
    );
});
