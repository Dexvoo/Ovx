import { Events } from 'discord.js';
import { checkMessage } from '../utils/blocker.js';

export const name = Events.MessageUpdate;
export const once = false;
export const description = 'Invite Blocker: Edited Messages';

/**
 * Catches an invite added by editing a message after it was sent.
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} before
 * @param {import('discord.js').Message | import('discord.js').PartialMessage} after
 */
export async function execute(before, after) {
    if (before.content === after.content) return; // e.g. an embed loading, not an edit
    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (message) await checkMessage(message);
}
