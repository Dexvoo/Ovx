import { EmbedBuilder } from 'discord.js';
import Honeypot_Config_Cache from '../cache/honeypotConfig.cache.js';
import { publishMessage, removePostedMessage } from '../../../shared/utils/postedMessage.js';
import { Translate } from '../../../shared/utils/i18n.js';

/**
 * The embed posted in the honeypot channel, telling members not to post there. Written in the server's language,
 * and always red (not the server's colour) so it reads as a warning.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/honeypotConfig.js').HoneypotConfigType} config
 * @returns {import('discord.js').MessageCreateOptions}
 */
export function warningMessage(guild, config) {
    const t = (key) => Translate(`honeypot.${key}`, guild.preferredLocale);
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle(t('warning_title'))
        .setDescription(
            [
                t('warning_intro'),
                t(config.action === 'softban' ? 'warning_softban' : 'warning_ban'),
                t('warning_ignore'),
            ].join('\n\n')
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined });
    return { embeds: [embed], allowedMentions: { parse: [] } };
}

/**
 * Makes the warning match the settings: posted (or updated) in the honeypot channel while it's on, and removed
 * when it's off, its channel changed or the warning is turned off.
 * @param {import('discord.js').Guild} guild
 * @param {import('../models/honeypotConfig.js').HoneypotConfigType} config
 * @returns {Promise<{ config: import('../models/honeypotConfig.js').HoneypotConfigType, error?: string }>}
 */
export async function syncWarning(guild, config) {
    const previous = config.warningMessageId
        ? { channelId: config.warningChannelId, messageId: config.warningMessageId }
        : null;

    if (!config.enabled || !config.postWarning || !config.channelId) {
        if (!previous) return { config };
        await removePostedMessage(guild, previous);
        return {
            config: await Honeypot_Config_Cache.set(guild.id, { warningChannelId: null, warningMessageId: null }),
        };
    }

    const result = await publishMessage(guild, {
        channelId: config.channelId,
        previous,
        message: warningMessage(guild, config),
        label: 'Honeypot',
    });
    if (!result.ok) return { config, error: result.error };
    if (previous?.messageId === result.messageId && previous.channelId === config.channelId) return { config };
    return {
        config: await Honeypot_Config_Cache.set(guild.id, {
            warningChannelId: config.channelId,
            warningMessageId: result.messageId,
        }),
    };
}
