const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { cleanConsoleLogData } = require('../../utils/ConsoleLogs.js');
const { permissionCheck } = require('../../utils/Checks.js');

const { InviteDetection } =  require('../../models/GuildSetups.js');
 
module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Invite Detection',

    /**
     * @param {Message} message
     */
    async execute(message) {
        const { client, guild, member, channel, content, author } = message;

        // Exit if message is from a bot or outside a guild
        if (!guild || author.bot) return;

        try {
            const guildInviteDetection = await InviteDetection.findOne({ guildId: guild.id });
            if (!guildInviteDetection) return;

            if(!guildInviteDetection.enabled) return;

            // Check bot permissions
            const requiredPermissions = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
            const [hasPermissions, missingPermissions] = permissionCheck(channel, requiredPermissions, client);

            if (!hasPermissions) return;

            // Detect invite links
            const inviteRegex = /discord\.(gg|io|me|li)\/\w+|discordapp\.com\/invite\/\w+/g;
            const inviteMatch = content.match(inviteRegex);
            if (!inviteMatch) return;

            const inviteCode = inviteMatch[0].split('/').pop();
            const invite = await client.fetchInvite(inviteCode).catch(() => null);

            if (!invite) {
                cleanConsoleLogData('Invite Detection', `Invalid Invite Code: ${inviteCode}`, 'info');
                return;
            }

            // Ignore if the invite is for the same guild
            if (invite.guild?.id === guild.id) return;

            // Delete the message and notify the channel
            await message.delete().catch(err => {});

            const successEmbed = new EmbedBuilder()
                .setTitle('Invite Detection')
                .setColor('Blurple')
                .setDescription(`${member} sent an invite link. The message has been removed.`);

            await channel.send({ embeds: [successEmbed] });

        } catch (error) {
            cleanConsoleLogData('Invite Detection', `Error: ${error.message}`, 'error');
        }
    }
};
