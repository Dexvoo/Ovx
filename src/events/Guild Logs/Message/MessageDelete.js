const { Events, EmbedBuilder, Message, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { MessageLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');

module.exports = {
    name: Events.MessageDelete,
    once: false,
    nickname: 'Message Delete',

    /**
     * @param {Message} message
     */

    async execute(message) {
        const { client, guild, member, channel, content, author } = message;

        if(author.bot || !guild) return;

        const guildMessageLogs = await MessageLogs.findOne({ guildId: guild.id });

        if(!guildMessageLogs || !guildMessageLogs.channelId || !guildMessageLogs.enabled) return cleanConsoleLogData('Message Deleted', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildMessageLogs.channelId);

        if(!targetChannel) {
            
            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });
            
            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Message Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Message Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const fetchedLogs = await message.guild.fetchAuditLogs(
            { limit: 1, type: AuditLogEvent.MessageDelete }
        ).catch(() => { return false });

        let executor
        if(fetchedLogs) {
            const isSameChannel = fetchedLogs.extra && fetchedLogs.extra.channel.id === channel.id;
				const isSameTarget = fetchedLogs.target && fetchedLogs.target.id === author.id;
				const isRecent = fetchedLogs.createdTimestamp > Date.now() - 5000;
				const hasCount = fetchedLogs.extra && fetchedLogs.extra.count >= 1;

            if(isSameChannel && isSameTarget && isRecent && hasCount) {
                executor = fetchedLogs.entries.first().executor;
            } else {
                executor = message.author;
            }
        }
        
        if(!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) executor = 'Bot Missing Permission: `ViewAuditLog` ';
        
        const attachments = message.attachments.map(attachment => attachment.url).join('\n');
        const description = [
            `-# ${content.substring(0, 2000)}\n`,
            `Message ID: ${message.id}`,
        ];
        
        if(!content) description.shift();
        if(attachments) description.push(`### Attachments:\n${attachments}`);
        if(executor) description.push(`Deleted by: ${executor}`);

        const MessageDeleteEmbed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: author.username, iconURL: author.displayAvatarURL() })
            .setTitle(`Message Deleted in #${channel.name}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();
        targetChannel.send({ embeds: [MessageDeleteEmbed] }).catch(() => { });
        
    }
}
