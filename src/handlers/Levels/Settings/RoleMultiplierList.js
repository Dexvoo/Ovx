const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function RoleMultiplierList(interaction, context) {
    const { client, guild } = interaction;
    const { LevelConfigData } = context;

    if (!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed', 'Levels are not enabled. Use `/level setup` first.');

    const multipliers = LevelConfigData.roleMultipliers;

    if (!multipliers || multipliers.length === 0) {
        return client.utils.Embed(interaction, Colors.Orange, 'No Multipliers', 'There are no role XP multipliers configured for this server.');
    }

    const description = multipliers.map(rm => {
        const role = guild.roles.cache.get(rm.roleId);
        return role ? `${role}: \`x${rm.multiplier}\`` : `Deleted Role (\`${rm.roleId}\`): \`x${rm.multiplier}\``;
    }).join('\n');

    return client.utils.Embed(interaction, Colors.Blurple, 'Role XP Multipliers', description);
};