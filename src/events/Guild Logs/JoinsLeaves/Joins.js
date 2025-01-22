const { Events, PermissionFlagsBits, GuildMember, EmbedBuilder } = require('discord.js');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { permissionCheck } = require('../../../utils/Checks');
const { JoinLeaveLogs } = require('../../../models/GuildSetups');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DeveloperMode } = process.env;


module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    nickname: 'Join Logs',

    /**
     * @param {GuildMember} member
     */

    async execute(member) {
        const { guild, client } = member;
        
        if(!guild || DeveloperMode === 'true') return;

        const guildLogs = await JoinLeaveLogs.findOne({ guildId: guild.id });

        if (!guildLogs || !guildLogs.enabled || !guildLogs.channelId) return cleanConsoleLogData('Member Joined', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildLogs.channelId);

        if (!targetChannel) {

            guildLogs.enabled = false;
            await guildLogs.save().catch(() => null);

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Join Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Join Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        const placed = await guild.members.fetch();
        const suffix = placed % 10 == 1 && placed % 100 != 11 ? "st" : placed % 10 == 2 && placed % 100 != 12 ? "nd" : placed % 10 == 3 && placed % 100 != 13 ? "rd" : "th";

        description = [
            `${member}, ${placed}${suffix} to join`, 
            `Created: ${getDiscordTimestamp(member.user.createdAt)}`,
        ];

        const MessageDeleteEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setAuthor({ name: member.user.username, iconURL: member.displayAvatarURL() })
            .setTitle(`Member Joined`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();
        targetChannel.send({ embeds: [MessageDeleteEmbed] }).catch(() => { });


    }
};


function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}