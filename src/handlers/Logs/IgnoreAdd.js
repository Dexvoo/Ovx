const { Colors, PermissionFlagsBits } = require('discord.js');
const LogsCache = require('../../cache/Logs');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsIgnoreAdd(interaction) {
    const { client, options, guildId, member } = interaction;

    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return client.utils.Embed(interaction, Colors.Red, 'Permission Denied', 'You must have the `Manage Server` permission to use this command.');
    }

    const channel = options.getChannel('channel');
    const logsConfig = await LogsCache.get(guildId);

    if (logsConfig.ignoredChannels?.includes(channel.id)) {
        return client.utils.Embed(interaction, Colors.Orange, 'Already Ignored', `${channel} is already on the log ignore list.`);
    }

    const updatedIgnored = [...(logsConfig.ignoredChannels || []), channel.id];
    await LogsCache.setType(guildId, 'ignoredChannels', updatedIgnored);

    return client.utils.Embed(interaction, Colors.Green, 'Channel Ignored', `Logs will now ignore events from ${channel}.`);
};