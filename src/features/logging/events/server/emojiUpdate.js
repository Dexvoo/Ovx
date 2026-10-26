import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildEmojiUpdate;
export const once = false;
export const description = 'Emoji Update Logs';

/**
 * @param {import('discord.js').GuildEmoji} oldEmoji
 * @param {import('discord.js').GuildEmoji} newEmoji
 */
export async function execute(oldEmoji, newEmoji) {
    if (oldEmoji.name === newEmoji.name) return; // Only renames are shown in Discord's emoji settings

    await postServerLog(newEmoji.guild, {
        titleKey: 'emoji_update',
        colour: 'White',
        description: `${newEmoji}\n**Name:** \`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\``,
        auditType: AuditLogEvent.EmojiUpdate,
        targetId: newEmoji.id,
        footer: `EID: ${newEmoji.id}`,
    });
}
