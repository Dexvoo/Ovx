const { SlashCommandBuilder, Colors, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const handlers = {
    'take': require('../../handlers/Emoji/Take'),
    'edit': require('../../handlers/Emoji/Edit'),
    'delete': require('../../handlers/Emoji/Delete'),
    'list': require('../../handlers/Emoji/List'),
};

module.exports = {
    cooldown: 5,
    category: 'Moderation',
    userpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    botpermissions: [PermissionFlagsBits.ManageGuildExpressions],
    staffOnly: true,
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Manage server emojis.')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addSubcommand(subcommand => subcommand
            .setName('take')
            .setDescription('Add one or more external emojis to this server.')
            .addStringOption(option => option.setName('emoji1').setDescription('The first emoji to add.').setRequired(true))
            .addStringOption(option => option.setName('emoji2').setDescription('The second emoji to add.').setRequired(false))
            .addStringOption(option => option.setName('emoji3').setDescription('The third emoji to add.').setRequired(false))
            .addStringOption(option => option.setName('emoji4').setDescription('The fourth emoji to add.').setRequired(false))
            .addStringOption(option => option.setName('emoji5').setDescription('The fifth emoji to add.').setRequired(false))
        )
        .addSubcommand(subcommand => subcommand
            .setName('edit')
            .setDescription('Change the name of an emoji in this server.')
            .addStringOption(option => option.setName('emoji').setDescription('The server emoji you want to edit.').setRequired(true))
            .addStringOption(option => option.setName('name').setDescription('The new name for the emoji.').setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('delete')
            .setDescription('Delete an emoji from this server.')
            .addStringOption(option => option.setName('emoji').setDescription('The emoji to delete.').setRequired(true))
        )
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('List all emojis in this server.')
        ),

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
            console.error(`Error executing emoji subcommand '${subcommand}':`, error);
            interaction.client.utils.Embed(interaction, Colors.Red, 'Error', `An unexpected error occurred: \`${error.message}\``);
        }
    }
};