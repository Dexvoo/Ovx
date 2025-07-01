const { Colors, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, parseEmoji, ActionRowBuilder} = require('discord.js');
require('dotenv').config()
const { ReactionRoles } = require('../../models/GuildSetups');

/**
 * @param {import('../../types').CommandInputUtils} interaction
 */
module.exports = async function LogsSetup(interaction) {
    const { client, options, guildId, channel, guild } = interaction;
    
    const role = options.getRole('role');
    const emoji = options.getString('emoji');
    const messageId = options.getString('messageid');
    const title = options.getString('title') || null;

    let message
    if(!messageId) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(title || 'Reaction Roles')
        message = await channel.send({ embeds: [Embed] }).catch(() => {return false});

        if(!message) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', 'Failed to send the message in the current channel. Please try again later.');
    } else {
        message = await channel.messages.fetch(messageId).catch(() => {return false});
        if(!message) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `Failed to fetch the message with ID \`${messageId}\`. Please make sure the message exists in this channel.`);
    }


    let reactionRoleData =  await ReactionRoles.findOne({ guildId, messageId: message.id });
    if(!reactionRoleData) {
        reactionRoleData = new ReactionRoles({
            guildId,
            channelId: channel.id,
            messageId: message.id,
            enabled: true,
            title: title,
            roles: []
        });

        await reactionRoleData.save();
    }

    if(reactionRoleData.roles?.length > 0) {
        if(reactionRoleData.roles.find(r => r.roleId === role.id)) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `The role \`${role.name}\` is already set for this reaction role.`);
    }

    reactionRoleData.roles.push({
        roleId: role.id,
        emoji: emoji
    });

    await reactionRoleData.save();

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

    client.utils.Embed(interaction, Colors.Green, 'Reaction Roles | Success', `The role \`${role.name}\` has been added to the reaction roles for this message.`);
    
};