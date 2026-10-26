// discord.js's Client, not core/extendedClient.js: importing that here would be circular, and
// our client extends this one, so instanceof still matches it
import { CommandInteraction, Client, GuildMember, GuildChannel, ThreadChannel, PermissionsBitField } from 'discord.js';
import { LogData } from './logger.js';
import { ENV } from '../../bootstrap/environment.js';
/**
 * Checks if a user/bot has the required permissions in a channel
 *
 * @param {CommandInteraction | import('discord.js').GuildBasedChannel} interaction - Interaction or Channel to check permissions in
 * @param {import('discord.js').PermissionResolvable[]} permissions - Permissions to check (flags or names)
 * @param {GuildMember | Client} member - GuildMember or Client to check permissions for
 * @returns {[boolean, string[][]?]} Array with boolean success flag and optional array of missing permission names
 * @throws {Error} If invalid parameters are provided
 */

function PermissionCheck(interaction, permissions, member) {
    if (!interaction || !permissions) {
        throw new Error('Invalid parameters provided to PermissionCheck');
    }

    let channel, guild;
    if (interaction instanceof CommandInteraction) {
        channel = interaction.channel;
        guild = interaction.guild;
    } else if (interaction instanceof GuildChannel || interaction instanceof ThreadChannel) {
        channel = interaction;
        guild = interaction.guild;
    } else {
        throw new Error('Invalid interaction/channel provided to PermissionCheck');
    }

    let userPermissions;
    if (member instanceof GuildMember) {
        userPermissions = member.permissionsIn(channel);
    } else if (member instanceof Client) {
        if (!guild) throw new Error('Guild context is required to check client permissions');
        userPermissions = guild.members.me.permissionsIn(channel);
    } else {
        throw new Error('Invalid member/client provided to PermissionCheck');
    }

    const missingPermissions = permissions
        .filter((permission) => !userPermissions.has(permission))
        .map((permission) => new PermissionsBitField(permission).toArray());
    return missingPermissions.length > 0 ? [false, missingPermissions] : [true];
}

/**
 * Checks if a user ID belongs to a bot developer
 *
 * @param {string} userId - The Discord user ID to check
 * @returns {boolean} True if the user is a developer, false otherwise
 */
function DevPermissionCheck(userId) {
    if (ENV.DEVELOPER_IDS.length === 0) {
        LogData('Developer Permission Check', 'No developer IDs defined in environment variables.', 'warning');
        return false;
    }

    return ENV.DEVELOPER_IDS.includes(userId);
}

export { PermissionCheck, DevPermissionCheck };
