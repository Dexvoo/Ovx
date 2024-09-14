const { Events, PermissionFlagsBits, GuildMember, EmbedBuilder } = require('discord.js');
const { DisabledFeatures } = require('../../../utils/Embeds');
const { permissionCheck } = require('../../../utils/Checks');
const { JoinLeaveLogs } = require('../../../models/GuildSetups');
const { cleanConsoleLogData } = require('../../../utils/ConsoleLogs');
const { DeveloperMode } = process.env;


module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    nickname: 'Leave Logs',

    /**
     * @param {GuildMember} member
     */

    async execute(member) {
        const { guild, client } = member;
        
        if(!guild || DeveloperMode === 'true') return;

        const guildLogs = await JoinLeaveLogs.findOne({ guildId: guild.id });

        if (!guildLogs || !guildLogs.enabled || !guildLogs.channelId) return cleanConsoleLogData('Member Left', `Guild: ${guild.name} | Disabled`, 'warning');

        const targetChannel = guild.channels.cache.get(guildLogs.channelId);

        if (!targetChannel) {

            guildLogs.enabled = false;
            await guildLogs.save().catch(() => null);

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Leave Logs', `Channel not found`);
        }

        const botPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        const [hasPermission, missingPermissions] = permissionCheck(targetChannel, botPermissions, client);

        if(!hasPermission) {

            guildMessageLogs.enabled = false;
            await guildMessageLogs.save().catch(() => { });

            const guildOwner = await guild.fetchOwner().catch(() => null);
            if(!guildOwner) return;
            return DisabledFeatures(client, guildOwner, 'Leave Logs', `Missing Permissions: \`${missingPermissions}\``);
        }

        description = [
            `${member}`, 
            `Joined: ${getDiscordTimestamp(member.joinedAt)}`,
            // roles without the everyone role
            `Roles: ${ member.roles.cache.filter(role => role.name !== '@everyone').map(role => role).join(' • ').substring(0, 2000) || 'None' }`,
        ];

        const MessageDeleteEmbed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: member.user.username, iconURL: member.displayAvatarURL() })
            .setTitle(`Member Left`)
            .setDescription(description.join('\n'))
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();
        targetChannel.send({ embeds: [MessageDeleteEmbed] }).catch(() => { });


    }
};


function getDiscordTimestamp (date) {
    return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}