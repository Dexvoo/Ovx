import { Events } from 'discord.js';
import User_Level_Cache from '../cache/userLevels.cache.js';
import { ValidateXP } from '../utils/validation.js';

export const name = Events.MessageCreate;
export const once = false;
export const description = 'User Message XP';

/**
 * @typedef {import('../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').Message & { client: Client }} message
 */

export async function execute(message) {
    const { guild, author, member, channel, content, attachments, client } = message;

    if (author.bot || !message.inGuild() || !member || !channel.isTextBased()) return;

    const cleanContent = content.trim();
    if (cleanContent.length < 5 && attachments.size === 0) return;

    const expiresAt = client.cooldowns.getRemaining('message', author.id, guild.id);
    if (expiresAt)
        return client.utils.LogData(
            'Message Cooldown',
            `Guild: ${guild.name} | User: @${member.user.username} | Time: ${(expiresAt - Date.now()) / 1000}`,
            'debug'
        );

    const validate = await ValidateXP(member, message.channel);
    if (!validate) return;

    // Re-check and claim the cooldown synchronously, before any further awaits,
    // so messages sent while ValidateXP was running can't also earn XP
    if (client.cooldowns.has('message', author.id, guild.id)) return;

    const { guildConfig } = validate;
    client.cooldowns.add('message', author.id, guildConfig.messageCooldown ?? 30, guild.id);

    const addedXP = await User_Level_Cache.addMessageXP(member, guildConfig);
    if (!addedXP) client.cooldowns.remove('message', author.id, guild.id);
}
