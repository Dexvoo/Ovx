const { Events, EmbedBuilder, Colors, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ReactionRoles } = require('../../models/GuildSetups');
require('dotenv').config();

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    nickname: 'Reaction Roles | Events',

    async execute(interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const { client, guild, member, customId } = interaction;
        const [type, messageId] = customId.split('.');
        if (type !== 'select-role' || !messageId) return;

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const reactionRoleData = await ReactionRoles.findOne({ guildId: guild.id, messageId });
            if (!reactionRoleData) {
                return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `No reaction roles found for this message. Please have an admin set it up again.`);
            }

            if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', 'Bot Missing Permissions: `Manage Roles`. Please check the bot permissions and try again.');
            }

            const botHighestRolePosition = guild.members.me.roles.highest.position;
            const selectedRolesSet = new Set(interaction.values);
            
            const rolesToAdd = [];
            const rolesToRemove = [];
            const failedRoles = [];

            for (const role of reactionRoleData.roles) {
                const targetRole = guild.roles.cache.get(role.roleId);

                if (!targetRole) {
                    failedRoles.push({ id: role.roleId, reason: 'Role not found' });
                    continue;
                }
                if (botHighestRolePosition <= targetRole.position) {
                    failedRoles.push({ id: role.roleId, reason: 'Bot role is too low' });
                    continue;
                }

                const userHasRole = member.roles.cache.has(targetRole.id);
                const userWantsRole = selectedRolesSet.has(targetRole.id);
                
                if (userWantsRole && !userHasRole) {
                    rolesToAdd.push(targetRole);
                } else if (!userWantsRole && userHasRole) {
                    rolesToRemove.push(targetRole);
                }
            }

            if (rolesToAdd.length === 0 && rolesToRemove.length === 0 && failedRoles.length === 0) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(Colors.Orange).setDescription('Your roles are already up to date!')]
                });
            }

            const addPromises = rolesToAdd.map(r => member.roles.add(r));
            const removePromises = rolesToRemove.map(r => member.roles.remove(r));
            await Promise.all([...addPromises, ...removePromises]);

            const replyEmbed = new EmbedBuilder().setTitle('Roles Updated').setColor(Colors.Green);

            if (rolesToAdd.length > 0) {
                replyEmbed.addFields({ name: '✅ Added Roles', value: rolesToAdd.map(r => r).join('\n'), inline: true });
            }
            if (rolesToRemove.length > 0) {
                replyEmbed.addFields({ name: '❌ Removed Roles', value: rolesToRemove.map(r => r).join('\n'), inline: true });
            }
            if (failedRoles.length > 0) {
                replyEmbed.setColor(Colors.Yellow);
                replyEmbed.addFields({ name: '⚠️ Failed Roles', value: failedRoles.map(f => `<@&${f.id}> (${f.reason})`).join('\n'), inline: false });
            }

            await interaction.editReply({ embeds: [replyEmbed] });

        } catch (error) {
            console.error(`[Reaction Roles] Error during interaction for user ${interaction.user.id} in guild ${guild.id}:`, error);
            try {
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription('An unexpected error occurred while processing your request.')]
                });
            } catch (e) {
                // Interaction likely expired
            }
        }
    }
};