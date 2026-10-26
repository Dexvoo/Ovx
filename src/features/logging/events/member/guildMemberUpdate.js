import { Events } from 'discord.js';
import { getLogChannel } from '../../utils/logChannel.js';

export const name = Events.GuildMemberUpdate;
export const once = false;
export const description = 'Guild Member Update Logs';

/**
 * @typedef {import('../../../../core/extendedClient.js').default} Client
 * @param {import('discord.js').GuildMember & { client: Client }} oldMember
 * @param {import('discord.js').GuildMember & { client: Client }} newMember
 */

export async function execute(oldMember, newMember) {
    if (oldMember.partial) return;

    const { guild, client } = newMember;

    if (!guild) return;

    // Check for timeouts as they are handled by punishment/timeouts.js
    if (
        oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp &&
        oldMember.nickname === newMember.nickname &&
        oldMember.roles.cache.size === newMember.roles.cache.size
    )
        return;

    const logChannel = await getLogChannel(guild, 'member');
    if (!logChannel) return;

    const fields = [];
    /** @type {string | false} */
    let thumbnail = false;

    if (oldMember.nickname !== newMember.nickname) {
        fields.push({
            name: 'Nickname',
            value: `\`${oldMember.nickname || oldMember.displayName}\` → \`${newMember.nickname || newMember.displayName}\``,
            inline: false,
        });
    }

    if (oldMember.avatar !== newMember.avatar) {
        const isRemoved = !newMember.avatar;

        fields.push({
            name: 'Server Avatar',
            value: isRemoved ? 'Removed' : 'Updated',
            inline: false,
        });

        const avatarUrl = isRemoved
            ? oldMember.avatarURL({ extension: 'png', size: 512 })
            : newMember.avatarURL({ extension: 'png', size: 512 });

        if (avatarUrl) {
            thumbnail = avatarUrl;
        }
    }

    const oldRoles = oldMember.roles.cache.map((r) => r.id);
    const newRoles = newMember.roles.cache.map((r) => r.id);
    const addedRoles = newRoles.filter((r) => !oldRoles.includes(r));
    const removedRoles = oldRoles.filter((r) => !newRoles.includes(r));

    if (addedRoles.length > 0) {
        fields.push({
            name: 'Roles Added',
            value: addedRoles
                .map((r) => `<@&${r}>`)
                .join(', ')
                .substring(0, 1024),
            inline: false,
        });
    }

    if (removedRoles.length > 0) {
        fields.push({
            name: 'Roles Removed',
            value: removedRoles
                .map((r) => `<@&${r}>`)
                .join(', ')
                .substring(0, 1024),
            inline: false,
        });
    }

    if (fields.length === 0) return;

    const title = client.utils.Translate('logs.member.update_title', guild.preferredLocale);
    const footerText = `UID: ${newMember.id}`;

    await client.utils.Embed(logChannel, 'Orange', title, '', {
        timestamp: true,
        footer: { text: footerText },
        author: newMember.user,
        fields,
        thumbnail,
    });
}
