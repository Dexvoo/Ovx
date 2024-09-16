const { Events, EmbedBuilder, Colors, GuildMember, PermissionFlagsBits } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { WelcomeMessage } = require('../../models/GuildSetups.js');
const { DisabledFeatures } = require('../../utils/Embeds.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    nickname: 'Welcome Messages',

    /**
     * @param {GuildMember} member
     */
    async execute(member) {
        const { guild, client } = member;

        try {
            const autoRolesData = await WelcomeMessage.findOne({ guildId: guild.id });
            if (!autoRolesData || !autoRolesData.enabled) {
                return cleanConsoleLogData('Welcome Messages', `Guild: ${guild.name} | Disabled`, 'warning');
            }

            const channel = guild.channels.cache.get(autoRolesData.channelId);
            if (!channel) {
                autoRolesData.enabled = false;
                await autoRolesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Welcome Messages', `Channel not found`);
                return;
            }

            const message = autoRolesData.message
                .replace(/{user}/g, member.user.toString())
                .replace(/{server}/g, guild.name)
                .replace(/{memberCount}/g, guild.memberCount);

            const Embed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(message);

            channel.send({ embeds: [Embed] }).catch(async () => { 
                autoRolesData.enabled = false;
                autoRolesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Welcome Messages', `Missing Permissions`);
            });

        } catch (error) {
            
        }
    }
};
