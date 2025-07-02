const { Colors, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, parseEmoji, ActionRowBuilder, MessageFlags} = require('discord.js');
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

    const parsedEmoji = parseEmoji(emoji);
    const unicodeEmojiRegex = /\p{Emoji}/u;
    if (!parsedEmoji?.id && !unicodeEmojiRegex.test(emoji)) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', 'The emoji you provided is not valid. Please provide a standard Discord emoji or a custom emoji from this server.');

    let message;
    if(!messageId) {
        const Embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setTitle(title || 'Reaction Roles');
        message = await client.utils.Embed(interaction, Colors.Blurple, title || 'Reaction Roles', '', { ephemeral: false })

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

        // No need to save here, we'll save after adding the role.
    }

    if(reactionRoleData.roles?.length > 0) {
        if(reactionRoleData.roles.find(r => r.roleId === role.id)) return client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `The role \`${role.name}\` is already set for this reaction role.`);
    }

    reactionRoleData.roles.push({
        roleId: role.id,
        roleEmoji: emoji // Store the original emoji string
    });

    await reactionRoleData.save();

    const roleMenu = new StringSelectMenuBuilder()
        .setCustomId(`select-role.${reactionRoleData.messageId}`)
        .setPlaceholder('Select a role')
        .setMinValues(0)
        .setMaxValues(reactionRoleData.roles.length)
        .addOptions(reactionRoleData.roles.map(r => {
            // We use the already validated emoji string here
            const currentEmoji = parseEmoji(r.roleEmoji);
            const roleName = guild.roles.cache.get(r.roleId)?.name || 'Deleted Role';
            
            return { 
                label: roleName, 
                value: r.roleId, 
                // The emoji property in options handles both formats correctly
                emoji: {
                    id: currentEmoji.id,
                    name: currentEmoji.name,
                    animated: currentEmoji.animated,
                }
            };
        }));

    const actionRow = new ActionRowBuilder().addComponents(roleMenu);

    await message.edit({ components: [actionRow] }).catch(() => {return false});

    return client.utils.Embed(interaction, Colors.Green, 'Reaction Roles | Success', `The role \`${role.name}\` has been added to the reaction roles for this message.`);
};