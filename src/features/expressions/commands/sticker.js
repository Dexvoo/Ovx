import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import {
    freeStickerSlots,
    attachmentProblem,
    apiErrorKey,
    canCopySticker,
    STICKER_FILE_MAX_BYTES,
} from '../utils/expressions.js';
import { listPage } from '../utils/list.js';
import { auditReason } from '../../moderation/utils/checks.js';

const NAME_MAX = 30;
const DESCRIPTION_MAX = 100;
/** How far back /sticker take looks for a sticker when no link is given. */
const RECENT_MESSAGES = 50;
const MESSAGE_LINK = /discord(?:app)?\.com\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/;

export const commandData = new SlashCommandBuilder();
commandData.setName('sticker');
commandData.setDescription("Take, edit, delete and list this server's stickers.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addSubcommand((sub) =>
    sub
        .setName('take')
        .setDescription('Add a sticker from a message, or upload an image.')
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Link to a message with the sticker (default: the latest one sent here).')
                .setMaxLength(200)
        )
        .addAttachmentOption((option) =>
            option.setName('image').setDescription('Or upload a 320×320 PNG, APNG or GIF (up to 512 KB).')
        )
        .addStringOption((option) =>
            option.setName('name').setDescription('Name for the new sticker.').setMinLength(2).setMaxLength(NAME_MAX)
        )
        .addStringOption((option) =>
            option
                .setName('emoji')
                .setDescription('An emoji that matches it, used for suggestions (e.g. 😂).')
                .setMaxLength(50)
        )
        .addStringOption((option) =>
            option.setName('description').setDescription('What the sticker shows.').setMaxLength(DESCRIPTION_MAX)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('edit')
        .setDescription("Change a sticker's name, emoji or description.")
        .addStringOption((option) =>
            option.setName('sticker').setDescription('The sticker to edit.').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((option) =>
            option.setName('name').setDescription('Its new name.').setMinLength(2).setMaxLength(NAME_MAX)
        )
        .addStringOption((option) =>
            option.setName('emoji').setDescription('A new matching emoji (e.g. 😂).').setMaxLength(50)
        )
        .addStringOption((option) =>
            option.setName('description').setDescription('Its new description.').setMaxLength(DESCRIPTION_MAX)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('delete')
        .setDescription('Delete a sticker from this server.')
        .addStringOption((option) =>
            option.setName('sticker').setDescription('The sticker to delete.').setRequired(true).setAutocomplete(true)
        )
);
commandData.addSubcommand((sub) => sub.setName('list').setDescription("See this server's stickers."));

export const meta = {
    cooldown: 5,
    developerOnly: false,
    botPermissions: [PermissionFlagsBits.ManageGuildExpressions],
    userPermissions: [PermissionFlagsBits.ManageGuildExpressions],
};

/**
 * @param {import('discord.js').AutocompleteInteraction<'cached'>} interaction
 */
export async function autocomplete(interaction) {
    const typed = String(interaction.options.getFocused()).trim().toLowerCase();
    const choices = [...interaction.guild.stickers.cache.values()]
        .filter((sticker) => !typed || sticker.name.toLowerCase().includes(typed))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map((sticker) => ({ name: sticker.name, value: sticker.id }));
    await interaction.respond(choices);
}

/**
 * A name Discord accepts for a sticker: 2–30 characters (spaces are fine, unlike emoji names).
 * @param {string} name
 */
export function stickerName(name) {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
    return trimmed.length >= 2 ? trimmed : 'sticker';
}

/**
 * A sticker's matching emoji, as Discord stores it: a unicode emoji, or a custom emoji's name.
 * @param {string | null} input
 */
export function stickerTag(input) {
    if (!input?.trim()) return null;
    const custom = input.match(/<a?:(\w+):\d+>/);
    return (custom ? custom[1] : input.trim().replace(/^:|:$/g, '')).slice(0, 200);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 */
export async function execute(interaction) {
    const { client, options, guild, locale } = interaction;
    const t = (key, vars) => client.utils.Translate(`commands.expressions.${key}`, locale, vars);
    const errorTitle = client.utils.Translate('errors.title', locale);
    const fail = (key, vars) =>
        client.utils.Embed(interaction, 'Red', errorTitle, t(`errors.${key}`, vars), { flags: MessageFlags.Ephemeral });

    const subcommand = options.getSubcommand();
    if (subcommand === 'list') {
        return interaction.reply({ ...(await listPage(guild, 'sticker', 0, locale)), flags: MessageFlags.Ephemeral });
    }

    try {
        if (subcommand === 'take') return await take(interaction, t, fail);

        const input = options.getString('sticker', true).trim();
        const sticker =
            guild.stickers.cache.get(input) ??
            guild.stickers.cache.find((item) => item.name.toLowerCase() === input.toLowerCase());
        if (!sticker) return fail('unknown_sticker');

        if (subcommand === 'edit') {
            const name = options.getString('name');
            const tags = stickerTag(options.getString('emoji'));
            const description = options.getString('description');
            if (!name && !tags && description === null) return fail('edit_nothing');
            if (description && description.length < 2) return fail('description_short');

            await sticker.edit({
                ...(name && { name: stickerName(name) }),
                ...(tags && { tags }),
                ...(description !== null && { description }),
                reason: auditReason(interaction.user, 'Edited with /sticker edit'),
            });
            return client.utils.Embed(
                interaction,
                'Green',
                t('sticker.edited_title'),
                t('sticker.edited', { name: sticker.name }),
                {
                    flags: MessageFlags.Ephemeral,
                }
            );
        }
        if (subcommand === 'delete') {
            const name = sticker.name;
            await sticker.delete(auditReason(interaction.user, 'Deleted with /sticker delete'));
            return client.utils.Embed(
                interaction,
                'Green',
                t('sticker.deleted_title'),
                t('sticker.deleted', { name }),
                {
                    flags: MessageFlags.Ephemeral,
                }
            );
        }
    } catch (error) {
        const key = apiErrorKey(error);
        if (key) return fail(key);
        throw error;
    }
}

/**
 * Finds the sticker to copy: from a message link, or the latest sticker sent in this channel.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @returns {Promise<{ sticker: import('discord.js').Sticker } | { error: string }>}
 */
async function findSticker(interaction) {
    const link = interaction.options.getString('message');
    if (link) {
        const match = link.match(MESSAGE_LINK);
        if (!match) return { error: 'bad_link' };
        const channel = await interaction.client.channels.fetch(match[2]).catch(() => null);
        const message = channel?.isTextBased() ? await channel.messages.fetch(match[3]).catch(() => null) : null;
        if (!message) return { error: 'link_unreachable' };
        const sticker = message.stickers.first();
        return sticker ? { sticker } : { error: 'no_sticker_in_message' };
    }

    const recent = await interaction.channel?.messages.fetch({ limit: RECENT_MESSAGES }).catch(() => null);
    const message = recent?.find((item) => item.stickers.size > 0);
    return message ? { sticker: message.stickers.first() } : { error: 'no_recent_sticker' };
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {(key: string, vars?: object) => string} t
 * @param {(key: string, vars?: object) => Promise<unknown>} fail
 */
async function take(interaction, t, fail) {
    const { client, options, guild } = interaction;
    const slots = freeStickerSlots(guild);
    if (slots.free === 0) return fail('sticker_slots_full', { limit: slots.limit });

    const image = options.getAttachment('image');
    let file;
    let name = options.getString('name');
    let tags = stickerTag(options.getString('emoji'));
    const description = options.getString('description');
    if (description && description.length < 2) return fail('description_short');

    if (image) {
        const problem = attachmentProblem(image, STICKER_FILE_MAX_BYTES);
        if (problem) return fail(problem === 'too_big' ? 'sticker_too_big' : problem);
        file = image.url;
        name ??= image.name.replace(/\.[^.]+$/, '');
    } else {
        const found = await findSticker(interaction);
        if ('error' in found) return fail(found.error);
        if (!canCopySticker(found.sticker.format)) return fail('sticker_not_copyable');
        if (guild.stickers.cache.has(found.sticker.id)) return fail('sticker_here');
        file = found.sticker.url;
        name ??= found.sticker.name;
        // A sticker's emoji often isn't sent with it, so fetch the full sticker for its tags
        if (!tags) tags = (await found.sticker.fetch().catch(() => null))?.tags ?? null;
    }

    await interaction.deferReply();
    const created = await guild.stickers.create({
        file,
        name: stickerName(name),
        tags: tags || '⭐',
        description: description ?? '',
        reason: auditReason(interaction.user, 'Added with /sticker take'),
    });
    return client.utils.Embed(
        interaction,
        'Green',
        t('sticker.added_title'),
        t('sticker.added', { name: created.name }),
        {
            thumbnail: created.url,
        }
    );
}
