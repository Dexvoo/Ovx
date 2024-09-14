const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType } = require('discord.js');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('')
        .setContexts( InteractionContextType.Guild ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;

        
        
    }

};