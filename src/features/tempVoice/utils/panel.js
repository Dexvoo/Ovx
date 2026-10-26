import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { brandColour } from '../../../shared/cache/guildSettings.cache.js';
import { Translate } from '../../../shared/utils/i18n.js';

/** Control panel buttons: `tv:<action>`. The channel is the one the panel is in. */
export const TEMP_VOICE_PREFIX = 'tv:';
export const PANEL_ACTIONS = Object.freeze(['rename', 'limit', 'lock', 'hide', 'kick', 'transfer', 'claim']);

/**
 * Whether @everyone is kept out (locked) or can't see the channel (hidden).
 * @param {import('discord.js').VoiceBasedChannel} channel
 */
export function channelState(channel) {
    const everyone = channel.permissionOverwrites.cache.get(channel.guild.id);
    return {
        locked: Boolean(everyone?.deny.has(PermissionFlagsBits.Connect)),
        hidden: Boolean(everyone?.deny.has(PermissionFlagsBits.ViewChannel)),
    };
}

/**
 * The control panel posted in a join-to-create channel's chat.
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {string} ownerId
 * @returns {Promise<import('discord.js').MessageCreateOptions & import('discord.js').MessageEditOptions>}
 */
export async function controlPanel(channel, ownerId) {
    const locale = channel.guild.preferredLocale;
    const t = (key, vars) => Translate(`tempVoice.panel.${key}`, locale, vars);
    const { locked, hidden } = channelState(channel);

    const embed = new EmbedBuilder()
        .setColor(await brandColour(channel.guild.id))
        .setTitle(t('title'))
        .setDescription([t('owner', { owner: `<@${ownerId}>` }), '', t('help')].join('\n'));

    const button = (action, label, emoji, style = ButtonStyle.Secondary) =>
        new ButtonBuilder()
            .setCustomId(`${TEMP_VOICE_PREFIX}${action}`)
            .setLabel(label)
            .setEmoji(emoji)
            .setStyle(style);

    const rows = [
        /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
            button('rename', t('rename'), '✏️'),
            button('limit', t('limit'), '👥'),
            button('lock', locked ? t('unlock') : t('lock'), locked ? '🔓' : '🔒'),
            button('hide', hidden ? t('show') : t('hide'), hidden ? '👁️' : '🙈')
        ),
        /** @type {ActionRowBuilder<ButtonBuilder>} */ (new ActionRowBuilder()).addComponents(
            button('kick', t('kick'), '👢', ButtonStyle.Danger),
            button('transfer', t('transfer'), '🔁'),
            button('claim', t('claim'), '👑', ButtonStyle.Primary)
        ),
    ];
    return { embeds: [embed], components: rows, allowedMentions: { parse: [] } };
}
