import './helpers/setupEnv.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordAPIError, GuildPremiumTier, StickerFormatType } from 'discord.js';
import {
    parseCustomEmojis,
    emojiImageUrl,
    cleanName,
    freeEmojiSlots,
    freeStickerSlots,
    attachmentProblem,
    apiErrorKey,
    canCopySticker,
} from '../src/features/expressions/utils/expressions.js';
import { listPage } from '../src/features/expressions/utils/list.js';
import { execute as emojiCommand, findServerEmoji } from '../src/features/expressions/commands/emoji.js';
import { stickerTag, stickerName } from '../src/features/expressions/commands/sticker.js';
import Guild_Settings_Cache from '../src/shared/cache/guildSettings.cache.js';

beforeEach(() => {
    Guild_Settings_Cache.get = /** @type {any} */ (async () => ({ embedColour: null, premiumUntil: null }));
});

/** A guild with these emojis ({ id, name, animated }) and stickers. */
function fakeGuild({ emojis = [], stickers = [], premiumTier = GuildPremiumTier.None } = {}) {
    const emojiCache = new Map(
        emojis.map((emoji) => [emoji.id, { ...emoji, toString: () => `<:${emoji.name}:${emoji.id}>` }])
    );
    const created = [];
    const collection = (map) =>
        Object.assign(map, {
            filter(fn) {
                return { size: [...map.values()].filter(fn).length };
            },
            find(fn) {
                return [...map.values()].find(fn);
            },
        });
    return {
        created,
        guild: /** @type {any} */ ({
            id: '400000000000000001',
            name: 'Test Server',
            premiumTier,
            emojis: {
                cache: collection(emojiCache),
                create: async (options) => {
                    if (options.name === 'rejected') {
                        throw new DiscordAPIError(
                            { code: 50045, message: 'Asset too large' },
                            50045,
                            400,
                            'POST',
                            '/emojis',
                            {}
                        );
                    }
                    created.push(options);
                    const emoji = {
                        id: `9${created.length}`,
                        name: options.name,
                        toString: () => `<:${options.name}:9>`,
                    };
                    emojiCache.set(emoji.id, emoji);
                    return emoji;
                },
            },
            stickers: { cache: collection(new Map(stickers.map((sticker) => [sticker.id, sticker]))) },
        }),
    };
}

test('custom emojis are found in pasted text, without duplicates or standard emojis', () => {
    const emojis = parseCustomEmojis(
        'look <:blob_wave:111111111111111111> 😀 <a:party:222222222222222222> <:blob_wave:111111111111111111>'
    );
    assert.deepEqual(emojis, [
        { id: '111111111111111111', name: 'blob_wave', animated: false },
        { id: '222222222222222222', name: 'party', animated: true },
    ]);
    assert.equal(
        emojiImageUrl(emojis[1]),
        'https://cdn.discordapp.com/emojis/222222222222222222.gif?size=128&quality=lossless'
    );
});

test('names are made into ones Discord accepts', () => {
    assert.equal(cleanName('party time!'), 'party_time');
    assert.equal(cleanName('a'), 'a_emoji');
    assert.equal(cleanName('!!!'), 'emoji');
    assert.equal(cleanName('x'.repeat(40)).length, 32);
    assert.equal(stickerName('  Happy   cat  '), 'Happy cat');
    assert.equal(stickerName('a'), 'sticker');
    assert.equal(stickerTag('<:blob:123456789012345678>'), 'blob');
    assert.equal(stickerTag('😂'), '😂');
    assert.equal(stickerTag('  '), null);
});

test('free slots depend on boosts, and static and animated emojis are counted apart', () => {
    const { guild } = fakeGuild({
        premiumTier: GuildPremiumTier.Tier1,
        emojis: [
            { id: '1', name: 'a', animated: false },
            { id: '2', name: 'b', animated: true },
            { id: '3', name: 'c', animated: true },
        ],
        stickers: [{ id: 's1', name: 'one' }],
    });
    assert.deepEqual(freeEmojiSlots(guild), { limit: 100, static: 99, animated: 98 });
    assert.deepEqual(freeStickerSlots(guild), { limit: 15, free: 14 });
});

test('uploads must be small images, and Discord errors become messages', () => {
    assert.equal(attachmentProblem(/** @type {any} */ ({ contentType: 'image/png', size: 1000 }), 256 * 1024), null);
    assert.equal(
        attachmentProblem(/** @type {any} */ ({ contentType: 'video/mp4', size: 1000 }), 256 * 1024),
        'not_image'
    );
    assert.equal(
        attachmentProblem(/** @type {any} */ ({ contentType: 'image/gif', size: 300 * 1024 }), 256 * 1024),
        'too_big'
    );

    const apiError = (code) => new DiscordAPIError({ code, message: 'x' }, code, 400, 'POST', '/', {});
    assert.equal(apiErrorKey(apiError(30008)), 'emoji_slots');
    assert.equal(apiErrorKey(apiError(50035)), 'invalid');
    assert.equal(apiErrorKey(apiError(99999)), null);
    assert.equal(apiErrorKey(new Error('network')), null);
    assert.equal(canCopySticker(StickerFormatType.Lottie), false);
    assert.equal(canCopySticker(StickerFormatType.PNG), true);
});

