const { Events, Colors, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ReactionRoles } = require('../../models/GuildSetups');

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
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Reaction Roles | Error',
          `No reaction roles found for this message. Please have an admin set it up again.`
        );
      }

      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return client.utils.Embed(
          interaction,
          Colors.Red,
          'Reaction Roles | Error',
          'Bot Missing Permissions: `Manage Roles`. Please check the bot permissions and try again.'
        );
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
        return await client.utils.Embed(
          interaction,
          Colors.Orange,
          'Reaction Roles | No Changes',
          'Your roles are already up to date! No changes were made.'
        );
      }

      const addPromises = rolesToAdd.map((r) =>
        member.roles.add(r).catch(() => {
          /* ignore error, will be handled by failedRoles logic */
        })
      );
      const removePromises = rolesToRemove.map((r) =>
        member.roles.remove(r).catch(() => {
          /* ignore error */
        })
      );
      await Promise.all([...addPromises, ...removePromises]);

      const fields = [];
      if (rolesToAdd.length > 0) {
        fields.push({
          name: '✅ Added Roles',
          value: rolesToAdd.map((r) => r).join('\n'),
          inline: true,
        });
      }
      if (rolesToRemove.length > 0) {
        fields.push({
          name: '❌ Removed Roles',
          value: rolesToRemove.map((r) => r).join('\n'),
          inline: true,
        });
      }
      if (failedRoles.length > 0) {
        fields.push({
          name: '⚠️ Failed Roles',
          value: failedRoles.map((f) => `<@&${f.id}> (${f.reason})`).join('\n'),
          inline: false,
        });
      }

      const finalColor = failedRoles.length > 0 ? Colors.Yellow : Colors.Green;

      return await client.utils.Embed(interaction, finalColor, '', '', {
        fields: fields,
        ephemeral: true,
      });
    } catch (error) {
      console.error(
        `[Reaction Roles] Error during interaction for user ${interaction.user.id} in guild ${guild.id}:`,
        error
      );
      try {
        await client.utils.Embed(
          interaction,
          Colors.Red,
          'Reaction Roles | Error',
          'An unexpected error occurred while processing your request.',
          { ephemeral: true }
        );
      } catch (e) {
        // Interaction likely expired
      }
    }
  },
};
