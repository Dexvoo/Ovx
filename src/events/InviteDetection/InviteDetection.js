const { Events, EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const InviteDetectionConfigCache = require('../../cache/InviteDetection.js');
const INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite)[\/\\]([a-zA-Z0-9-]{2,})/i;

module.exports = {
    name: Events.MessageCreate,
    once: false,
    nickname: 'Invite Detection',

    /**
     * @param {import('../../types.js').MessageUtils} message
     */
    async execute(message) {
        const { client, guild, channel, content, author, member } = message;
        if (author.bot || !guild || !member || !channel.isTextBased() || channel.isDMBased()) return;

        const guildConfigData = await InviteDetectionConfigCache.get(guild.id);
        if (!guildConfigData.enabled) return;

        const botPermissions = channel.permissionsFor(guild.members.me);
        if (!botPermissions || !botPermissions.has(PermissionFlagsBits.ManageMessages)) return client.utils.LogData('Invite Detection', `Missing 'Manage Messages' permission in #${channel.name}`, 'error');

        const userPermissions = channel.permissionsFor(member);
        if (userPermissions && userPermissions.has(PermissionFlagsBits.ManageMessages)) return;

        const inviteMatch = INVITE_REGEX.exec(content);
        if (!inviteMatch) return;

        const inviteCode = inviteMatch[1];

        try {
            const invite = await client.fetchInvite(inviteCode);
            if (invite.guild && invite.guild.id === guild.id) return;
        } catch (error) {
            client.utils.LogData('Invite Detection', `Caught error fetching invite '${inviteCode}'. Assuming it's an ad. Error: ${error.message}`, 'info');
        }

        try {
            await message.delete();

            const successEmbed = new EmbedBuilder()
                .setTitle('🛡️ Invite Link Removed')
                .setColor(Colors.Red)
                .setDescription(`Advertising is not allowed. Your message containing an invite link was removed.`)
                .addFields({ name: 'User', value: `${member} (${member.id})` });

            const notification = await channel.send({ embeds: [successEmbed] });
            setTimeout(() => notification.delete().catch(() => {}), 30000);

        } catch (error) {
            client.utils.LogData('Invite Detection', `Failed to delete an invite message. Error: ${error.message}`, 'error');
        }
    }
};