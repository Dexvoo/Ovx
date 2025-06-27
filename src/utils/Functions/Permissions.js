const { ChatInputCommandInteraction, GuildMember, Client, GuildChannel, ThreadChannel, PermissionFlagsBits, PermissionsBitField } = require("discord.js");
const { PublicClientID, TopggAPIKey, DeveloperIDs } = process.env

/**
 * @param {ChatInputCommandInteraction | GuildChannel | ThreadChannel} interactionChannel - Interaction or Channel
 * @param {Array<string>} permissions - Array of permissions to check
 * @param {GuildMember | Client} member - GuildMember or Client
 * @returns {[boolean, string[]?]} Array with a boolean indicating success and an optional array of missing permissions
 */
function PermCheck(interactionChannel, permissions, member) {
    if (!interactionChannel) throw new Error('No channel or interaction provided.');
    if (!Array.isArray(permissions)) throw new Error('No permissions provided or invalid format.');
    if (!member) throw new Error('No member provided.');

    let channel, guild;
    if (interactionChannel instanceof ChatInputCommandInteraction) {
        channel = interactionChannel.channel;
        guild = interactionChannel.guild;
    } else if (interactionChannel instanceof GuildChannel || interactionChannel instanceof ThreadChannel) {
        channel = interactionChannel;
        guild = interactionChannel.guild;
    } else {
        throw new Error('Invalid interaction or channel type provided.');
    };

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


/**
 * @param {String} userId - Userid 
 * @returns {Promise<Boolean>} Boolean if voted or not
 */
async function HasVotedTGG(userId) {
    const hasVoted = await fetch(`https://top.gg/api/bots/${PublicClientID}/check?userId=${userId}`, {
        headers: {
            'Authorization': TopggAPIKey
        }}).then(res => res.json()).then(json => json.voted);
    return hasVoted;
}


/**
 * @param {String} userId - Userid 
 * @returns {Boolean} Boolean if dev or not
 */
function DevCheck(userId) {
    if(DeveloperIDs.includes(userId)) return true;
    return false;
}

module.exports = { PermCheck, HasVotedTGG, DevCheck };