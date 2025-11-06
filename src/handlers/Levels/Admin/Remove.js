const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_XP = require('../../../cache/XP');
const { ExpForLevel, LevelForExp } = require('../../../utils/Functions/Levels/XPMathematics');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelAdminRemove(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context;

    if (!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`');
    if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed', 'User Missing Permissions | `ManageGuild`');

    const targetUser = options.getUser('user');
    const levelsToRemove = options.getInteger('levels') || 0;
    const xpToRemove = options.getInteger('xp') || 0;

    if (levelsToRemove <= 0 && xpToRemove <= 0) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Input', 'You must provide a positive number of levels or XP to remove.');
    }
    if (targetUser.bot) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Target', 'Bots cannot have levels or XP.');
    }

    try {
        const userXPData = await Cache_XP.get(guildId, targetUser.id);
        const currentTotalXP = ExpForLevel(userXPData.level) + userXPData.xp;
        
        let xpFromLevelsToRemove = 0;
        if (levelsToRemove > 0) {
            const targetLevel = Math.max(0, userXPData.level - levelsToRemove);
            xpFromLevelsToRemove = ExpForLevel(userXPData.level) - ExpForLevel(targetLevel);
        }

        let newTotalXP = currentTotalXP - xpToRemove - xpFromLevelsToRemove;
        if (newTotalXP < 0) newTotalXP = 0;

        const [finalLevel, finalXP] = LevelForExp(newTotalXP);

        await Cache_XP.set(guildId, targetUser.id, {
            level: finalLevel,
            xp: finalXP,
        });

        return client.utils.Embed(interaction, Colors.Green, 'Success', `Removed **${levelsToRemove}** levels and **${xpToRemove}** XP from ${targetUser}.\nNew Stats:\n**Level:** \`${finalLevel}\`\n**XP:** \`${finalXP}\``);

    } catch (error) {
        console.error("Error in LevelAdminRemove:", error);
        return client.utils.Embed(interaction, Colors.Red, 'Error', 'An unexpected error occurred while removing level/XP.');
    }
};