const { SlashCommandBuilder, Colors, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType, AutocompleteInteraction } = require('discord.js');

const handlers = {
    'take': require('../../handlers/Sticker/Take'),
    'edit': require('../../handlers/Sticker/Edit'),
    'delete': require('../../handlers/Sticker/Delete'),
    'list': require('../../handlers/Sticker/List'),
};

module.exports = {
    cooldown: 10,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    botpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    data: new SlashCommandBuilder()
        .setName('sticker')
        .setDescription('Manage server stickers.')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addSubcommand(subcommand => subcommand
            .setName('take')
            .setDescription('Add an external sticker to this server from a message link.')
            .addStringOption(option => option.setName('name').setDescription('The name for the new sticker (2-32 characters).').setRequired(true))
            .addStringOption(option => option.setName('message_link').setDescription('The link to the message containing the sticker.').setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('Optional description for the sticker.').setRequired(false))
        )
        .addSubcommand(subcommand => subcommand
            .setName('edit')
            .setDescription('Change the name or description of a sticker in this server.')
            .addStringOption(option => option.setName('sticker').setDescription('The sticker you want to edit.').setAutocomplete(true).setRequired(true))
            .addStringOption(option => option.setName('name').setDescription('The new name for the sticker.').setRequired(false))
            .addStringOption(option => option.setName('description').setDescription('The new description for the sticker.').setRequired(false))
        )
        .addSubcommand(subcommand => subcommand
            .setName('delete')
            .setDescription('Delete a sticker from this server.')
            .addStringOption(option => option.setName('sticker').setDescription('The sticker to delete.').setAutocomplete(true).setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('List all stickers in this server.')
        ),

    /**
     * @param {AutocompleteInteraction} interaction
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const stickers = interaction.guild.stickers.cache;
        
        const filtered = stickers.filter(sticker => 
            sticker.name.toLowerCase().includes(focusedValue)
        ).map(sticker => ({
            name: sticker.name,
            value: sticker.id
        })).slice(0, 25);

        await interaction.respond(filtered);
    },

    /**
     * @param {import('../../types').CommandInputUtils} interaction
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const handler = handlers[subcommand];

        if (!handler) {
            return interaction.client.utils.Embed(interaction, Colors.Red, 'Error', `Subcommand handler not found.`);
        }

        try {
            await interaction.deferReply();
            await handler(interaction);
        } catch (error) {
            console.error(`Error executing sticker subcommand '${subcommand}':`, error);
            interaction.client.utils.Embed(interaction, Colors.Red, 'Error', `An unexpected error occurred: \`${error.message}\``);
        }
    }
};