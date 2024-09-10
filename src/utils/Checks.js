const { ChatInputCommandInteraction, GuildMember, Client, GuildChannel, ThreadChannel, PermissionFlagsBits, PermissionsBitField } = require("discord.js");

/**
 * @param {ChatInputCommandInteraction | GuildChannel | ThreadChannel} interactionChannel - Interaction or Channel
 * @param {Array<string>} permissions - Array of permissions to check
 * @param {GuildMember | Client} member - GuildMember or Client
 * @returns {[boolean, string[]?]} Array with a boolean indicating success and an optional array of missing permissions
 */
function permissionCheck(interactionChannel, permissions, member) {
    if (!interactionChannel) throw new Error('No channel or interaction provided.');
    if (!Array.isArray(permissions)) throw new Error('No permissions provided or invalid format.');
    if (!member) throw new Error('No member provided.');

    // Determine the channel and guild
    let channel, guild;
    if (interactionChannel instanceof ChatInputCommandInteraction) {
        channel = interactionChannel.channel;
        guild = interactionChannel.guild;
    } else if (interactionChannel instanceof GuildChannel || interactionChannel instanceof ThreadChannel) {
        channel = interactionChannel;
        guild = interactionChannel.guild;
    } else {
        throw new Error('Invalid interaction or channel type provided.');
    }

    // Determine the permissions of the member or bot
    let userPermissions;
    if (member instanceof GuildMember) {
        userPermissions = member.permissionsIn(channel);
    } else if (member instanceof Client) {
        if (!guild) throw new Error('Guild not found for client member.');
        userPermissions = guild.members.me.permissionsIn(channel);
    } else {
        throw new Error('Invalid member or client type provided.');
    }

    const missingPermissions = permissions.filter(permission => !userPermissions.has(permission)).map(permission => new PermissionsBitField(permission).toArray());
    return missingPermissions.length > 0 ? [false, missingPermissions] : [true];
}

module.exports = { permissionCheck };
