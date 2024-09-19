const { SlashCommandBuilder, EmbedBuilder, Colors, CommandInteraction, PermissionFlagsBits, parseEmoji, InteractionContextType } = require('discord.js');
const { DeveloperIDs } = process.env;

module.exports = {
    cooldown: 0,
    category: 'Developer',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('sim')
        .setDescription('Simulate leaving and joining a server')
        .setContexts( InteractionContextType.Guild )
        .addStringOption(option => option
            .setName('choice')
            .setDescription('Choose to leave or join a server')
            .setRequired(true)
            .addChoices(
                { name: 'Leave', value: 'leave' },
                { name: 'Join', value: 'join' }
            )
        ),
    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, client, member, guild, user, channel } = interaction;
        
        if (!DeveloperIDs.includes(member.id)) {
            const Embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('You must be a developer to use this command');
            return await interaction.reply({ embeds: [Embed], ephemeral: true });
        }

        const choice = options.getString('choice');

        switch (choice) {
            case 'leave':
                client.emit('guildMemberRemove', member);
                const leaveEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription('Simulated leaving the server');
                await interaction.reply({ embeds: [leaveEmbed], ephemeral: true });
                break;
            case 'join':
                client.emit('guildMemberAdd', member);
                const joinEmbed = new EmbedBuilder()
                    .setColor(Colors.Blurple)
                    .setDescription('Simulated joining the server');
                await interaction.reply({ embeds: [joinEmbed], ephemeral: true });
                
                break;
            default:
                const invalidEmbed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setDescription('Invalid choice');
                await interaction.reply({ embeds: [invalidEmbed], ephemeral: true });
                break;
        }
        
    }

};