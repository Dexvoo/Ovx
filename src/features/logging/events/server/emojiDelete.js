import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildEmojiDelete;
export const once = false;
export const description = 'Emoji Delete Logs';

/**
 * @param {import('discord.js').GuildEmoji} emoji
 */
export async function execute(emoji) {
    await postServerLog(emoji.guild, {
        titleKey: 'emoji_delete',
        colour: 'Red',
        description: `\`:${emoji.name}:\``,
        auditType: AuditLogEvent.EmojiDelete,
        targetId: emoji.id,
        footer: `EID: ${emoji.id}`,
        thumbnail: emoji.imageURL({ size: 128 }),
    });
}