test('an emoji can be picked by ID, by pasting it, or by name', () => {
    const { guild } = fakeGuild({ emojis: [{ id: '123456789012345678', name: 'Wave', animated: false }] });
    assert.equal(findServerEmoji(guild, '123456789012345678')?.name, 'Wave');
    assert.equal(findServerEmoji(guild, '<:Wave:123456789012345678>')?.name, 'Wave');
    assert.equal(findServerEmoji(guild, ':wave:')?.name, 'Wave');
    assert.equal(findServerEmoji(guild, 'nope'), null);
});

/** Runs /emoji take with these options. */
async function take(guild, { emojis = null, name = null, image = null } = {}) {
    const replies = [];
    const interaction = {
        guild,
        locale: 'en-GB',
        user: { username: 'mod' },
        options: {
            getSubcommand: () => 'take',
            getString: (key) => ({ emojis, name })[key] ?? null,
            getAttachment: () => image,
        },
        deferReply: async () => {},
        client: {
            utils: {
                Translate: (key, locale, vars) => `${key.split('.').pop()}${vars ? ` ${JSON.stringify(vars)}` : ''}`,
                Embed: async (target, colour, title, description) => replies.push({ colour, title, description }),
                LogData: () => {},
            },
        },
    };
    await emojiCommand(/** @type {any} */ (interaction));
    return replies;
}

test('/emoji take adds pasted emojis, skipping ones already here, and credits the member', async () => {
    const { guild, created } = fakeGuild({ emojis: [{ id: '111111111111111111', name: 'here', animated: false }] });
    const [reply] = await take(guild, {
        emojis: '<:here:111111111111111111> <:new_one:222222222222222222> <a:dance:333333333333333333>',
    });

    assert.deepEqual(
        created.map((options) => [options.name, options.attachment]),
        [
            ['new_one', 'https://cdn.discordapp.com/emojis/222222222222222222.png?size=128&quality=lossless'],
            ['dance', 'https://cdn.discordapp.com/emojis/333333333333333333.gif?size=128&quality=lossless'],
        ]
    );
    assert.match(created[0].reason, /^By @mod: /);
    assert.equal(reply.colour, 'Green');
    assert.match(reply.description, /skip_here/);
});

test('/emoji take uses the given name for a single emoji, and reports Discord refusing one', async () => {
    const { guild, created } = fakeGuild();
    await take(guild, { emojis: '<:old:222222222222222222>', name: 'fresh name' });
    assert.equal(created[0].name, 'fresh_name');

    const [reply] = await take(guild, { emojis: '<:xy:333333333333333333>', name: 'rejected' });
    assert.equal(reply.colour, 'Red');
    assert.match(reply.description, /too_big/);
});

test('/emoji take stops when the slots are full', async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, name: `e${i}`, animated: false }));
    const { guild, created } = fakeGuild({ emojis: full });
    const [reply] = await take(guild, { emojis: '<:more:222222222222222222> <a:anim:333333333333333333>' });
    assert.deepEqual(
        created.map((options) => options.name),
        ['anim'],
        'animated slots are separate'
    );
    assert.match(reply.description, /skip_static_full/);
});

test('/emoji take explains when only standard emojis were pasted', async () => {
    const { guild } = fakeGuild();
    const [reply] = await take(guild, { emojis: '😀 🎉' });
    assert.match(reply.description, /no_custom_emojis/);
});

test('the emoji list is split into pages with working buttons', async () => {
    const emojis = Array.from({ length: 85 }, (_, i) => ({
        id: `${1000 + i}`,
        name: `e${String(i).padStart(3, '0')}`,
        animated: false,
    }));
    const { guild } = fakeGuild({ emojis });

    const first = await listPage(guild, 'emoji', 0, 'en-GB');
    const [previous, next] = first.components[0].components;
    assert.equal(previous.data.disabled, true);
    assert.equal(next.data.custom_id, 'expressions:list:emoji:1');

    const last = await listPage(guild, 'emoji', 99, 'en-GB');
    assert.match(last.embeds[0].data.footer.text, /3/);
    assert.equal(last.components[0].components[1].data.disabled, true);

    const single = await listPage(fakeGuild().guild, 'sticker', 0, 'en-GB');
    assert.deepEqual(single.components, []);
});
