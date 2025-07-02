const { SlashCommandBuilder, Colors, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, MessageFlags } = require('discord.js');

const handlers = {
    'ovx-reactionroles-add': require('../../handlers/Reaction Roles/Add'),
    'ovx-reactionroles-remove': require('../../handlers/Reaction Roles/Remove'),
    'ovx-reactionroles-view': require('../../handlers/Reaction Roles/View'),
};

module.exports = {
    cooldown: 0,
    category: 'Moderation',
    userpermissions: [],
    botpermissions: [],
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('Add/remove/view reaction roles in your server')
        .setIntegrationTypes( [ApplicationIntegrationType.GuildInstall] )
        .setContexts( InteractionContextType.Guild )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        
        .addSubcommand(subcommand => subcommand
            .setName('add')
            .setDescription('add reaction roles for your server.')
            .addRoleOption(option => option
                .setName('role')
                .setDescription('Set the role for reaction roles.')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('emoji')
                .setDescription('Set the emoji for the role.')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('messageid')
                .setDescription('Message ID for the reaction role(in current channel).')
                .setRequired(false)
            )
            .addStringOption(option => option
                .setName('title')
                .setDescription('Set the title for the reaction role embed.')
                .setRequired(false)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('remove')
            .setDescription('remove reaction role for your server.')
            .addRoleOption(option => option
                .setName('role')
                .setDescription('Set the role for reaction roles.')
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('messageid')
                .setDescription('Message ID for the reaction role(in current channel).')
                .setRequired(true)
            )
        )
        
        .addSubcommand(subcommand => subcommand
            .setName('view')
            .setDescription('View reaction roles for your server.')
        ),
    /**
    * @param {import('../../types').CommandInputUtils} interaction
    */

    async execute(interaction) {

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {return false});

        const subcommand = interaction.options.getSubcommand();
        if(!handlers[`ovx-reactionroles-${subcommand}`]) return interaction.client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Not Found', `The subcommand \`${subcommand}\` does not exist.`);

        const handler = handlers[`ovx-reactionroles-${subcommand}`];

        try {
            await handler(interaction);
        } catch (error) {
            console.error(error);
            interaction.client.utils.Embed(interaction, Colors.Red, 'Reaction Roles | Error', `There was an error while executing this command: \`${error.message}\``);
        }
    }
};