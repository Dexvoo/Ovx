import './helpers/setupEnv.js';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { InteractionContextType } from 'discord.js';
import {
    CATEGORIES,
    featureOf,
    categoryCommands,
    commandEntries,
    mention,
    permissionNames,
    overviewPage,
    categoryPage,
    commandPage,
} from '../src/features/utility/utils/help.js';
import { Translate } from '../src/shared/utils/i18n.js';

const featuresDir = fileURLToPath(new URL('../src/features', import.meta.url));
/** @type {Map<string, any>} */
const commands = new Map();

// Every command, loaded the way the bot loads them
before(async () => {
    for (const feature of fs.readdirSync(featuresDir)) {
        const dir = path.join(featuresDir, feature, 'commands');
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
            const filePath = pathToFileURL(path.join(dir, file)).href;
            const imported = await import(filePath);
            commands.set(imported.commandData.name, {
                ...imported,
                meta: { cooldown: 5, developerOnly: false, ...imported.meta },
                filePath,
            });
        }
    }
});

const client = () =>
    /** @type {any} */ ({ commands, user: { displayAvatarURL: () => 'https://cdn.discordapp.com/x.png' } });
const help = (context, ids = new Map()) => ({ locale: 'en-GB', guildId: null, context, ids });

test('every feature with commands is in a help category, so new commands show up', () => {
    const covered = new Set(CATEGORIES.flatMap((category) => category.features));
    for (const command of commands.values()) {
        const feature = featureOf(command);
        if (feature === 'developer') continue;
        assert.ok(covered.has(feature), `/${command.commandData.name} (${feature}) is not in any /help category`);
    }
});

test('every category has its text', () => {
    for (const { id } of CATEGORIES) {
        for (const key of ['name', 'short', 'long']) {
            const fullKey = `commands.help.categories.${id}.${key}`;
            assert.notEqual(Translate(fullKey, 'en-GB'), fullKey, `missing ${fullKey}`);
        }
    }
});

test('the feature comes from the command file, on Windows too', () => {
    assert.equal(
        featureOf(/** @type {any} */ ({ filePath: 'file:///D:/Bots/src/features/levels/commands/level.js' })),
        'levels'
    );
    assert.equal(
        featureOf(/** @type {any} */ ({ filePath: 'D:\\Bots\\src\\features\\tickets\\commands\\ticket.js' })),
        'tickets'
    );
});

test('in DMs only commands that work there are listed, and developer tools never are', () => {
    const inDms = CATEGORIES.flatMap((category) =>
        categoryCommands(commands.values(), category.id, InteractionContextType.BotDM)
    );
    const names = inDms.map((command) => command.commandData.name);
    assert.ok(names.includes('translate'));
    assert.ok(!names.includes('moderation'), 'server-only commands are hidden in DMs');

    const everywhere = CATEGORIES.flatMap((category) => categoryCommands(commands.values(), category.id, null));
    assert.ok(!everywhere.some((command) => featureOf(command) === 'developer'));
});

test('subcommands are listed one by one, as clickable mentions when the ID is known', () => {
    const entries = commandEntries(commands.get('level').commandData.toJSON());
    assert.deepEqual(
        entries.map((entry) => entry.path),
        ['level rank', 'level leaderboard']
    );
    assert.equal(mention(new Map([['level', '123']]), 'level rank'), '</level rank:123>');
    assert.equal(mention(new Map(), 'level rank'), '`/level rank`');
    assert.deepEqual(permissionNames(String(0x20n)), ['Manage Server']);
    assert.deepEqual(permissionNames(null), []);
});

test('the pages build, with the category menu and links', async () => {
    const overview = await overviewPage(client(), help(InteractionContextType.Guild), { canManage: true });
    const [menuRow, linkRow] = overview.components;
    const values = menuRow.components[0].options.map((option) => option.data.value);
    assert.equal(values[0], 'overview');
    assert.ok(values.includes('moderation'));
    assert.ok(linkRow.components.length >= 3);

    const dmOverview = await overviewPage(client(), help(InteractionContextType.BotDM), { canManage: false });
    const dmValues = dmOverview.components[0].components[0].options.map((option) => option.data.value);
    assert.ok(!dmValues.includes('moderation'), 'categories with nothing usable in DMs are hidden');

    const translate = await categoryPage(client(), help(null, new Map([['translate', '9']])), 'translate');
    const text = translate.embeds[0].data.description;
    assert.match(text, /<\/translate:9>/);
    assert.match(text, /\*\*Translate\*\*: right-click a message, then Apps/);
    assert.equal(await categoryPage(client(), help(null), 'nope'), null);

    const giveaway = await commandPage(commands.get('giveaway'), help(InteractionContextType.Guild));
    assert.match(giveaway.embeds[0].data.description, /`prize` \(required\)/);
    assert.ok(giveaway.embeds[0].data.description.length <= 4096);
});

test('every category page fits in a Discord embed', async () => {
    for (const { id } of CATEGORIES) {
        const page = await categoryPage(client(), help(null), id);
        assert.ok(page.embeds[0].data.description.length <= 4096, id);
    }
});
