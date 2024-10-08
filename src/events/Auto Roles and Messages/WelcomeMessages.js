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
            const welcomeMessagesData = await WelcomeMessage.findOne({ guildId: guild.id });
            if (!welcomeMessagesData || !welcomeMessagesData.enabled) {
                return cleanConsoleLogData('Welcome Messages', `Guild: ${guild.name} | Disabled`, 'warning');
            }

            const channel = guild.channels.cache.get(welcomeMessagesData.channelId);
            if (!channel) {
                welcomeMessagesData.enabled = false;
                await welcomeMessagesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Welcome Messages', `Channel not found`);
                return;
            }

            await guild.members.fetch();

            const message = welcomeMessagesData.message
                .replace(/{username}/g, `@${member.user.username}`)
                .replace(/{usermention}/g, member)
                .replace(/{server}/g, guild.name)
                .replace(/{memberCount}/g, guild.memberCount);

            const Embed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setDescription(message);

            channel.send({ content: `<@${member.id}>`, embeds: [Embed] }).catch(async () => { 
                welcomeMessagesData.enabled = false;
                welcomeMessagesData.save();
                
                const guildOwner = await guild.fetchOwner();
                if (guildOwner) DisabledFeatures(client, guildOwner, 'Welcome Messages', `Missing Permissions`);
            });

        } catch (error) {
            
        }
    }
};
