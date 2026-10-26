import {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import {
    parseCustomEmojis,
    emojiImageUrl,
    cleanName,
    freeEmojiSlots,
    attachmentProblem,
    apiErrorKey,
    TAKE_MAX,
    EMOJI_FILE_MAX_BYTES,
} from '../utils/expressions.js';
import { listPage } from '../utils/list.js';
import { auditReason } from '../../moderation/utils/checks.js';

export const commandData = new SlashCommandBuilder();
commandData.setName('emoji');
commandData.setDescription("Take, rename, delete and list this server's emojis.");
commandData.setIntegrationTypes([ApplicationIntegrationType.GuildInstall]);
commandData.setContexts([InteractionContextType.Guild]);
commandData.addSubcommand((sub) =>
    sub
        .setName('take')
        .setDescription('Add emojis from another server (paste them), or upload an image.')
        .addStringOption((option) =>
            option.setName('emojis').setDescription(`Paste up to ${TAKE_MAX} custom emojis.`).setMaxLength(1000)
        )
        .addAttachmentOption((option) => option.setName('image').setDescription('Or upload an image (up to 256 KB).'))
        .addStringOption((option) =>
            option
                .setName('name')
                .setDescription('Name for the new emoji (when adding just one).')
                .setMinLength(2)
                .setMaxLength(32)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('edit')
        .setDescription('Rename an emoji.')
        .addStringOption((option) =>
            option.setName('emoji').setDescription('The emoji to rename.').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((option) =>
            option.setName('name').setDescription('Its new name.').setRequired(true).setMinLength(2).setMaxLength(32)
        )
);
commandData.addSubcommand((sub) =>
    sub
        .setName('delete')
        .setDescription('Delete an emoji from this server.')
        .addStringOption((option) =>
            option.setName('emoji').setDescription('The emoji to delete.').setRequired(true).setAutocomplete(true)
        )
);
commandData.addSubcommand((sub) => sub.setName('list').setDescription("See this server's emojis."));

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
    const choices = [...interaction.guild.emojis.cache.values()]
        .filter((emoji) => !typed || emoji.name.toLowerCase().includes(typed))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map((emoji) => ({ name: `:${emoji.name}:${emoji.animated ? ' (animated)' : ''}`, value: emoji.id }));
    await interaction.respond(choices);
}

/**
 * The server emoji someone picked: from autocomplete (an ID), pasted, or typed by name.
 * @param {import('discord.js').Guild} guild
 * @param {string} input
 */
export function findServerEmoji(guild, input) {
    const pastedId = parseCustomEmojis(input)[0]?.id;
    const wanted = input.trim().replace(/^:|:$/g, '').toLowerCase();
    return (
        guild.emojis.cache.get(pastedId ?? input.trim()) ??
        guild.emojis.cache.find((emoji) => emoji.name.toLowerCase() === wanted) ??
        null
    );
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
        return interaction.reply({ ...(await listPage(guild, 'emoji', 0, locale)), flags: MessageFlags.Ephemeral });
    }

    if (subcommand === 'take') return take(interaction, t, fail);

    const emoji = findServerEmoji(guild, options.getString('emoji', true));
    if (!emoji) return fail('unknown_emoji');

    try {
        if (subcommand === 'edit') {
            const name = cleanName(options.getString('name', true));
            const before = emoji.name;
            await emoji.edit({ name, reason: auditReason(interaction.user, 'Renamed with /emoji edit') });
            return client.utils.Embed(
                interaction,
                'Green',
                t('emoji.edited_title'),
                t('emoji.edited', { emoji: `${emoji}`, before, name }),
                {
                    flags: MessageFlags.Ephemeral,
                }
            );
        }
        if (subcommand === 'delete') {
            const name = emoji.name;
            await emoji.delete(auditReason(interaction.user, 'Deleted with /emoji delete'));
            return client.utils.Embed(interaction, 'Green', t('emoji.deleted_title'), t('emoji.deleted', { name }), {
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (error) {
        const key = apiErrorKey(error);
        if (key) return fail(key);
        throw error;
    }
}

/**
 * Adds pasted emojis (from any server) or an uploaded image.
 * @param {import('discord.js').ChatInputCommandInteraction<'cached'>} interaction
 * @param {(key: string, vars?: object) => string} t
 * @param {(key: string, vars?: object) => Promise<unknown>} fail
 */
async function take(interaction, t, fail) {
    const { client, options, guild } = interaction;
    const pasted = parseCustomEmojis(options.getString('emojis') ?? '');
    const image = options.getAttachment('image');
    const name = options.getString('name');

    if (!image && pasted.length === 0) {
        return fail(options.getString('emojis') ? 'no_custom_emojis' : 'take_nothing');
    }
    if (pasted.length > TAKE_MAX) return fail('too_many', { max: TAKE_MAX });
    if (image) {
        const problem = attachmentProblem(image, EMOJI_FILE_MAX_BYTES);
        if (problem) return fail(problem === 'too_big' ? 'emoji_too_big' : problem);
    }

    /** @type {{ source: string, name: string, animated: boolean, id?: string }[]} */
    const wanted = [
        ...pasted.map((emoji) => ({
            id: emoji.id,
            source: emojiImageUrl(emoji),
            name: cleanName(pasted.length === 1 && !image && name ? name : emoji.name),
            animated: emoji.animated,
        })),
        ...(image
            ? [
                  {
                      source: image.url,
                      name: cleanName(name ?? image.name.replace(/\.[^.]+$/, '')),
                      animated: image.contentType?.startsWith('image/gif') ?? false,
                  },
              ]
            : []),
    ];

    await interaction.deferReply();
    const reason = auditReason(interaction.user, 'Added with /emoji take');
    const added = [];
    const skipped = [];

    for (const emoji of wanted) {
        if (emoji.id && guild.emojis.cache.has(emoji.id)) {
            skipped.push(t('emoji.skip_here', { name: emoji.name }));
            continue;
        }
        const slots = freeEmojiSlots(guild);
        if ((emoji.animated ? slots.animated : slots.static) === 0) {
            skipped.push(
                t(emoji.animated ? 'emoji.skip_animated_full' : 'emoji.skip_static_full', {
                    name: emoji.name,
                    limit: slots.limit,
                })
            );
            continue;
        }
        try {
            const created = await guild.emojis.create({ attachment: emoji.source, name: emoji.name, reason });
            added.push(`${created} \`:${created.name}:\``);
        } catch (error) {
            const key = apiErrorKey(error);
            if (!key) client.utils.LogData('Emoji Take', `${guild.name}: ${error.message}`, 'warning');
            skipped.push(t('emoji.skip_failed', { name: emoji.name, reason: t(`errors.${key ?? 'failed'}`) }));
            if (key === 'missing_permissions') break;
        }
    }

    const lines = [
        ...(added.length > 0 ? [t('emoji.added', { count: added.length }), ...added] : []),
        ...(skipped.length > 0 ? ['', t('emoji.skipped'), ...skipped.map((line) => `- ${line}`)] : []),
    ];
    return client.utils.Embed(
        interaction,
        added.length > 0 ? 'Green' : 'Red',
        t(added.length > 0 ? 'emoji.added_title' : 'emoji.none_added_title'),
        lines.join('\n').trim()
    );
}
