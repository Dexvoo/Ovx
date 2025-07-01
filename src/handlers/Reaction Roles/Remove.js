const { Colors, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, parseEmoji, ActionRowBuilder} = require('discord.js');
require('dotenv').config()
const { ReactionRoles } = require('../../models/GuildSetups');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsSetup(interaction) {
    const { client, options, guildId, channel, guild } = interaction;
    
    const role = options.getRole('role');

    const messageId = options.getString('messageid');
    const title = options.getString('title') || null;

    const message = await channel.messages.fetch(messageId).catch(() => {return false});
    if(!message) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `Failed to fetch the message with ID \`${messageId}\`. Please make sure the message exists in this channel.`);


    let reactionRoleData =  await ReactionRoles.findOne({ guildId, messageId: message.id });
    if(!reactionRoleData) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `No reaction roles found for the message with ID \`${messageId}\`. Please make sure the message has reaction roles set up.`);
    
    if(!reactionRoleData.roles.some(r => r.roleId === role.id)) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `The role \`${role.name}\` is not set for this reaction role message.`);

    reactionRoleData.roles = reactionRoleData.roles.filter(r => r.roleId !== role.id);

    await reactionRoleData.save();


    if(reactionRoleData.roles.length === 0) {
        await ReactionRoles.deleteOne({ guildId, messageId: message.id });
        message.delete();
        return client.utils.Embed(interaction, Colors.Green, 'Reaction Roles | Success', `The reaction roles for the message with ID \`${messageId}\` have been removed and the message has been deleted.`);
    }

    const roleMenu = new StringSelectMenuBuilder()
        .setCustomId(`select-role.${reactionRoleData.messageId}`)
        .setPlaceholder('Select a role')
        .setMinValues(0)
        .setMaxValues(reactionRoleData.roles.length)
        .addOptions(reactionRoleData.roles.map(role => {
            return { label: guild.roles.cache.get(role.roleId).name, value: role.roleId, emoji: role.roleEmoji };
        }));

    const actionRow = new ActionRowBuilder().addComponents(roleMenu);

    await message.edit({ components: [actionRow] }).catch(() => {return false});

    client.utils.Embed(interaction, Colors.Green, 'Reaction Roles | Success', `The role \`${role.name}\` has been removed to the reaction roles for this message.`);
    
};