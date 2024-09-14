const { Events, EmbedBuilder, Message, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { MessageLogs } = require('../../../models/GuildSetups');
const { permissionCheck } = require('../../../utils/Checks');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { DeveloperMode } = process.env;


module.exports = {
    name: Events.MessageUpdate,
    once: false,
    nickname: 'Message Update',

    /**
     * @param {Message} oldMessage
     * @param {Message} newMessage
     */

    async execute(oldMessage, newMessage) {
        const { client, guild, member, channel, author } = newMessage;
    
        if(author.bot || !guild || DeveloperMode === 'true') return;
        
        const guildMessageLogs = await MessageLogs.findOne({ guildId: guild.id });

        if(!guildMessageLogs || !guildMessageLogs.channelId || !guildMessageLogs.enabled) return cleanConsoleLogData('Message Updated', `Guild: ${guild.name} | Disabled`, 'warning');
    
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

        const description = [
            `Old Content: \n-# ${oldMessage.content.substring(0, 1750)}`,
            `New Content: \n-# ${newMessage.content.substring(0, 1750)}`,
        ];

        // how to compare the old message to the new message

        if(!oldMessage.content) description.shift();
        if(!newMessage.content) description.pop();

        description.push(`Message ID: ${newMessage.id}`);
        
        const MessageUpdateEmbed = new EmbedBuilder()
            .setColor('Orange')
            .setAuthor({ name: member.user.username, icon: member.displayAvatarURL() })
            .setTitle(`Message Updated in #${channel.name}`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${member.id}` })

        targetChannel.send({ embeds: [MessageUpdateEmbed] }).catch(() => { });
    
    }
};
