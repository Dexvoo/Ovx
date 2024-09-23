const { SlashCommandBuilder, EmbedBuilder, CommandInteraction, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { AFKUsers } = require('../../models/GuildSetups.js');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('set your status to AFK')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild)
        .addStringOption(option => option
            .setName('status')
            .setDescription('Set your AFK status')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        const status = options.getString('status');
        const guildAFKUser = await AFKUsers.findOne({ guildId: guild.id });

        if(guildAFKUser) {
            // User is already AFK
            const AlreadyAFKEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`${member}, you are already AFK with status: ${guildAFKUser.status}\nIf you want to remove your AFK status please type in a channel`);
            return await interaction.reply({ embeds: [AlreadyAFKEmbed], ephemeral: true });                
        }

        if(status.length > 100) {
            const Embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Status must be less than 100 characters');
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }


        const newGuildAFKUser = new AFKUsers({
            userId: user.id,
            guildId: guild.id,
            reason: status,
        });

        await newGuildAFKUser.save();

        const AFKEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`${member} is now AFK: ${status}`);
        await interaction.reply({ embeds: [AFKEmbed] });
        
    }

};