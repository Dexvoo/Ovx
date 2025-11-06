const { Colors, PermissionsBitField } = require('discord.js');
const { LevelConfigType } = require('../../../models/GuildSetups');
const Cache_XP = require('../../../cache/XP');
const { ExpForLevel, LevelForExp } = require('../../../utils/Functions/Levels/XPMathematics');

/**
 * @param {import('../../../types').CommandInputUtils} interaction
 * @param {{ LevelConfigData: LevelConfigType }} context
 */
module.exports = async function LevelAdminSet(interaction, context) {
    const { client, options, guildId, memberPermissions } = interaction;
    const { LevelConfigData } = context;

    // Permission and setup checks
    if (!LevelConfigData.enabled) return client.utils.Embed(interaction, Colors.Red, 'Failed', 'Levels are currently not enabled on this server.\nAsk a server admin to use `/level setup`');
    if (!memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) return client.utils.Embed(interaction, Colors.Red, 'Failed', 'User Missing Permissions | `ManageGuild`');

    const targetUser = options.getUser('user');
    const levelToSet = options.getInteger('level');
    const xpToSet = options.getInteger('xp');

    if (levelToSet === null && xpToSet === null) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Input', 'You must provide either a level or XP to set.');
    }
    if (targetUser.bot) {
        return client.utils.Embed(interaction, Colors.Red, 'Invalid Target', 'Bots cannot have levels or XP.');
    }

    try {
        const userXPData = await Cache_XP.get(guildId, targetUser.id);
        
        let finalTotalXP = 0;

        if (levelToSet !== null) {
            if (levelToSet > LevelConfigData.maxLevel) {
                 return client.utils.Embed(interaction, Colors.Red, 'Failed', `The level provided (${levelToSet}) is higher than the server's max level (${LevelConfigData.maxLevel}).`);
            }
            finalTotalXP = ExpForLevel(levelToSet);

            if (xpToSet !== null) {
                const xpForNextLevel = ExpForLevel(levelToSet + 1) - ExpForLevel(levelToSet);
                if (xpToSet >= xpForNextLevel || xpToSet < 0) {
                    return client.utils.Embed(interaction, Colors.Red, 'Invalid XP', `The XP provided must be positive and less than the amount required for the next level.`);
                }
                finalTotalXP += xpToSet;
            }
        } else { // Only xpToSet is provided
            const xpForCurrentLevel = ExpForLevel(userXPData.level);
            const xpForNextLevel = ExpForLevel(userXPData.level + 1) - xpForCurrentLevel;

            if (xpToSet >= xpForNextLevel || xpToSet < 0) {
                return client.utils.Embed(interaction, Colors.Red, 'Invalid XP', `The XP provided must be positive and less than the amount required for the next level.`);
            }
            finalTotalXP = xpForCurrentLevel + xpToSet;
        }

        const [recalculatedLevel, recalculatedXP] = LevelForExp(finalTotalXP);
        
        // This update is the critical fix.
        await Cache_XP.set(guildId, targetUser.id, {
            level: recalculatedLevel,
            xp: recalculatedXP,
            // Set the entire calculated XP as the new baseline in one of the source fields.
            messageXP: finalTotalXP,
            // Zero out other source fields to prevent summing errors.
            voiceXP: 0,
            dropsXP: 0,
        });

        // Invalidate the user's cache to ensure the next operation gets the fresh DB state.
        Cache_XP.invalidate(guildId, targetUser.id);

        return client.utils.Embed(interaction, Colors.Green, 'Success', `Successfully set ${targetUser}'s stats to:\n**Level:** \`${recalculatedLevel}\`\n**XP:** \`${recalculatedXP}\``);

    } catch (error) {
        console.error("Error in LevelAdminSet:", error);
        return client.utils.Embed(interaction, Colors.Red, 'Error', 'An unexpected error occurred while setting the user\'s level/XP.');
    }
};