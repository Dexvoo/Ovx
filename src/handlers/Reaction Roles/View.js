const { Colors, parseEmoji } = require('discord.js');
// Removed unused imports for clarity
const { ReactionRoles } = require('../../models/GuildSetups');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsSetup(interaction) {
    const { client, guildId, guild } = interaction;

    const reactionRoleDocuments = await ReactionRoles.find({ guildId });

    if (!reactionRoleDocuments || reactionRoleDocuments.length === 0) {
        return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', 'No reaction roles have been set up in this server.');
    }

    const idsToDelete = [];

    const processReactionRole = async (doc) => {
        const channel = guild.channels.cache.get(doc.channelId);
        if (!channel) {
            idsToDelete.push(doc._id);
            return null;
        }

        const message = await channel.messages.fetch(doc.messageId).catch(() => null);
        if (!message) {
            idsToDelete.push(doc._id);
            return null;
        }

        const validRoleStrings = doc.roles
            .map(role => {
                const guildRole = guild.roles.cache.get(role.roleId);
                if (!guildRole) return null; // Role was deleted

                let emojiDisplay = client.CustomEmojis.reactions.QuestionMark;
                if (role.roleEmoji && typeof role.roleEmoji === 'string') emojiDisplay = role.roleEmoji;
                
                return `${guildRole} | ${emojiDisplay}`;
            })
            .filter(Boolean);

        if (validRoleStrings.length === 0) {
            idsToDelete.push(doc._id);
            return null;
        }

        const embedTitle = message.embeds[0]?.title || 'Untitled Embed';
        return `${channel} | ${embedTitle}\n${validRoleStrings.join('\n')}`;
    };

    const processingPromises = reactionRoleDocuments.map(processReactionRole);
    const resolvedStrings = await Promise.all(processingPromises);
    const reactionRolesList = resolvedStrings.filter(Boolean);

    if (idsToDelete.length > 0) {
        await ReactionRoles.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`[Auto-Cleanup] Deleted ${idsToDelete.length} stale reaction role entries for guild ${guildId}.`);
    }

    const embedDescription = reactionRolesList.join('\n\n') || 'No valid reaction roles found.';
    await client.utils.Embed(interaction, Colors.Blurple, 'Reaction Roles | View', `Here are the reaction roles set up in this server:\n\n${embedDescription}`);
};