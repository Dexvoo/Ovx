const { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } = require('discord.js')
const ms = require('ms');

module.exports = {
    cooldown: 5,
    category: 'Miscellaneous',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('reminder')
        .setDescription('Set a reminder')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall] )
        .setContexts( InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel )
        .addStringOption(option => option
            .setName('time')
            .setDescription('Time to set the reminder for (e.g. 1h30m, 30s)')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('reminder')
            .setDescription('The reminder message')
            .setRequired(true)
        ),

    /**
     * @param {CommandInteraction} interaction
     */

    async execute(interaction) {
        const { options, user } = interaction;
        const timeInput = options.getString('time');
        const reminderInput = options.getString('reminder');

        const timeInMs = ms(timeInput);

        if (!timeInMs) {
            const InvalidTimeEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('Please provide a valid time e.g. 1h30m, 30s');
            return await interaction.reply({ embeds: [InvalidTimeEmbed], ephemeral: true });
        }

        if (timeInMs > 86400000) {
            const TimeLimitEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('The time cannot be longer than 24 hours');
            return await interaction.reply({ embeds: [TimeLimitEmbed], ephemeral: true });
        }

        const ReminderEmbed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`I will remind you in ${timeInput} with the message: ${reminderInput}`);
        await interaction.reply({ embeds: [ReminderEmbed] });

        setTimeout(async () => {
            const ReminderMessage = new EmbedBuilder()
                .setColor('Blurple')
                .setDescription(`You asked me to remind you with the message: ${reminderInput}`);
            await interaction.followUp({ content: `${user}`, embeds: [ReminderMessage] });
        }, timeInMs);
        
    }

};