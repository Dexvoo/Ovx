import { Events, AuditLogEvent } from 'discord.js';
import { recordDiscordCase } from '../utils/discordCases.js';

export const name = Events.GuildMemberUpdate;
export const once = false;
export const description = 'Records timeouts made in Discord as moderation cases';

/** Member updates cover nicknames and roles too; only timeout changes count. */
const isTimeoutChange = (entry) => entry.changes.some((change) => change.key === 'communication_disabled_until');

/**
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember
 * @param {import('discord.js').GuildMember} newMember
 */
export async function execute(oldMember, newMember) {
    // A member Ovx hadn't cached has no "before" to compare, so any update would look like a timeout
    if (oldMember.partial) return;
    const until = newMember.communicationDisabledUntilTimestamp;
    if (oldMember.communicationDisabledUntilTimestamp === until) return;

    const muted = until !== null && until > Date.now();
    await recordDiscordCase(newMember.guild, {
        type: AuditLogEvent.MemberUpdate,
        action: muted ? 'mute' : 'unmute',
        user: newMember.user,
        durationMs: muted ? until - Date.now() : null,
        match: isTimeoutChange,
    });
}
