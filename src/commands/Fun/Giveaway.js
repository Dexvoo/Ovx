const { SlashCommandBuilder, PermissionFlagsBits, ApplicationIntegrationType, InteractionContextType, Colors } = require('discord.js');
const { Giveaway } = require('../../models/GuildSetups');

const handlers = {
    create: require('../../handlers/Giveaways/Create'),
    end: require('../../handlers/Giveaways/End'),
    reroll: require('../../handlers/Giveaways/Reroll'),
};

module.exports = {
    cooldown: 10,
    category: 'Fun',
    userpermissions: [PermissionFlagsBits.ManageGuild],
    botpermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways in your server.')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand => subcommand
            .setName('create')
            .setDescription('Create a new giveaway.')
            .addStringOption(option => option.setName('duration').setDescription('How long should it last? (e.g., 1d, 8h, 30m)').setRequired(true))
            .addStringOption(option => option.setName('prize').setDescription('What is the prize?').setRequired(true))
            .addIntegerOption(option => option.setName('winners').setDescription('How many winners? (Default: 1)').setMinValue(1).setRequired(false))
            .addRoleOption(option => option.setName('role').setDescription('Optional: Required role to enter.').setRequired(false))
            .addUserOption(option => option.setName('host').setDescription('Optional: Who is hosting this giveaway? (Default: You)').setRequired(false))
        )
        .addSubcommand(subcommand => subcommand
            .setName('end')
            .setDescription('End a giveaway early.')
            .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway to end.').setAutocomplete(true).setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('reroll')
            .setDescription('Reroll a new winner for an ended giveaway.')
            .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway to reroll.').setAutocomplete(true).setRequired(true))
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'message_id') return;

        const subcommand = interaction.options.getSubcommand();
        const isActive = subcommand === 'end'; // 'end' needs active, 'reroll' needs inactive

        const giveaways = await Giveaway.find({ guildId: interaction.guildId, isActive: isActive }).limit(25);
        
        await interaction.respond(
            giveaways.map(g => ({ name: `🎁 ${g.prize.substring(0, 80)}`, value: g.messageId }))
        );
    },
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const handler = handlers[subcommand];

        if (!handler) {
            return interaction.client.utils.Embed(interaction, Colors.Red, 'Error', 'Subcommand handler not found.');
        }

        try {
            await interaction.deferReply({ ephemeral: true });
            await handler(interaction);
        } catch (error) {
            console.error(`Error executing giveaway subcommand '${subcommand}':`, error);
            interaction.client.utils.Embed(interaction, Colors.Red, 'Error', `An unexpected error occurred: \`${error.message}\``);
        }
    }
};