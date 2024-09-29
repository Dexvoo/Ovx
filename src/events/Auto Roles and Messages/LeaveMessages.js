const { Events, EmbedBuilder, Colors, GuildMember, PermissionFlagsBits } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { LeaveMessage } = require('../../models/GuildSetups.js');
const { DisabledFeatures } = require('../../utils/Embeds.js');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    nickname: 'Leave Messages',

    /**
     * @param {GuildMember} member
     */
    async execute(member) {
        const { guild, client } = member;

        try {
            const leaveMessagesData = await LeaveMessage.findOne({ guildId: guild.id });
            if (!leaveMessagesData || !leaveMessagesData.enabled) {
                return cleanConsoleLogData('Leave Messages', `Guild: ${guild.name} | Disabled`, 'warning');
            }

            const channel = guild.channels.cache.get(leaveMessagesData.channelId);
            if (!channel) {
                leaveMessagesData.enabled = false;
                await leaveMessagesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Leave Messages', `Channel not found`);
                return;
            }

            await guild.members.fetch();

            const message = leaveMessagesData.message
                .replace(/{username}/g, `@${member.user.username}`)
                .replace(/{usermention}/g, member)
                .replace(/{server}/g, guild.name)
                .replace(/{memberCount}/g, guild.memberCount);

            const Embed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(message);

            channel.send({ content: `<@${member.id}>`, embeds: [Embed] }).catch(async () => { 
                leaveMessagesData.enabled = false;
                leaveMessagesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Leave Messages', `Missing Permissions`);
            });

        } catch (error) {
            
        }
    }
};
