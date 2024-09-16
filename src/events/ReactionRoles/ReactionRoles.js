const { EmbedBuilder, Events, Interaction, PermissionFlagsBits } = require('discord.js');
const { ReactionRoles } = require('../../models/GuildSetups');
const { DeveloperMode } = process.env;

module.exports = {
    name: Events.InteractionCreate,
    nickname: 'Reaction Roles',
    once: false,

    /**
     * @param {Interaction} interaction
     */
    async execute(interaction) {
        const { customId, user, guild, channel, member, client } = interaction;
        if (!interaction.isStringSelectMenu() || !customId) return;

        try {
            const [type, messageId] = customId.split('.');
            if (type !== 'select-role' || !messageId) return;

            await interaction.deferReply({ ephemeral: true });

            const reactionRoleData = await ReactionRoles.findOne({ messageId: messageId });
            if (!reactionRoleData) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription('No Reaction Roles Data Found!')]
                });
            }

            let targetChannel, targetMessage;
            try {
                targetChannel = await guild.channels.fetch(reactionRoleData.channelId);
                targetMessage = await targetChannel.messages.fetch(reactionRoleData.messageId);
            } catch (error) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription('Reaction Roles Message Not Found!')]
                });
            }

            if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription('Bot Missing Permissions: `Manage Roles`')]
                });
            }

            const values = interaction.values;

            if(!Array.isArray(values)) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription('Invalid Role Selection!')]
                });
            }

            if (values.length === 0) {
                // remove all roles
                const rolesToRemove = reactionRoleData.roles.map(role => role.roleId);
                for (const roleId of rolesToRemove) {
                    if (member.roles.cache.has(roleId)) {
                        await removeRole(member, roleId);
                    }
                }
            }

            const addedRoles = [], removedRoles = [], failedRoles = [];

            for (const role of reactionRoleData.roles) {
                const targetRole = guild.roles.cache.get(role.roleId);
                if (!targetRole || targetRole.position > guild.members.me.roles.highest.position) {
                    failedRoles.push(role);
                    continue;
                }

                if (values.includes(role.roleId) && !member.roles.cache.has(targetRole.id)) {
                    if (await addRole(member, targetRole.id)) addedRoles.push(role);
                    else failedRoles.push(role);
                } else if (!values.includes(role.roleId) && member.roles.cache.has(targetRole.id)) {
                    if (await removeRole(member, targetRole.id)) removedRoles.push(role);
                    else failedRoles.push(role);
                }
            }

            if (!addedRoles.length && !removedRoles.length && !failedRoles.length) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription('No Changes Were Made!')]
                });
            }

            const Embed = new EmbedBuilder().setColor('Blurple');
            if (addedRoles.length > 0) {
                Embed.addFields({ name: 'Added Roles', value: addedRoles.map(role => `<@&${role.roleId}>`).join('\n') });
            }
            if (removedRoles.length > 0) {
                Embed.addFields({ name: 'Removed Roles', value: removedRoles.map(role => `<@&${role.roleId}>`).join('\n') });
            }
            if (failedRoles.length > 0) {
                Embed.addFields({ name: 'Failed Roles (Role Hierarchy)', value: failedRoles.map(role => `<@&${role.roleId}>`).join('\n') });
            }

            await interaction.editReply({ embeds: [Embed] });

        } catch (error) {
            console.error(`Error processing interaction ${customId} for user ${user.id} in guild ${guild.id}`, error);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription('An Error Occurred While Processing This Request!')]
            });
        }
    }
};

// Helper Functions
async function addRole(member, roleId) {
    try {
        await member.roles.add(roleId);
        return true;
    } catch (error) {
        return false;
    }
}

async function removeRole(member, roleId) {
    try {
        await member.roles.remove(roleId);
        return true;
    } catch (error) {
        return false;
    }
}
