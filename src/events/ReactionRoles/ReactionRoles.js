const { EmbedBuilder, Events, Interaction } = require('discord.js');
const { ReactionRoles } = require('../../models/GuildSetups');

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

            if(!type || !messageId) return;
            if(type !== 'select-role') return;

            await interaction.deferReply({ ephemeral: true });

            const reactionRoleData = await ReactionRoles.findOne({ messageId: messageId });
            if(!reactionRoleData) {
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('No Reaction Roles Data Found!');
                return await interaction.editReply({ embeds: [Embed] });
            }

            const targetChannel = await guild.channels.fetch(reactionRoleData.channelId).catch(() => { });
            const targetMessage = await targetChannel.messages.fetch(reactionRoleData.messageId).catch(() => { });

            if(!targetMessage) {
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('Reaction Roles Message Not Found!');
                return await interaction.editReply({ embeds: [Embed] });
            
            }
            const values = interaction.values;
            const addedRoles = [];
            const removedRoles = [];
            reactionRoleData.roles.forEach(async role => {
                if(values.includes(role.roleId)) {

                    if(!member.roles.cache.has(role.roleId)) {
                        addedRoles.push(role);
                        await member.roles.add(role.roleId).catch(() => { });
                    }
                } else {

                    if(member.roles.cache.has(role.roleId)) {
                        removedRoles.push(role);
                        await member.roles.remove(role.roleId).catch(() => { });
                    }
                }
            });

            if(addedRoles.length === 0 && removedRoles.length === 0) {
                const Embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('No Changes Were Made!');
                return await interaction.editReply({ embeds: [Embed] });
            }

            const Embed = new EmbedBuilder()
                .setColor('Blurple')

            if(addedRoles.length > 0) {
                Embed.addFields(
                    { name: 'Added Roles', value: addedRoles.map(role => `<@&${role.roleId}>`).join('\n') }
                );
            }

            if(removedRoles.length > 0) {
                Embed.addFields(
                    { name: 'Removed Roles', value: removedRoles.map(role => `<@&${role.roleId}>`).join('\n') }
                );
            }

            await interaction.editReply({ embeds: [Embed] });
            
        } catch (error) {
            console.error(error);

            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('An Error Occurred While Processing This Request!');
            return await interaction.editReply({ embeds: [Embed] });
        }
       
    }
    
    
};
