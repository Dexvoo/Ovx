import './helpers/setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const featuresDir = fileURLToPath(new URL('../src/features', import.meta.url));

/** Every slash command name, read from the commands folders the bot loads. */
async function commandNames() {
    const names = [];
    for (const feature of fs.readdirSync(featuresDir)) {
        const dir = path.join(featuresDir, feature, 'commands');
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
            const { commandData } = await import(new URL(`file:///${path.join(dir, file)}`).href);
            names.push(commandData.name);
        }
    }
    return names.sort();
}

const subcommands = (commandData) => commandData.toJSON().options.map((option) => option.name);

test('settings are changed on the dashboard, so there are no settings commands', async () => {
    const names = await commandNames();
    for (const removed of ['logs', 'autorole', 'welcome', 'goodbye', 'streams']) {
        assert.ok(!names.includes(removed), `/${removed} should not exist`);
    }
    assert.ok(names.includes('dashboard'));
});

test('/level and /ticket only keep the commands members and staff use', async () => {
    const level = await import('../src/features/levels/commands/level.js');
    assert.deepEqual(subcommands(level.commandData), ['rank', 'leaderboard']);

    const ticket = await import('../src/features/tickets/commands/ticket.js');
    assert.deepEqual(subcommands(ticket.commandData), ['close', 'add', 'remove', 'lock', 'unlock', 'claim', 'rename']);
});
