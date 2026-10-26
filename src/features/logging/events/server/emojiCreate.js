import { Events, AuditLogEvent } from 'discord.js';
import { postServerLog } from '../../utils/serverLog.js';

export const name = Events.GuildEmojiCreate;
export const once = false;
export const description = 'Emoji Create Logs';

/**
 * @param {import('discord.js').GuildEmoji} emoji
 */
export async function execute(emoji) {
    await postServerLog(emoji.guild, {
        titleKey: 'emoji_create',
        colour: 'Green',
        description: `${emoji} \`:${emoji.name}:\``,
        auditType: AuditLogEvent.EmojiCreate,
        targetId: emoji.id,
        footer: `EID: ${emoji.id}`,
        thumbnail: emoji.imageURL({ size: 128 }),
    });
}
